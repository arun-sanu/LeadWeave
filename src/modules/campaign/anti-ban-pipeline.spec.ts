import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CampaignService } from './campaign.service';
import { Campaign, CampaignStatus } from './entities/campaign.entity';
import { CampaignLead, CampaignLeadStatus } from './entities/campaign-lead.entity';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { HookManager } from '../../core/hooks/hook-manager.service';
import { SendPacingService, SEND_PACING_LIMITED } from '../message/send-pacing.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as humanJitter from '../../common/utils/human-jitter';

describe('Anti-Ban Pacing & Delay Pipeline Integration', () => {
  let service: CampaignService;
  let mockCampaignRepo: any;
  let mockLeadRepo: any;
  let mockEngineRegistry: any;
  let mockHookManager: any;
  let mockPacingService: any;
  let mockEngine: any;

  beforeEach(async () => {
    mockEngine = {
      checkNumberExists: jest.fn().mockResolvedValue(true),
      sendTextMessage: jest.fn().mockResolvedValue({ id: 'wa-msg-100', timestamp: 123456789 }),
      sendImageMessage: jest.fn().mockResolvedValue({ id: 'wa-msg-101', timestamp: 123456789 }),
      sendChatState: jest.fn().mockResolvedValue(undefined),
    };

    mockEngineRegistry = {
      get: jest.fn().mockReturnValue(mockEngine),
    };

    mockHookManager = {
      register: jest.fn(),
      execute: jest.fn().mockResolvedValue({ continue: true }),
    };

    mockPacingService = {
      assertSendAllowed: jest.fn().mockResolvedValue(undefined),
      recordSendSuccess: jest.fn(),
      recordSendFailure: jest.fn(),
    };

    mockCampaignRepo = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'camp-1' })),
      save: jest.fn().mockImplementation((camp) => Promise.resolve(camp)),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockLeadRepo = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'lead-1' })),
      save: jest.fn().mockImplementation((lead) => Promise.resolve(lead)),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
        { provide: getRepositoryToken(Campaign, 'data'), useValue: mockCampaignRepo },
        { provide: getRepositoryToken(CampaignLead, 'data'), useValue: mockLeadRepo },
        { provide: EngineRegistry, useValue: mockEngineRegistry },
        { provide: HookManager, useValue: mockHookManager },
        { provide: SendPacingService, useValue: mockPacingService },
      ],
    }).compile();

    service = module.get<CampaignService>(CampaignService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Anti-Ban Pacing Governor Integration', () => {
    it('automatically PAUSES campaign and preserves pending leads when pacing governor limits sends (daily cap / breaker open)', async () => {
      const camp: Campaign = {
        id: 'camp-pacing-1',
        name: 'Test Paced Campaign',
        status: CampaignStatus.RUNNING,
        template: 'Hello {{name}}',
        sessionIds: ['sess-1'],
        pacing: { minDelayMs: 1, maxDelayMs: 2, simulateTyping: false },
        stats: { total: 2, pending: 2, sent: 0, delivered: 0, read: 0, replied: 0, optOut: 0, failed: 0, responseRate: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const lead1: CampaignLead = {
        id: 'lead-1',
        campaignId: 'camp-pacing-1',
        sessionId: 'sess-1',
        phoneNumber: '1234567890',
        chatId: '1234567890@c.us',
        status: CampaignLeadStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCampaignRepo.findOne.mockResolvedValue(camp);
      mockLeadRepo.find.mockResolvedValueOnce([lead1]).mockResolvedValue([]);
      mockLeadRepo.count.mockResolvedValue(1);

      // Pacing governor throws 429 SEND_PACING_LIMITED
      const pacingError = new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'Daily send allowance reached for a session 0 day(s) old',
          code: SEND_PACING_LIMITED,
          retryAfterSeconds: 3600,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
      mockPacingService.assertSendAllowed.mockRejectedValueOnce(pacingError);

      await (service as any).dispatchCampaignLeads('camp-pacing-1');

      // Campaign must be automatically PAUSED to protect the account
      expect(mockCampaignRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: CampaignStatus.PAUSED }),
      );

      // Engine sendTextMessage must NOT have been called
      expect(mockEngine.sendTextMessage).not.toHaveBeenCalled();

      // Lead must remain PENDING so it is not permanently burned to FAILED
      expect(lead1.status).toBe(CampaignLeadStatus.PENDING);
    });

    it('records breaker success on successful message delivery', async () => {
      const camp: Campaign = {
        id: 'camp-success-1',
        name: 'Success Campaign',
        status: CampaignStatus.RUNNING,
        template: 'Hello {{name}}',
        sessionIds: ['sess-1'],
        pacing: { minDelayMs: 1, maxDelayMs: 2, simulateTyping: false },
        stats: { total: 1, pending: 1, sent: 0, delivered: 0, read: 0, replied: 0, optOut: 0, failed: 0, responseRate: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const lead1: CampaignLead = {
        id: 'lead-1',
        campaignId: 'camp-success-1',
        sessionId: 'sess-1',
        phoneNumber: '1234567890',
        chatId: '1234567890@c.us',
        status: CampaignLeadStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCampaignRepo.findOne.mockResolvedValue(camp);
      mockLeadRepo.find.mockResolvedValueOnce([lead1]).mockResolvedValue([]);
      mockLeadRepo.count.mockResolvedValue(0);

      await (service as any).dispatchCampaignLeads(camp.id);

      expect(mockPacingService.assertSendAllowed).toHaveBeenCalledWith('sess-1', '1234567890@c.us');
      expect(mockEngine.sendTextMessage).toHaveBeenCalledWith('1234567890@c.us', 'Hello there');
      expect(mockPacingService.recordSendSuccess).toHaveBeenCalledWith('sess-1');
      expect(lead1.status).toBe(CampaignLeadStatus.SENT);
    });

    it('records breaker failure when engine throws a failure that counts toward the breaker', async () => {
      const camp: Campaign = {
        id: 'camp-fail-1',
        name: 'Fail Campaign',
        status: CampaignStatus.RUNNING,
        template: 'Hello',
        sessionIds: ['sess-1'],
        pacing: { minDelayMs: 1, maxDelayMs: 2, simulateTyping: false },
        stats: { total: 1, pending: 1, sent: 0, delivered: 0, read: 0, replied: 0, optOut: 0, failed: 0, responseRate: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const lead1: CampaignLead = {
        id: 'lead-1',
        campaignId: 'camp-fail-1',
        sessionId: 'sess-1',
        phoneNumber: '1234567890',
        chatId: '1234567890@c.us',
        status: CampaignLeadStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCampaignRepo.findOne.mockResolvedValue(camp);
      mockLeadRepo.find.mockResolvedValueOnce([lead1]).mockResolvedValue([]);
      mockLeadRepo.count.mockResolvedValue(0);

      mockEngine.sendTextMessage.mockRejectedValueOnce(new Error('Evaluation failed: rate limit'));

      await (service as any).dispatchCampaignLeads(camp.id);

      expect(mockPacingService.recordSendFailure).toHaveBeenCalledWith('sess-1');
      expect(lead1.status).toBe(CampaignLeadStatus.FAILED);
      expect(lead1.errorMessage).toContain('rate limit');
    });
  });

  describe('Presence Failure Resilience', () => {
    it('executes human typing delay even if sendChatState throws', async () => {
      const camp: Campaign = {
        id: 'camp-typing-1',
        name: 'Typing Resilience Campaign',
        status: CampaignStatus.RUNNING,
        template: 'Test typing presence error',
        sessionIds: ['sess-1'],
        pacing: { minDelayMs: 1, maxDelayMs: 2, simulateTyping: true },
        stats: { total: 1, pending: 1, sent: 0, delivered: 0, read: 0, replied: 0, optOut: 0, failed: 0, responseRate: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const lead1: CampaignLead = {
        id: 'lead-1',
        campaignId: 'camp-typing-1',
        sessionId: 'sess-1',
        phoneNumber: '1234567890',
        chatId: '1234567890@c.us',
        status: CampaignLeadStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCampaignRepo.findOne.mockResolvedValue(camp);
      mockLeadRepo.find.mockResolvedValueOnce([lead1]).mockResolvedValue([]);
      mockLeadRepo.count.mockResolvedValue(0);

      // Presence fails with socket error
      mockEngine.sendChatState.mockRejectedValueOnce(new Error('Socket disconnected during presence'));

      const typingSpy = jest.spyOn(humanJitter, 'calculateTypingDuration').mockReturnValue(5);

      await (service as any).dispatchCampaignLeads(camp.id);

      // calculateTypingDuration must have been called despite sendChatState rejection!
      expect(typingSpy).toHaveBeenCalled();
      expect(mockEngine.sendTextMessage).toHaveBeenCalled();
      expect(lead1.status).toBe(CampaignLeadStatus.SENT);
    });
  });

  describe('Dynamic Number Routing & Session Failover', () => {
    it('automatically fails over to an active session when the assigned session is offline', async () => {
      const camp: Campaign = {
        id: 'camp-failover-1',
        name: 'Failover Campaign',
        status: CampaignStatus.RUNNING,
        template: 'Multi-session test',
        sessionIds: ['sess-offline', 'sess-online'],
        pacing: { minDelayMs: 1, maxDelayMs: 2, simulateTyping: false },
        stats: { total: 1, pending: 1, sent: 0, delivered: 0, read: 0, replied: 0, optOut: 0, failed: 0, responseRate: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const lead1: CampaignLead = {
        id: 'lead-1',
        campaignId: 'camp-failover-1',
        sessionId: 'sess-offline',
        phoneNumber: '1234567890',
        chatId: '1234567890@c.us',
        status: CampaignLeadStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockEngineRegistry.get.mockImplementation((id: string) => {
        if (id === 'sess-online') return mockEngine;
        return undefined; // sess-offline is disconnected
      });

      mockCampaignRepo.findOne.mockResolvedValue(camp);
      mockLeadRepo.find.mockResolvedValueOnce([lead1]).mockResolvedValue([]);
      mockLeadRepo.count.mockResolvedValue(0);

      await (service as any).dispatchCampaignLeads(camp.id);
      expect(lead1.sessionId).toBe('sess-online');
      expect(lead1.status).toBe(CampaignLeadStatus.SENT);
    });

    it('pauses campaign when ALL sessions in campaign are offline to avoid burning leads', async () => {
      const camp: Campaign = {
        id: 'camp-all-offline',
        name: 'All Offline Campaign',
        status: CampaignStatus.RUNNING,
        template: 'Offline test',
        sessionIds: ['sess-1'],
        pacing: { minDelayMs: 1, maxDelayMs: 2, simulateTyping: false },
        stats: { total: 1, pending: 1, sent: 0, delivered: 0, read: 0, replied: 0, optOut: 0, failed: 0, responseRate: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const lead1: CampaignLead = {
        id: 'lead-1',
        campaignId: 'camp-all-offline',
        sessionId: 'sess-1',
        phoneNumber: '1234567890',
        chatId: '1234567890@c.us',
        status: CampaignLeadStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockEngineRegistry.get.mockReturnValue(undefined); // all offline

      mockCampaignRepo.findOne.mockResolvedValue(camp);
      mockLeadRepo.find.mockResolvedValueOnce([lead1]).mockResolvedValue([]);
      mockLeadRepo.count.mockResolvedValue(1);

      await (service as any).dispatchCampaignLeads(camp.id);

      expect(mockCampaignRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: CampaignStatus.PAUSED }),
      );
    });
  });

  describe('Batch Breather & Delay Continuity Across Chunks', () => {
    it('triggers batch breather on the 10th dispatch across multiple chunk batches', async () => {
      const camp: Campaign = {
        id: 'camp-breather-1',
        name: 'Breather Test Campaign',
        status: CampaignStatus.RUNNING,
        template: 'Test message',
        sessionIds: ['sess-1'],
        pacing: { minDelayMs: 1, maxDelayMs: 2, simulateTyping: false },
        stats: { total: 11, pending: 11, sent: 0, delivered: 0, read: 0, replied: 0, optOut: 0, failed: 0, responseRate: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const makeLead = (id: number): CampaignLead => ({
        id: `lead-${id}`,
        campaignId: 'camp-breather-1',
        sessionId: 'sess-1',
        phoneNumber: `123456789${id}`,
        chatId: `123456789${id}@c.us`,
        status: CampaignLeadStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Chunk 1: 6 leads, Chunk 2: 5 leads (total 11)
      const chunk1 = [makeLead(1), makeLead(2), makeLead(3), makeLead(4), makeLead(5), makeLead(6)];
      const chunk2 = [makeLead(7), makeLead(8), makeLead(9), makeLead(10), makeLead(11)];

      mockCampaignRepo.findOne.mockResolvedValue(camp);

      let pendingCount = 5;
      mockLeadRepo.count.mockImplementation(async (opts?: any) => {
        if (opts?.where?.status === CampaignLeadStatus.PENDING) {
          return pendingCount;
        }
        return 0;
      });

      mockLeadRepo.find
        .mockResolvedValueOnce(chunk1)
        .mockImplementationOnce(async () => {
          pendingCount = 0; // chunk 2 is now loaded, no further pending leads after chunk 2
          return chunk2;
        })
        .mockResolvedValue([]);

      jest.spyOn(humanJitter, 'calculateHumanDelay').mockReturnValue(1);
      const breatherSpy = jest.spyOn(humanJitter, 'calculateBatchBreather').mockImplementation((count, batchSize) => {
        return count > 0 && count % batchSize === 0 ? 1 : 0;
      });

      await (service as any).dispatchCampaignLeads(camp.id);

      // Verify calculateBatchBreather was called across both chunks and triggered on the 10th lead
      expect(breatherSpy).toHaveBeenCalledTimes(10);
      expect(breatherSpy).toHaveBeenCalledWith(10, 10, 12000, 25000);
    });

    it('does not delay after the final lead when 0 pending leads remain', async () => {
      const camp: Campaign = {
        id: 'camp-last-lead',
        name: 'Single Lead Campaign',
        status: CampaignStatus.RUNNING,
        template: 'Test single lead',
        sessionIds: ['sess-1'],
        pacing: { minDelayMs: 5000, maxDelayMs: 10000, simulateTyping: false },
        stats: { total: 1, pending: 1, sent: 0, delivered: 0, read: 0, replied: 0, optOut: 0, failed: 0, responseRate: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const lead1: CampaignLead = {
        id: 'lead-single',
        campaignId: 'camp-last-lead',
        sessionId: 'sess-1',
        phoneNumber: '1234567890',
        chatId: '1234567890@c.us',
        status: CampaignLeadStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCampaignRepo.findOne.mockResolvedValue(camp);
      mockLeadRepo.find.mockResolvedValueOnce([lead1]).mockResolvedValue([]);
      mockLeadRepo.count.mockResolvedValue(0);

      const delaySpy = jest.spyOn(humanJitter, 'calculateHumanDelay');

      await (service as any).dispatchCampaignLeads(camp.id);

      // calculateHumanDelay should NOT be called after the last lead!
      expect(delaySpy).not.toHaveBeenCalled();
      expect(lead1.status).toBe(CampaignLeadStatus.SENT);
    });
  });
});
