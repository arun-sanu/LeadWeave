import { Injectable, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { LeadRecord, LeadStatus } from './entities/lead-record.entity';
import { TriggerLeadDto, LeadTriggerResponseDto } from './dto/trigger-lead.dto';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { HookManager } from '../../core/hooks/hook-manager.service';
import { createLogger } from '../../common/services/logger.service';
import { renderTemplate } from '../../common/utils/template-render';
import { PLUGIN_MESSAGE_PORT, type PluginMessagePort } from '../../core/plugins/plugin-host-ports';
import { ContactService } from '../contact/contact.service';

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'quit', 'optout', 'opt-out'];
const DEFAULT_GREETING = 'Hi {{Name}}! 👋 Thank you for your interest. Are you looking for more details or a quick quote?';
const APOLOGY_NOTE = 'Understood! So sorry to bother you {{Name}}. We have removed you from our contact list. Have a wonderful day ahead! 🙏';
const TIMEOUT_HOURS = 20;

@Injectable()
export class LeadSheetService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('LeadSheetService');
  private sweepTimer?: NodeJS.Timeout;
  private messagePort?: PluginMessagePort;

  constructor(
    @InjectRepository(LeadRecord, 'data')
    private readonly leadRepo: Repository<LeadRecord>,
    private readonly engines: EngineRegistry,
    private readonly hookManager: HookManager,
    @Optional() private readonly contactService?: ContactService,
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  onModuleInit() {
    // 1. Register Hook on incoming messages for STOP opt-out and Reply tracking
    this.hookManager.register(
      'core-lead-sheet',
      'message:received',
      async (ctx: any) => {
        await this.handleInboundHook(ctx.sessionId || '', ctx.data);
        return { continue: true };
      },
      10,
    );

    // 2. Start background sweep timer for 20-hour W-RNR timeouts (runs every 5 mins)
    this.sweepTimer = setInterval(() => {
      this.sweepExpiredTimeouts().catch(err => {
        this.logger.warn('Error in sweepExpiredTimeouts', { error: String(err) });
      });
    }, 5 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
    }
  }

  /**
   * Process a single lead trigger from Google Sheets or LeadWeave UI.
   */
  async processLeadTrigger(dto: TriggerLeadDto): Promise<LeadTriggerResponseDto> {
    const { sessionId, phone, name = 'there', sheetId, rowIndex, sheetCallbackUrl } = dto;
    const digitsOnly = phone.replace(/\D/g, '');
    const neutralChatId = `${digitsOnly}@c.us`;

    const engine = this.engines.get(sessionId);
    if (!engine) {
      return {
        success: false,
        status: 'SESSION_NOT_READY',
        message: `WhatsApp session '${sessionId}' is not active or ready.`,
      };
    }

    // 1. Instant WhatsApp Number Existence Pre-Validation
    let exists = false;
    try {
      exists = await engine.checkNumberExists(digitsOnly);
    } catch {
      // If check fails, default to false for safety
      exists = false;
    }

    if (!exists) {
      const record = this.leadRepo.create({
        sessionId,
        chatId: neutralChatId,
        phoneNumber: phone,
        leadName: name,
        sheetId,
        rowIndex,
        sheetCallbackUrl,
        status: LeadStatus.NOT_ON_WA,
      });
      await this.leadRepo.save(record);
      await this.notifySheetCallback(sheetCallbackUrl, {
        sheetId,
        rowIndex,
        phone,
        status: LeadStatus.NOT_ON_WA,
        updatedAt: new Date().toISOString(),
      });

      return {
        success: false,
        status: LeadStatus.NOT_ON_WA,
        chatId: neutralChatId,
        message: `Phone number ${phone} is not registered on WhatsApp.`,
      };
    }

    // 2. Compose and Send Greeting Message
    const template = dto.greetingTemplate || DEFAULT_GREETING;
    const renderedGreeting = renderTemplate(template, { Name: name, name });

    try {
      await engine.sendTextMessage(neutralChatId, renderedGreeting);
    } catch (err: any) {
      return {
        success: false,
        status: 'SEND_FAILED',
        message: `Failed to send greeting: ${err?.message || String(err)}`,
      };
    }

    // 3. Persist Lead Record & Set 20-Hour Timeout
    const now = new Date();
    const timeoutAt = new Date(now.getTime() + TIMEOUT_HOURS * 60 * 60 * 1000);

    const record = this.leadRepo.create({
      sessionId,
      chatId: neutralChatId,
      phoneNumber: phone,
      leadName: name,
      sheetId,
      rowIndex,
      sheetCallbackUrl,
      status: LeadStatus.GREETING_SENT,
      greetingMessage: renderedGreeting,
      lastSentAt: now,
      timeoutAt,
    });
    const saved = await this.leadRepo.save(record);

    // 4. Update Google Sheet Callback
    await this.notifySheetCallback(sheetCallbackUrl, {
      sheetId,
      rowIndex,
      phone,
      status: LeadStatus.GREETING_SENT,
      sentAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return {
      success: true,
      status: LeadStatus.GREETING_SENT,
      leadId: saved.id,
      chatId: neutralChatId,
      message: `Greeting sent to ${name} (${phone}). 20-hour reply window active.`,
    };
  }

  /**
   * Handle incoming messages: intercept STOP opt-outs or mark as REPLIED.
   */
  async handleInboundHook(sessionId: string, message: any) {
    if (!message || !message.from || message.fromMe) return;

    const fromChatId = message.from;
    const text = (message.body || message.text || '').trim().toLowerCase();

    // Look up active lead record for this sender
    const activeLead = await this.leadRepo.findOne({
      where: { sessionId, chatId: fromChatId },
      order: { createdAt: 'DESC' },
    });

    if (!activeLead) return;

    const isOptOut = OPT_OUT_KEYWORDS.some(k => text === k || text.startsWith(`${k} `));

    if (isOptOut) {
      // 1. Process STOP / Opt-Out
      activeLead.status = LeadStatus.OPT_OUT;
      activeLead.timeoutAt = null;
      await this.leadRepo.save(activeLead);

      // Send warm apology note
      const apologyText = renderTemplate(APOLOGY_NOTE, {
        Name: activeLead.leadName || 'there',
        name: activeLead.leadName || 'there',
      });

      const engine = this.engines.get(sessionId);
      if (engine) {
        try {
          await engine.sendTextMessage(fromChatId, apologyText);
        } catch (err) {
          this.logger.warn('Failed to send opt-out apology note', { error: String(err) });
        }
      }

      // Block contact if service is available
      if (this.contactService) {
        try {
          await this.contactService.blockContact(sessionId, fromChatId);
        } catch (err) {
          this.logger.debug('Could not auto-block opt-out contact', { error: String(err) });
        }
      }

      // Sync to Google Sheet
      await this.notifySheetCallback(activeLead.sheetCallbackUrl, {
        sheetId: activeLead.sheetId,
        rowIndex: activeLead.rowIndex,
        phone: activeLead.phoneNumber,
        status: LeadStatus.OPT_OUT,
        updatedAt: new Date().toISOString(),
      });

      this.logger.log('Lead opted out via STOP keyword', { sessionId, fromChatId });
    } else if (activeLead.status === LeadStatus.GREETING_SENT) {
      // 2. Mark as REPLIED (Cancels 20h timeout)
      activeLead.status = LeadStatus.REPLIED;
      activeLead.repliedAt = new Date();
      activeLead.timeoutAt = null;
      await this.leadRepo.save(activeLead);

      // Sync to Google Sheet
      await this.notifySheetCallback(activeLead.sheetCallbackUrl, {
        sheetId: activeLead.sheetId,
        rowIndex: activeLead.rowIndex,
        phone: activeLead.phoneNumber,
        status: LeadStatus.REPLIED,
        repliedAt: activeLead.repliedAt.toISOString(),
        updatedAt: new Date().toISOString(),
      });

      this.logger.log('Lead replied within window', { sessionId, fromChatId });
    }
  }

  /**
   * Sweep leads that have passed their 20-hour timeout without receiving a reply.
   */
  async sweepExpiredTimeouts() {
    const now = new Date();
    const expiredLeads = await this.leadRepo.find({
      where: {
        status: LeadStatus.GREETING_SENT,
        timeoutAt: LessThanOrEqual(now),
      },
    });

    if (expiredLeads.length === 0) return;

    for (const lead of expiredLeads) {
      lead.status = LeadStatus.W_RNR;
      lead.timeoutAt = null;
      await this.leadRepo.save(lead);

      // Notify Google Sheet of W-RNR transition
      await this.notifySheetCallback(lead.sheetCallbackUrl, {
        sheetId: lead.sheetId,
        rowIndex: lead.rowIndex,
        phone: lead.phoneNumber,
        status: LeadStatus.W_RNR,
        updatedAt: new Date().toISOString(),
      });

      this.logger.log(`Marked lead as ${LeadStatus.W_RNR} (20h timeout elapsed)`, {
        leadId: lead.id,
        phone: lead.phoneNumber,
      });
    }
  }

  /**
   * List tracked leads with optional session filter.
   */
  async listLeads(sessionId?: string, limit = 100): Promise<LeadRecord[]> {
    const where = sessionId ? { sessionId } : {};
    return this.leadRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 500),
    });
  }

  /**
   * POST back to Google Apps Script Webhook URL to update spreadsheet cell values.
   */
  private async notifySheetCallback(url: string | undefined, payload: Record<string, unknown>) {
    if (!url || !/^https?:\/\//i.test(url)) return;

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      this.logger.warn('Failed to call Google Sheet webhook callback', { url, error: String(err) });
    }
  }

  /**
   * Generate ready-to-paste Google Apps Script code for customers to add to their spreadsheet.
   */
  getAppsScriptTemplate(serverBaseUrl: string, defaultSessionId: string): string {
    return `/**
 * LeadWeave WhatsApp CRM - Google Sheets Automation Script
 * Paste this into Google Sheets: Extensions -> Apps Script
 */

const LEADWEAVE_SERVER_URL = "${serverBaseUrl}";
const SESSION_ID = "${defaultSessionId}";

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('💬 LeadWeave WhatsApp')
    .addItem('🚀 Send Greeting to Selected Row', 'sendGreetingToActiveRow')
    .addItem('⚡ Batch Send to All New Leads', 'batchSendNewLeads')
    .addToUi();
}

function sendGreetingToActiveRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const row = sheet.getActiveCell().getRow();
  if (row <= 1) {
    SpreadsheetApp.getUi().alert('Please select a data row (not headers).');
    return;
  }
  processLeadRow(sheet, row);
}

function batchSendNewLeads() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const status = String(data[i][2] || '').trim(); // Column C = Status
    if (!status || status === 'NEW' || status === 'PENDING') {
      processLeadRow(sheet, i + 1);
      count++;
      Utilities.sleep(4000); // 4s anti-ban pacing between rows
    }
  }

  SpreadsheetApp.getUi().alert('Dispatched greetings to ' + count + ' leads!');
}

function processLeadRow(sheet, row) {
  const phone = String(sheet.getRange(row, 1).getValue()).trim(); // Column A = Phone
  const name = String(sheet.getRange(row, 2).getValue() || 'there').trim(); // Column B = Name

  if (!phone) return;

  const scriptUrl = ScriptApp.getService().getUrl();
  const payload = {
    sessionId: SESSION_ID,
    phone: phone,
    name: name,
    rowIndex: row,
    sheetCallbackUrl: scriptUrl
  };

  try {
    const response = UrlFetchApp.fetch(LEADWEAVE_SERVER_URL + '/api/lead-sheets/trigger-lead', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const resJson = JSON.parse(response.getContentText());
    if (resJson.status) {
      sheet.getRange(row, 3).setValue(resJson.status); // Column C = Status
      sheet.getRange(row, 4).setValue(new Date());     // Column D = Timestamp
    }
  } catch (err) {
    sheet.getRange(row, 3).setValue('ERROR');
  }
}

// Inbound Webhook Callback from LeadWeave when status changes (REPLIED, OPT_OUT, W-RNR)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.rowIndex && data.status) {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      sheet.getRange(data.rowIndex, 3).setValue(data.status); // Column C
      sheet.getRange(data.rowIndex, 4).setValue(new Date());   // Column D
    }
    return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
  }
}
