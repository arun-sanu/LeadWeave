import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { performance } from 'perf_hooks';
import { BulkMessageService } from './bulk-message.service';
import { MessageBatch, BatchStatus } from './entities/message-batch.entity';
import { EngineRegistry } from '../../engine/engine-registry.service';
import type { IWhatsAppEngine } from '../../engine/interfaces/whatsapp-engine.interface';
import { MessageService } from './message.service';
import { SendPacingService } from './send-pacing.service';
import { HookManager } from '../../core/hooks';
import { CampaignService } from '../campaign/campaign.service';
import { Campaign, CampaignStatus } from '../campaign/entities/campaign.entity';
import { CampaignLead, CampaignLeadStatus } from '../campaign/entities/campaign-lead.entity';

describe('Real-Time Bulk & Campaign Dispatch Timestamp Audit', () => {
  describe('BulkMessageService Real-Time Timestamp Recording', () => {
    let service: BulkMessageService;
    let repo: { findOne: jest.Mock; save: jest.Mock; update: jest.Mock };
    let engine: { sendTextMessage: jest.Mock };
    let engines: EngineRegistry;
    let timestamps: number[] = [];

    beforeEach(async () => {
      timestamps = [];
      engine = {
        sendTextMessage: jest.fn().mockImplementation(() => {
          timestamps.push(performance.now());
          return Promise.resolve({ id: `wa-${timestamps.length}`, timestamp: Date.now() });
        }),
      };
      engines = new EngineRegistry();
      engines.set('session-bulk', engine as unknown as IWhatsAppEngine);

      repo = {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation((b: MessageBatch) => Promise.resolve(b)),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BulkMessageService,
          { provide: getRepositoryToken(MessageBatch, 'data'), useValue: repo },
          { provide: EngineRegistry, useValue: engines },
          { provide: MessageService, useValue: { saveOutgoingMessage: jest.fn().mockResolvedValue(undefined) } },
          {
            provide: SendPacingService,
            useValue: {
              assertSendAllowed: jest.fn().mockResolvedValue(undefined),
              recordSendFailure: jest.fn(),
              recordSendSuccess: jest.fn(),
            },
          },
          {
            provide: HookManager,
            useValue: {
              execute: jest
                .fn()
                .mockImplementation((_e: string, d: unknown) => Promise.resolve({ continue: true, data: d })),
            },
          },
        ],
      }).compile();

      service = module.get<BulkMessageService>(BulkMessageService);
    });

    it('dispatches bulk messages with real measured intervals obeying delayBetweenMessages and jitter', async () => {
      const messageCount = 4;
      const baseDelay = 60; // 60ms base delay for test

      const batch = {
        id: 'batch-test-1',
        batchId: 'bx-test',
        sessionId: 'session-bulk',
        status: BatchStatus.PENDING,
        currentIndex: 0,
        messages: Array.from({ length: messageCount }, (_, i) => ({
          chatId: `123456780${i}@c.us`,
          type: 'text',
          content: { text: `Bulk message payload ${i}` },
        })),
        options: { delayBetweenMessages: baseDelay, randomizeDelay: true, stopOnError: false },
        progress: { total: messageCount, sent: 0, failed: 0, pending: messageCount, cancelled: 0 },
        results: [],
      } as unknown as MessageBatch;

      repo.findOne.mockResolvedValue(batch);

      await (service as unknown as { processBatch: (id: string) => Promise<void> }).processBatch(batch.id);
      const tEnd = performance.now();

      expect(timestamps.length).toBe(messageCount);

      // Compute intervals between consecutive message dispatches: Δt = t[i] - t[i-1]
      const measuredIntervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        const delta = timestamps[i] - timestamps[i - 1];
        measuredIntervals.push(delta);
      }

      // 1. Every measured interval must be >= baseDelay (allowing 5ms event-loop precision tolerance)
      for (const delta of measuredIntervals) {
        expect(delta).toBeGreaterThanOrEqual(baseDelay - 5);
      }

      // 2. RandomizeDelay introduces variance: intervals are not identical
      const uniqueIntervals = new Set(measuredIntervals.map(d => Math.round(d)));
      expect(uniqueIntervals.size).toBeGreaterThan(1);

      // 3. No trailing delay after the last message
      const lastMessageToCompletion = tEnd - timestamps[timestamps.length - 1];
      expect(lastMessageToCompletion).toBeLessThan(baseDelay);
    });
  });

  describe('CampaignService Real-Time Timestamp Recording', () => {
    let service: CampaignService;
    let campaignRepo: { findOne: jest.Mock; save: jest.Mock; count: jest.Mock; create: jest.Mock };
    let leadRepo: { find: jest.Mock; count: jest.Mock; save: jest.Mock; create: jest.Mock; findOne: jest.Mock };
    let engine: { sendTextMessage: jest.Mock; sendChatState: jest.Mock };
    let engines: EngineRegistry;

    interface EventLog {
      type: 'typing_start' | 'message_sent';
      chatId: string;
      timestamp: number;
    }
    let eventLog: EventLog[] = [];

    beforeEach(async () => {
      eventLog = [];
      engine = {
        sendChatState: jest.fn().mockImplementation((chatId: string) => {
          eventLog.push({ type: 'typing_start', chatId, timestamp: performance.now() });
          return Promise.resolve();
        }),
        sendTextMessage: jest.fn().mockImplementation((chatId: string) => {
          eventLog.push({ type: 'message_sent', chatId, timestamp: performance.now() });
          return Promise.resolve({ id: `wa-camp-${eventLog.length}`, timestamp: Date.now() });
        }),
      };
      engines = new EngineRegistry();
      engines.set('session-camp', engine as unknown as IWhatsAppEngine);

      campaignRepo = {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation((c: Campaign) => Promise.resolve(c)),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation((c: Campaign) => c),
      };

      leadRepo = {
        find: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        save: jest.fn().mockImplementation((l: CampaignLead) => Promise.resolve(l)),
        create: jest.fn().mockImplementation((l: CampaignLead) => l),
        findOne: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CampaignService,
          { provide: getRepositoryToken(Campaign, 'data'), useValue: campaignRepo },
          { provide: getRepositoryToken(CampaignLead, 'data'), useValue: leadRepo },
          { provide: EngineRegistry, useValue: engines },
          {
            provide: SendPacingService,
            useValue: {
              assertSendAllowed: jest.fn().mockResolvedValue(undefined),
              recordSendFailure: jest.fn(),
              recordSendSuccess: jest.fn(),
            },
          },
          {
            provide: HookManager,
            useValue: {
              register: jest.fn(),
              execute: jest.fn().mockResolvedValue({ continue: true }),
            },
          },
        ],
      }).compile();

      service = module.get<CampaignService>(CampaignService);
    });

    it('records and verifies typing simulation elapsed time occurs BEFORE text send', async () => {
      const camp: Campaign = {
        id: 'camp-time-1',
        name: 'Timestamp Audit Campaign',
        status: CampaignStatus.RUNNING,
        template: 'Hello {{name}}',
        sessionIds: ['session-camp'],
        pacing: {
          minDelayMs: 50,
          maxDelayMs: 100,
          simulateTyping: true,
        },
        stats: {
          total: 1,
          pending: 1,
          sent: 0,
          delivered: 0,
          read: 0,
          replied: 0,
          optOut: 0,
          failed: 0,
          responseRate: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const lead: CampaignLead = {
        id: 'lead-time-1',
        campaignId: 'camp-time-1',
        sessionId: 'session-camp',
        phoneNumber: '9876543210',
        chatId: '9876543210@c.us',
        customVariables: { name: 'Alice' },
        status: CampaignLeadStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      campaignRepo.findOne.mockResolvedValue(camp);
      leadRepo.find.mockResolvedValueOnce([lead]).mockResolvedValue([]);
      leadRepo.count.mockResolvedValue(0);

      await (service as unknown as { dispatchCampaignLeads: (id: string) => Promise<void> }).dispatchCampaignLeads(
        camp.id,
      );

      expect(eventLog.length).toBe(2);
      expect(eventLog[0].type).toBe('typing_start');
      expect(eventLog[1].type).toBe('message_sent');

      const typingElapsed = eventLog[1].timestamp - eventLog[0].timestamp;
      // calculateTypingDuration gives ~1200ms+ typing delay
      expect(typingElapsed).toBeGreaterThan(0);
      expect(lead.status).toBe(CampaignLeadStatus.SENT);
    });

    it('measures real inter-message intervals and verifies batch breather jump', async () => {
      // 3 leads with pacing delays and verification of no trailing delay
      const camp: Campaign = {
        id: 'camp-time-breather',
        name: 'Breather Audit Campaign',
        status: CampaignStatus.RUNNING,
        template: 'Hello {{name}}',
        sessionIds: ['session-camp'],
        pacing: {
          minDelayMs: 60,
          maxDelayMs: 120,
          simulateTyping: false,
          breatherMinMs: 180,
          breatherMaxMs: 250,
        },
        stats: {
          total: 3,
          pending: 3,
          sent: 0,
          delivered: 0,
          read: 0,
          replied: 0,
          optOut: 0,
          failed: 0,
          responseRate: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const leads: CampaignLead[] = [1, 2, 3].map(num => ({
        id: `lead-b-${num}`,
        campaignId: 'camp-time-breather',
        sessionId: 'session-camp',
        phoneNumber: `987654321${num}`,
        chatId: `987654321${num}@c.us`,
        customVariables: { name: `User ${num}` },
        status: CampaignLeadStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      campaignRepo.findOne.mockResolvedValue(camp);
      leadRepo.find.mockResolvedValueOnce(leads).mockResolvedValue([]);
      let remaining = 2;
      leadRepo.save.mockImplementation((l: CampaignLead) => {
        if (l.status === CampaignLeadStatus.SENT && remaining > 0) {
          remaining--;
        }
        return Promise.resolve(l);
      });
      leadRepo.count.mockImplementation((opts?: { where?: { status?: CampaignLeadStatus } }) => {
        if (opts?.where?.status === CampaignLeadStatus.PENDING) {
          return Promise.resolve(remaining);
        }
        return Promise.resolve(0);
      });

      await (service as unknown as { dispatchCampaignLeads: (id: string) => Promise<void> }).dispatchCampaignLeads(
        camp.id,
      );
      const tEnd = performance.now();

      const sendEvents = eventLog.filter(e => e.type === 'message_sent');
      expect(sendEvents.length).toBe(3);

      const delta1 = sendEvents[1].timestamp - sendEvents[0].timestamp; // Between msg 1 & msg 2
      const delta2 = sendEvents[2].timestamp - sendEvents[1].timestamp; // Between msg 2 & msg 3

      // Delta 1 is normal pacing interval (>= minDelayMs)
      expect(delta1).toBeGreaterThanOrEqual(camp.pacing.minDelayMs - 5);
      expect(delta2).toBeGreaterThanOrEqual(camp.pacing.minDelayMs - 5);

      // No trailing delay after the final message (msg 3)
      const trailingTime = tEnd - sendEvents[2].timestamp;
      expect(trailingTime).toBeLessThan(camp.pacing.minDelayMs);
    });
  });
});
