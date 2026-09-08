import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual, Like } from 'typeorm';
import { Campaign, CampaignStatus, CampaignStats } from './entities/campaign.entity';
import { CampaignLead, CampaignLeadStatus } from './entities/campaign-lead.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { AddCampaignLeadsDto } from './dto/add-leads.dto';
import { CampaignLeadsQueryDto, CampaignListQueryDto } from './dto/campaign-query.dto';
import { UpdateCampaignLeadDto } from './dto/update-lead.dto';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { HookManager } from '../../core/hooks/hook-manager.service';
import { createLogger } from '../../common/services/logger.service';
import { renderTemplate } from '../../common/utils/template-render';
import {
  calculateHumanDelay,
  calculateTypingDuration,
  calculateBatchBreather,
} from '../../common/utils/human-jitter';

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'quit', 'optout', 'opt-out'];

function parseSpintax(text: string): string {
  if (!text) return '';
  let result = text;
  const spintaxRegex = /\{([^{}]+)\}/g;
  while (spintaxRegex.test(result)) {
    result = result.replace(spintaxRegex, (_match, group) => {
      const options = group.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
  }
  return result;
}

function cleanPhoneNumber(raw: string): { cleaned: string; chatId: string } {
  const digitsOnly = (raw || '').replace(/\D/g, '');
  return {
    cleaned: digitsOnly,
    chatId: `${digitsOnly}@c.us`,
  };
}

@Injectable()
export class CampaignService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('CampaignService');
  private schedulerInterval?: NodeJS.Timeout;
  private readonly runningLoops = new Set<string>();

  constructor(
    @InjectRepository(Campaign, 'data')
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignLead, 'data')
    private readonly leadRepo: Repository<CampaignLead>,
    private readonly engineRegistry: EngineRegistry,
    private readonly hookManager: HookManager,
  ) {}

  onModuleInit() {
    // 1. Hook for inbound message reply & opt-out tracking
    this.hookManager.register(
      'campaign-reply-tracker',
      'message:received',
      async (ctx: any) => {
        await this.handleInboundHook(ctx.sessionId || '', ctx.data);
        return { continue: true };
      },
      10,
    );

    // 2. Hook for delivery status acks (Delivered, Read)
    this.hookManager.register(
      'campaign-ack-tracker',
      'message:ack',
      async (ctx: any) => {
        await this.handleAckHook(ctx.sessionId || '', ctx.data);
        return { continue: true };
      },
      10,
    );

    // 3. Scheduler interval for scheduled campaigns (every 30 seconds) + immediate startup sweep
    this.sweepScheduledCampaigns().catch(err => {
      this.logger.warn('Error in startup sweepScheduledCampaigns', { error: String(err) });
    });
    this.schedulerInterval = setInterval(() => {
      this.sweepScheduledCampaigns().catch((err) => {
        this.logger.warn('Error in sweepScheduledCampaigns', { error: String(err) });
      });
    }, 30 * 1000);
  }

  onModuleDestroy() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
  }

  /**
   * Create a campaign with spreadsheet leads.
   */
  async createCampaign(dto: CreateCampaignDto): Promise<Campaign> {
    const isScheduled = !!dto.scheduledAt && new Date(dto.scheduledAt) > new Date();
    const status = isScheduled ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT;

    const initialStats: CampaignStats = {
      total: dto.leads.length,
      pending: dto.leads.length,
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      optOut: 0,
      failed: 0,
      responseRate: 0,
    };

    const campaign = this.campaignRepo.create({
      name: dto.name,
      sessionIds: dto.sessionIds,
      template: dto.template,
      mediaUrl: dto.mediaUrl,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      status,
      pacing: {
        minDelayMs: dto.pacing?.minDelayMs ?? 3000,
        maxDelayMs: dto.pacing?.maxDelayMs ?? 6000,
        simulateTyping: dto.pacing?.simulateTyping ?? true,
      },
      columnsMetadata: dto.columnsMetadata || ['Phone', 'Name'],
      stats: initialStats,
    });

    const savedCampaign = await this.campaignRepo.save(campaign);

    // Insert leads in chunks of 200 for fast database write
    if (dto.leads && dto.leads.length > 0) {
      const sessionCount = dto.sessionIds.length || 1;
      const leadEntities: CampaignLead[] = dto.leads.map((item, index) => {
        const { cleaned, chatId } = cleanPhoneNumber(item.phone);
        const assignedSession = dto.sessionIds[index % sessionCount];
        return this.leadRepo.create({
          campaignId: savedCampaign.id,
          sessionId: assignedSession,
          phoneNumber: cleaned,
          chatId,
          name: item.name,
          customVariables: item.variables || {},
          status: CampaignLeadStatus.PENDING,
        });
      });

      const chunkSize = 200;
      for (let i = 0; i < leadEntities.length; i += chunkSize) {
        await this.leadRepo.save(leadEntities.slice(i, i + chunkSize));
      }
    }

    if (dto.autoLaunch && !isScheduled) {
      this.startCampaign(savedCampaign.id).catch((err) => {
        this.logger.error('Failed to auto-launch campaign', err instanceof Error ? err.stack : String(err), { campaignId: savedCampaign.id });
      });
    }

    return savedCampaign;
  }

  /**
   * Add more numbers dynamically to an existing campaign.
   */
  async addLeads(campaignId: string, dto: AddCampaignLeadsDto): Promise<{ added: number; newTotal: number }> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const sessionCount = campaign.sessionIds.length || 1;
    const leadEntities: CampaignLead[] = dto.leads.map((item, index) => {
      const { cleaned, chatId } = cleanPhoneNumber(item.phone);
      const assignedSession = campaign.sessionIds[index % sessionCount];
      return this.leadRepo.create({
        campaignId: campaign.id,
        sessionId: assignedSession,
        phoneNumber: cleaned,
        chatId,
        name: item.name,
        customVariables: item.variables || {},
        status: CampaignLeadStatus.PENDING,
      });
    });

    const chunkSize = 200;
    for (let i = 0; i < leadEntities.length; i += chunkSize) {
      await this.leadRepo.save(leadEntities.slice(i, i + chunkSize));
    }

    await this.refreshCampaignStats(campaign.id);
    const updated = await this.campaignRepo.findOne({ where: { id: campaignId } });

    // If campaign is currently running, wake up the dispatch worker if it was idle
    if (campaign.status === CampaignStatus.RUNNING && !this.runningLoops.has(campaignId)) {
      this.dispatchCampaignLeads(campaignId).catch((err) => {
        this.logger.error('Error continuing campaign dispatch after adding leads', err instanceof Error ? err.stack : String(err), { campaignId });
      });
    }

    return { added: dto.leads.length, newTotal: updated?.stats.total || 0 };
  }

  /**
   * Start or resume a campaign.
   */
  async startCampaign(campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (campaign.status === CampaignStatus.COMPLETED) {
      // If there are newly added pending leads, allow restart
      const pendingCount = await this.leadRepo.count({
        where: { campaignId, status: CampaignLeadStatus.PENDING },
      });
      if (pendingCount === 0) {
        throw new BadRequestException('Campaign is already completed and has no pending leads.');
      }
    }

    campaign.status = CampaignStatus.RUNNING;
    if (!campaign.startedAt) {
      campaign.startedAt = new Date();
    }
    await this.campaignRepo.save(campaign);

    // Trigger async non-blocking dispatch loop
    this.dispatchCampaignLeads(campaignId).catch((err) => {
      this.logger.error('Error during campaign execution loop', err instanceof Error ? err.stack : String(err), { campaignId });
    });

    return campaign;
  }

  /**
   * Pause an actively running campaign.
   */
  async pauseCampaign(campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    campaign.status = CampaignStatus.PAUSED;
    await this.campaignRepo.save(campaign);
    return campaign;
  }

  /**
   * Cancel an actively running or scheduled campaign.
   */
  async cancelCampaign(campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    campaign.status = CampaignStatus.CANCELLED;
    await this.campaignRepo.save(campaign);
    return campaign;
  }

  /**
   * Core dispatch loop with anti-ban delays, typing simulation, and number validation.
   */
  private async dispatchCampaignLeads(campaignId: string) {
    if (this.runningLoops.has(campaignId)) return;
    this.runningLoops.add(campaignId);

    try {
      while (true) {
        // Fetch fresh campaign status
        const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
        if (!campaign || campaign.status !== CampaignStatus.RUNNING) {
          break;
        }

        // Fetch next batch of pending leads
        const pendingLeads = await this.leadRepo.find({
          where: { campaignId, status: CampaignLeadStatus.PENDING },
          take: 10,
          order: { createdAt: 'ASC' },
        });

        if (pendingLeads.length === 0) {
          // Check if all leads are processed
          const remainingPending = await this.leadRepo.count({
            where: { campaignId, status: CampaignLeadStatus.PENDING },
          });
          if (remainingPending === 0) {
            campaign.status = CampaignStatus.COMPLETED;
            campaign.completedAt = new Date();
            await this.campaignRepo.save(campaign);
          }
          break;
        }

        let consecutiveDispatches = 0;
        for (const lead of pendingLeads) {
          // Check if paused/cancelled mid-loop
          const fresh = await this.campaignRepo.findOne({ where: { id: campaignId } });
          if (!fresh || fresh.status !== CampaignStatus.RUNNING) {
            break;
          }

          await this.dispatchSingleLead(campaign, lead);
          consecutiveDispatches++;
          await this.refreshCampaignStats(campaignId);

          // Anti-ban randomized Gaussian pacing delay
          const minD = campaign.pacing?.minDelayMs || 3000;
          const maxD = campaign.pacing?.maxDelayMs || 6000;
          const delay = calculateHumanDelay(minD, maxD);
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Natural human batch breather (e.g. after every 10 sends take a 12-25s pause)
          const breather = calculateBatchBreather(consecutiveDispatches, 10, 12000, 25000);
          if (breather > 0) {
            this.logger.log(`Natural batch breather pause (${Math.round(breather / 1000)}s) for campaign ${campaignId}`);
            await new Promise((resolve) => setTimeout(resolve, breather));
          }
        }
      }
    } finally {
      this.runningLoops.delete(campaignId);
      await this.refreshCampaignStats(campaignId);
    }
  }

  /**
   * Dispatch message to a single lead with number check and typing indicator.
   */
  private async dispatchSingleLead(campaign: Campaign, lead: CampaignLead) {
    const engine = this.engineRegistry.get(lead.sessionId);
    if (!engine) {
      lead.status = CampaignLeadStatus.FAILED;
      lead.errorMessage = `Session '${lead.sessionId}' is not active or ready.`;
      await this.leadRepo.save(lead);
      return;
    }

    // 1. WhatsApp Number Pre-Validation
    try {
      const exists = await engine.checkNumberExists(lead.phoneNumber);
      if (!exists) {
        lead.status = CampaignLeadStatus.NOT_ON_WA;
        lead.errorMessage = 'Phone number is not registered on WhatsApp.';
        await this.leadRepo.save(lead);
        return;
      }
    } catch {
      // If check fails, proceed to attempt send
    }

    // 2. Prepare message text with spintax & placeholder variable interpolation
    let messageText = parseSpintax(campaign.template);
    messageText = messageText.replace(/{{\s*phone\s*}}/gi, lead.phoneNumber || '');
    messageText = messageText.replace(/{{\s*name\s*}}/gi, lead.name || 'there');

    if (lead.customVariables) {
      for (const [k, v] of Object.entries(lead.customVariables)) {
        const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'gi');
        messageText = messageText.replace(regex, v || '');
      }
    }

    // 3. Human Typing Simulation
    if (campaign.pacing?.simulateTyping) {
      try {
        if (typeof engine.sendChatState === 'function') {
          await engine.sendChatState(lead.chatId, 'typing');
          const typingDuration = calculateTypingDuration(messageText, 1500, 5000);
          await new Promise((resolve) => setTimeout(resolve, typingDuration));
        }
      } catch {
        // Non-fatal
      }
    }

    // 4. Send Message
    try {
      let sendResult: any;
      if (campaign.mediaUrl) {
        sendResult = await engine.sendImageMessage(lead.chatId, {
          mimetype: 'image/jpeg',
          data: campaign.mediaUrl,
          caption: messageText || undefined,
        });
      } else {
        sendResult = await engine.sendTextMessage(lead.chatId, messageText);
      }

      lead.status = CampaignLeadStatus.SENT;
      lead.sentAt = new Date();
      lead.waMessageId = sendResult?.id || sendResult?.key?.id || undefined;
      lead.errorMessage = undefined;
      await this.leadRepo.save(lead);
    } catch (err: any) {
      lead.status = CampaignLeadStatus.FAILED;
      lead.errorMessage = err?.message || 'Failed to send message';
      await this.leadRepo.save(lead);
    }
  }

  /**
   * Handle incoming message hook to attribute replies to campaigns.
   */
  async handleInboundHook(sessionId: string, messageData: any) {
    if (!messageData || messageData.fromMe) return;

    const fromChatId = messageData.from || messageData.key?.remoteJid;
    if (!fromChatId) return;

    // Find the most recent active or recently completed lead for this chat
    const lead = await this.leadRepo.findOne({
      where: {
        chatId: fromChatId,
        status: In([CampaignLeadStatus.SENT, CampaignLeadStatus.DELIVERED, CampaignLeadStatus.READ]),
      },
      order: { sentAt: 'DESC' },
    });

    if (!lead) return;

    const body = (messageData.body || messageData.message?.conversation || '').trim();
    const lowerBody = body.toLowerCase();

    // Check opt-out keywords
    const isOptOut = OPT_OUT_KEYWORDS.some((kw) => lowerBody === kw || lowerBody.startsWith(`${kw} `));

    if (isOptOut) {
      lead.status = CampaignLeadStatus.OPT_OUT;
      lead.repliedAt = new Date();
      lead.firstReplySnippet = body.slice(0, 500);
      await this.leadRepo.save(lead);
      this.logger.log('Lead opted out from campaign', { campaignId: lead.campaignId, chatId: fromChatId });
    } else {
      lead.status = CampaignLeadStatus.REPLIED;
      lead.repliedAt = new Date();
      lead.firstReplySnippet = body.slice(0, 500);
      await this.leadRepo.save(lead);
      this.logger.log('Lead replied to campaign', { campaignId: lead.campaignId, chatId: fromChatId });
    }

    await this.refreshCampaignStats(lead.campaignId);
  }

  /**
   * Handle message status delivery receipts (Delivered / Read).
   */
  async handleAckHook(sessionId: string, ackData: any) {
    if (!ackData) return;
    const waMessageId = ackData.id || ackData.messageId || ackData.key?.id;
    const ack = ackData.ack ?? ackData.status;

    if (!waMessageId) return;

    const lead = await this.leadRepo.findOne({
      where: { waMessageId },
    });

    if (!lead || lead.status === CampaignLeadStatus.REPLIED || lead.status === CampaignLeadStatus.OPT_OUT) {
      return;
    }

    // WhatsApp ACK standard: 2 = Server Ack, 3 = Delivered (Double Gray), 4 = Read (Blue Tick)
    if (ack >= 4 || ack === 'read') {
      lead.status = CampaignLeadStatus.READ;
      if (!lead.readAt) lead.readAt = new Date();
      await this.leadRepo.save(lead);
      await this.refreshCampaignStats(lead.campaignId);
    } else if (ack >= 3 || ack === 'delivered') {
      if (lead.status === CampaignLeadStatus.SENT) {
        lead.status = CampaignLeadStatus.DELIVERED;
        if (!lead.deliveredAt) lead.deliveredAt = new Date();
        await this.leadRepo.save(lead);
        await this.refreshCampaignStats(lead.campaignId);
      }
    }
  }

  /**
   * Recalculate and update campaign aggregated stats cache.
   */
  async refreshCampaignStats(campaignId: string): Promise<CampaignStats> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) return {} as CampaignStats;

    const total = await this.leadRepo.count({ where: { campaignId } });
    const pending = await this.leadRepo.count({ where: { campaignId, status: CampaignLeadStatus.PENDING } });
    const sent = await this.leadRepo.count({ where: { campaignId, status: CampaignLeadStatus.SENT } });
    const delivered = await this.leadRepo.count({ where: { campaignId, status: CampaignLeadStatus.DELIVERED } });
    const read = await this.leadRepo.count({ where: { campaignId, status: CampaignLeadStatus.READ } });
    const replied = await this.leadRepo.count({ where: { campaignId, status: CampaignLeadStatus.REPLIED } });
    const optOut = await this.leadRepo.count({ where: { campaignId, status: CampaignLeadStatus.OPT_OUT } });
    const failed = await this.leadRepo.count({
      where: { campaignId, status: In([CampaignLeadStatus.FAILED, CampaignLeadStatus.NOT_ON_WA]) },
    });

    const totalDispatched = sent + delivered + read + replied + optOut;
    const responseRate = totalDispatched > 0 ? Number(((replied / totalDispatched) * 100).toFixed(1)) : 0;

    const stats: CampaignStats = {
      total,
      pending,
      sent,
      delivered,
      read,
      replied,
      optOut,
      failed,
      responseRate,
    };

    campaign.stats = stats;
    await this.campaignRepo.save(campaign);
    return stats;
  }

  async sweepScheduledCampaigns() {
    const now = new Date();

    // 1. Sweep scheduled campaigns whose scheduledAt is due.
    // Atomically claim each candidate campaign using an UPDATE ... WHERE status = 'scheduled'
    // so only the winning node in a multi-node/distributed deployment starts the campaign.
    const scheduledCandidates = await this.campaignRepo.find({
      where: {
        status: CampaignStatus.SCHEDULED,
        scheduledAt: LessThanOrEqual(now),
      },
      select: { id: true, name: true },
    });

    for (const c of scheduledCandidates) {
      const claimResult = await this.campaignRepo.update(
        { id: c.id, status: CampaignStatus.SCHEDULED },
        { status: CampaignStatus.RUNNING, startedAt: new Date() },
      );

      if ((claimResult.affected ?? 0) > 0) {
        this.logger.log(`Starting scheduled campaign (claimed by node): ${c.name} (${c.id})`);
        this.dispatchCampaignLeads(c.id).catch(err => {
          this.logger.error(
            'Error during scheduled campaign dispatch loop',
            err instanceof Error ? err.stack : String(err),
            { campaignId: c.id },
          );
        });
      }
    }

    // 2. Auto-resume orphaned running campaigns (e.g. after server restart or crash)
    const running = await this.campaignRepo.find({
      where: {
        status: CampaignStatus.RUNNING,
      },
    });

    for (const c of running) {
      if (!this.runningLoops.has(c.id)) {
        const pendingCount = await this.leadRepo.count({
          where: { campaignId: c.id, status: CampaignLeadStatus.PENDING },
        });
        if (pendingCount > 0) {
          this.logger.log(`Auto-resuming in-flight campaign with ${pendingCount} pending lead(s): ${c.name} (${c.id})`);
          this.dispatchCampaignLeads(c.id).catch(err => {
            this.logger.error(
              'Error in auto-resumed campaign dispatch loop',
              err instanceof Error ? err.stack : String(err),
              { campaignId: c.id },
            );
          });
        }
      }
    }
  }

  /**
   * List campaigns with pagination and filter.
   */
  async listCampaigns(query: CampaignListQueryDto): Promise<{ items: Campaign[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.status) where.status = query.status;

    const [items, total] = await this.campaignRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }

  /**
   * Get single campaign by ID.
   */
  async getCampaign(id: string): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  /**
   * List leads / spreadsheet rows for a campaign.
   */
  async listLeads(campaignId: string, query: CampaignLeadsQueryDto): Promise<{ items: CampaignLead[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 50));

    const qb = this.leadRepo.createQueryBuilder('lead').where('lead.campaignId = :campaignId', { campaignId });

    if (query.status) {
      qb.andWhere('lead.status = :status', { status: query.status });
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      if (/^\\+?\\d+$/.test(term)) {
        // If it's a phone number, search exact or starts-with
        qb.andWhere('lead.phoneNumber LIKE :search', { search: `${term}%` });
      } else {
        const search = `%${term}%`;
        qb.andWhere('(lead.name LIKE :search OR lead.firstReplySnippet LIKE :search)', {
          search,
        });
      }
    }

    qb.orderBy('lead.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /**
   * Update an existing lead (e.g. from Spreadsheet CRM).
   */
  async updateLead(campaignId: string, leadId: string, dto: UpdateCampaignLeadDto): Promise<CampaignLead> {
    const lead = await this.leadRepo.findOne({ where: { id: leadId, campaignId } });
    if (!lead) throw new NotFoundException('Lead not found');

    if (dto.name !== undefined) {
      lead.name = dto.name;
    }
    
    if (dto.customVariables !== undefined) {
      // Merge custom variables
      lead.customVariables = {
        ...lead.customVariables,
        ...dto.customVariables,
      };
    }

    return this.leadRepo.save(lead);
  }

  /**
   * Get detailed analytics, funnel stages, and hourly response trends.
   */
  async getCampaignAnalytics(campaignId: string) {
    const campaign = await this.getCampaign(campaignId);
    const stats = await this.refreshCampaignStats(campaignId);

    // Funnel stages
    const totalDispatched = stats.sent + stats.delivered + stats.read + stats.replied + stats.optOut;
    const funnel = [
      { stage: 'Targeted', count: stats.total, percent: 100 },
      { stage: 'Dispatched', count: totalDispatched, percent: stats.total ? Math.round((totalDispatched / stats.total) * 100) : 0 },
      { stage: 'Delivered', count: stats.delivered + stats.read + stats.replied, percent: totalDispatched ? Math.round(((stats.delivered + stats.read + stats.replied) / totalDispatched) * 100) : 0 },
      { stage: 'Read', count: stats.read + stats.replied, percent: totalDispatched ? Math.round(((stats.read + stats.replied) / totalDispatched) * 100) : 0 },
      { stage: 'Replied', count: stats.replied, percent: totalDispatched ? Math.round((stats.replied / totalDispatched) * 100) : 0 },
    ];

    // Hourly reply timeline
    const repliedLeads = await this.leadRepo.find({
      where: { campaignId, status: In([CampaignLeadStatus.REPLIED, CampaignLeadStatus.OPT_OUT]) },
      select: { repliedAt: true, status: true },
      order: { repliedAt: 'ASC' },
    });

    const hourlyMap: Record<string, { replies: number; optOuts: number }> = {};
    for (const r of repliedLeads) {
      if (!r.repliedAt) continue;
      const hourKey = new Date(r.repliedAt).toISOString().slice(0, 13) + ':00';
      if (!hourlyMap[hourKey]) {
        hourlyMap[hourKey] = { replies: 0, optOuts: 0 };
      }
      if (r.status === CampaignLeadStatus.OPT_OUT) {
        hourlyMap[hourKey].optOuts++;
      } else {
        hourlyMap[hourKey].replies++;
      }
    }

    const timeline = Object.entries(hourlyMap).map(([time, val]) => ({
      time,
      replies: val.replies,
      optOuts: val.optOuts,
    }));

    return {
      campaign,
      stats,
      funnel,
      timeline,
    };
  }

  /**
   * Export spreadsheet with lead statuses and replies to CSV format using streams.
   */
  async exportCampaignCsv(campaignId: string, stream: NodeJS.WritableStream): Promise<void> {
    const campaign = await this.getCampaign(campaignId);

    const extraVarArray = (campaign.columnsMetadata || [])
      .filter(k => k.toLowerCase() !== 'phone' && k.toLowerCase() !== 'name');

    const headers = [
      'Phone Number',
      'Name',
      ...extraVarArray,
      'Status',
      'Sent At',
      'Delivered At',
      'Read At',
      'Replied At',
      'First Reply Snippet',
      'Error Message',
    ];

    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    
    stream.write(headers.join(',') + '\\n');

    const queryStream = await this.leadRepo.createQueryBuilder('lead')
      .where('lead.campaignId = :campaignId', { campaignId })
      .orderBy('lead.createdAt', 'ASC')
      .stream();

    return new Promise((resolve, reject) => {
      queryStream.on('data', (data: any) => {
        const row = [
          escapeCsv(data.lead_phone_number),
          escapeCsv(data.lead_name || ''),
          ...extraVarArray.map((k) => escapeCsv(data.lead_custom_variables?.[k] || '')),
          escapeCsv(data.lead_status),
          escapeCsv(data.lead_sent_at ? new Date(data.lead_sent_at).toISOString() : ''),
          escapeCsv(data.lead_delivered_at ? new Date(data.lead_delivered_at).toISOString() : ''),
          escapeCsv(data.lead_read_at ? new Date(data.lead_read_at).toISOString() : ''),
          escapeCsv(data.lead_replied_at ? new Date(data.lead_replied_at).toISOString() : ''),
          escapeCsv(data.lead_first_reply_snippet || ''),
          escapeCsv(data.lead_error_message || ''),
        ];
        stream.write(row.join(',') + '\\n');
      });

      queryStream.on('end', () => {
        stream.end();
        resolve();
      });

      queryStream.on('error', (err) => {
        stream.emit('error', err);
        reject(err);
      });
    });
  }
}
