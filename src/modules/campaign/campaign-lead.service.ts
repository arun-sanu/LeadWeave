import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignLead, CampaignLeadStatus } from './entities/campaign-lead.entity';
import { AddCampaignLeadsDto } from './dto/add-leads.dto';
import { CampaignLeadsQueryDto } from './dto/campaign-query.dto';
import { UpdateCampaignLeadDto } from './dto/update-lead.dto';
import { cleanPhoneNumber } from './utils/phone-cleaner.util';
import { createLogger } from '../../common/services/logger.service';

@Injectable()
export class CampaignLeadService {
  private readonly logger = createLogger('CampaignLeadService');

  constructor(
    @InjectRepository(Campaign, 'data')
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignLead, 'data')
    private readonly leadRepo: Repository<CampaignLead>,
  ) {}

  async addLeads(campaignId: string, dto: AddCampaignLeadsDto): Promise<{ added: number; newTotal: number }> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    let addedCount = 0;
    const entitiesToInsert: Partial<CampaignLead>[] = [];

    for (const leadDto of dto.leads) {
      const { cleaned, chatId } = cleanPhoneNumber(leadDto.phone);
      if (!cleaned || cleaned.length < 7) {
        continue;
      }

      entitiesToInsert.push({
        campaignId,
        phoneNumber: cleaned,
        chatId,
        name: leadDto.name,
        customVariables: leadDto.variables || {},
        status: CampaignLeadStatus.PENDING,
      });
      addedCount++;
    }

    if (entitiesToInsert.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < entitiesToInsert.length; i += chunkSize) {
        const chunk = entitiesToInsert.slice(i, i + chunkSize);
        await this.leadRepo.save(chunk);
      }
    }

    const newTotal = await this.leadRepo.count({ where: { campaignId } });

    return { added: addedCount, newTotal };
  }

  async listLeads(campaignId: string, query: CampaignLeadsQueryDto): Promise<{ items: CampaignLead[]; total: number }> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const qb = this.leadRepo.createQueryBuilder('lead').where('lead.campaignId = :campaignId', { campaignId });

    if (query.status) {
      qb.andWhere('lead.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere('(lead.phoneNumber LIKE :search OR lead.name LIKE :search)', { search: `%${query.search}%` });
    }

    qb.orderBy('lead.createdAt', 'ASC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async updateLead(campaignId: string, leadId: string, dto: UpdateCampaignLeadDto): Promise<CampaignLead> {
    const lead = await this.leadRepo.findOne({ where: { id: leadId, campaignId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found in campaign ${campaignId}`);
    }

    if (dto.name !== undefined) {
      lead.name = dto.name;
    }

    if (dto.customVariables) {
      lead.customVariables = {
        ...(lead.customVariables || {}),
        ...dto.customVariables,
      };
    }

    return this.leadRepo.save(lead);
  }

  async exportCampaignCsv(campaignId: string, stream: NodeJS.WritableStream): Promise<void> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const leads = await this.leadRepo.find({
      where: { campaignId },
      order: { createdAt: 'ASC' },
    });

    const headers = ['Phone Number', 'Name', 'Status', 'Sent At', 'Replied At', 'Error Message'];
    stream.write(headers.join(',') + '\n');

    for (const lead of leads) {
      const row = [
        `"${lead.phoneNumber}"`,
        `"${lead.name || ''}"`,
        `"${lead.status}"`,
        `"${lead.sentAt || ''}"`,
        `"${lead.repliedAt || ''}"`,
        `"${(lead.errorMessage || '').replace(/"/g, '""')}"`,
      ];
      stream.write(row.join(',') + '\n');
    }
  }
}
