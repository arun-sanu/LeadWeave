import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CampaignService } from './campaign.service';
import { Campaign, CampaignStatus } from './entities/campaign.entity';
import { CampaignLead, CampaignLeadStatus } from './entities/campaign-lead.entity';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { HookManager } from '../../core/hooks/hook-manager.service';

describe('CampaignService', () => {
  let service: CampaignService;
  let mockCampaignRepo: any;
  let mockLeadRepo: any;
  let mockEngineRegistry: any;
  let mockHookManager: any;

  beforeEach(async () => {
    mockCampaignRepo = {
      create: jest.fn(entity => ({ id: 'camp-123', ...entity })),
      save: jest.fn(async entity => entity),
      update: jest.fn(async () => ({ affected: 1 })),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
    };

    mockLeadRepo = {
      create: jest.fn(entity => ({ id: 'lead-123', ...entity })),
      save: jest.fn(async entity => entity),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockEngineRegistry = {
      get: jest.fn(),
    };

    mockHookManager = {
      register: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
        {
          provide: getRepositoryToken(Campaign, 'data'),
          useValue: mockCampaignRepo,
        },
        {
          provide: getRepositoryToken(CampaignLead, 'data'),
          useValue: mockLeadRepo,
        },
        {
          provide: EngineRegistry,
          useValue: mockEngineRegistry,
        },
        {
          provide: HookManager,
          useValue: mockHookManager,
        },
      ],
    }).compile();

    service = module.get<CampaignService>(CampaignService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCampaign', () => {
    it('should create a draft campaign with leads and calculate initial stats', async () => {
      const dto: any = {
        name: 'September Promo',
        sessionIds: ['session_1'],
        template: 'Hi {{name}}, check our offer!',
        leads: [
          { phone: '+1234567890', name: 'Alice', variables: { plan: 'Pro' } },
          { phone: '+9876543210', name: 'Bob', variables: { plan: 'Enterprise' } },
        ],
      };

      const result = await service.createCampaign(dto);

      expect(mockCampaignRepo.create).toHaveBeenCalled();
      expect(mockCampaignRepo.save).toHaveBeenCalled();
      expect(mockLeadRepo.create).toHaveBeenCalledTimes(2);
      expect(mockLeadRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('September Promo');
      expect(result.status).toBe(CampaignStatus.DRAFT);
      expect(result.stats.total).toBe(2);
      expect(result.stats.pending).toBe(2);
    });
  });

  describe('handleInboundHook', () => {
    it('should mark lead as REPLIED on incoming response and update stats', async () => {
      const mockLead = {
        id: 'lead-1',
        campaignId: 'camp-123',
        chatId: '1234567890@c.us',
        status: CampaignLeadStatus.SENT,
        sentAt: new Date(),
        firstReplySnippet: null,
      };

      mockLeadRepo.findOne.mockResolvedValue(mockLead);
      mockCampaignRepo.findOne.mockResolvedValue({
        id: 'camp-123',
        stats: {
          total: 1,
          pending: 0,
          sent: 1,
          delivered: 0,
          read: 0,
          replied: 0,
          optOut: 0,
          failed: 0,
          responseRate: 0,
        },
      });
      mockLeadRepo.count.mockResolvedValue(1);

      await service.handleInboundHook('session_1', {
        from: '1234567890@c.us',
        body: 'Yes, please send more info!',
      });

      expect(mockLead.status).toBe(CampaignLeadStatus.REPLIED);
      expect(mockLead.firstReplySnippet).toBe('Yes, please send more info!');
      expect(mockLeadRepo.save).toHaveBeenCalledWith(mockLead);
    });

    it('should mark lead as OPT_OUT on "STOP" keyword response', async () => {
      const mockLead = {
        id: 'lead-2',
        campaignId: 'camp-123',
        chatId: '9876543210@c.us',
        status: CampaignLeadStatus.SENT,
        sentAt: new Date(),
        firstReplySnippet: null,
      };

      mockLeadRepo.findOne.mockResolvedValue(mockLead);
      mockCampaignRepo.findOne.mockResolvedValue({
        id: 'camp-123',
        stats: {
          total: 1,
          pending: 0,
          sent: 1,
          delivered: 0,
          read: 0,
          replied: 0,
          optOut: 0,
          failed: 0,
          responseRate: 0,
        },
      });
      mockLeadRepo.count.mockResolvedValue(1);

      await service.handleInboundHook('session_1', {
        from: '9876543210@c.us',
        body: 'STOP',
      });

      expect(mockLead.status).toBe(CampaignLeadStatus.OPT_OUT);
      expect(mockLead.firstReplySnippet).toBe('STOP');
      expect(mockLeadRepo.save).toHaveBeenCalledWith(mockLead);
    });
  });

  describe('handleAckHook', () => {
    it('should update lead deliverability status on WhatsApp ACK', async () => {
      const mockLead = {
        id: 'lead-3',
        campaignId: 'camp-123',
        waMessageId: 'wam-999',
        status: CampaignLeadStatus.SENT,
        deliveredAt: null,
      };

      mockLeadRepo.findOne.mockResolvedValue(mockLead);
      mockCampaignRepo.findOne.mockResolvedValue({ id: 'camp-123', stats: {} });
      mockLeadRepo.count.mockResolvedValue(1);

      await service.handleAckHook('session_1', {
        id: 'wam-999',
        ack: 3, // Delivered
      });

      expect(mockLead.status).toBe(CampaignLeadStatus.DELIVERED);
      expect(mockLead.deliveredAt).toBeDefined();
    });
  });

  describe('sweepScheduledCampaigns', () => {
    it('fires scheduled campaigns whose time has arrived', async () => {
      const scheduledCampaign = { id: 'camp-scheduled-1', name: 'Scheduled Camp', status: CampaignStatus.SCHEDULED };
      mockCampaignRepo.find.mockImplementation((query: any) => {
        if (query?.where?.status === CampaignStatus.SCHEDULED) {
          return Promise.resolve([scheduledCampaign]);
        }
        return Promise.resolve([]);
      });
      mockCampaignRepo.findOne.mockResolvedValue(scheduledCampaign);
      mockLeadRepo.find.mockResolvedValue([]);
      mockLeadRepo.count.mockResolvedValue(0);

      await service.sweepScheduledCampaigns();

      expect(mockCampaignRepo.update).toHaveBeenCalledWith(
        { id: 'camp-scheduled-1', status: CampaignStatus.SCHEDULED },
        expect.objectContaining({ status: CampaignStatus.RUNNING }),
      );
    });

    it('auto-resumes orphaned running campaigns with pending leads', async () => {
      const runningCampaign = { id: 'camp-orphaned-1', name: 'Orphaned Camp', status: CampaignStatus.RUNNING };
      mockCampaignRepo.find.mockImplementation((query: any) => {
        if (query?.where?.status === CampaignStatus.RUNNING) {
          return Promise.resolve([runningCampaign]);
        }
        return Promise.resolve([]);
      });
      mockCampaignRepo.findOne.mockResolvedValue(runningCampaign);
      mockLeadRepo.count.mockResolvedValue(5);
      mockLeadRepo.find.mockResolvedValue([]);

      await service.sweepScheduledCampaigns();

      expect(mockLeadRepo.count).toHaveBeenCalled();
    });
  });

  describe('updateCampaign', () => {
    it('should update campaign fields for paused, draft, or scheduled campaigns', async () => {
      const mockCampaign = {
        id: 'camp-100',
        name: 'Old Name',
        template: 'Old Template',
        sessionIds: ['session_1'],
        status: CampaignStatus.PAUSED,
        pacing: { minDelayMs: 3000, maxDelayMs: 6000, simulateTyping: true },
      };

      mockCampaignRepo.findOne.mockResolvedValue(mockCampaign);
      mockLeadRepo.find.mockResolvedValue([]);

      const updated = await service.updateCampaign('camp-100', {
        name: 'New Name',
        template: 'New Template',
        pacing: { minDelayMs: 2000, maxDelayMs: 5000, simulateTyping: false },
      });

      expect(updated.name).toBe('New Name');
      expect(updated.template).toBe('New Template');
      expect(updated.pacing.minDelayMs).toBe(2000);
      expect(mockCampaignRepo.save).toHaveBeenCalledWith(mockCampaign);
    });

    it('should reject editing a campaign in RUNNING status', async () => {
      const mockCampaign = {
        id: 'camp-101',
        name: 'Active Campaign',
        status: CampaignStatus.RUNNING,
      };

      mockCampaignRepo.findOne.mockResolvedValue(mockCampaign);

      await expect(service.updateCampaign('camp-101', { name: 'Updated Name' })).rejects.toThrow(
        "Campaign cannot be edited while in 'running' state",
      );
    });
  });

  describe('Manual 1-by-1 Spreadsheet Sending', () => {
    it('does not launch background loop on startCampaign when dispatchMode is manual', async () => {
      const manualCamp = {
        id: 'camp-manual-1',
        name: 'Manual Campaign',
        status: CampaignStatus.DRAFT,
        dispatchMode: 'manual',
        sessionIds: ['session_1'],
        template: 'Hello {{name}}',
      };

      mockCampaignRepo.findOne.mockResolvedValue(manualCamp);
      const dispatchSpy = jest.spyOn(service as any, 'dispatchCampaignLeads');

      const result = await service.startCampaign('camp-manual-1');
      expect(result.status).toBe(CampaignStatus.RUNNING);
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('sendSingleLead dispatches the requested lead and refreshes stats', async () => {
      const camp = {
        id: 'camp-manual-2',
        name: 'Manual Send Single',
        status: CampaignStatus.RUNNING,
        dispatchMode: 'manual',
        sessionIds: ['session_1'],
        template: 'Hello {{name}}',
        pacing: { simulateTyping: false },
      };

      const lead = {
        id: 'lead-single-1',
        campaignId: 'camp-manual-2',
        sessionId: 'session_1',
        phoneNumber: '1234567890',
        chatId: '1234567890@c.us',
        name: 'John',
        status: CampaignLeadStatus.PENDING,
      };

      const mockEngine = {
        checkNumberExists: jest.fn().mockResolvedValue(true),
        sendTextMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      };
      mockEngineRegistry.get.mockReturnValue(mockEngine);

      mockCampaignRepo.findOne.mockResolvedValue(camp);
      mockLeadRepo.findOne.mockResolvedValue(lead);
      mockLeadRepo.count.mockResolvedValue(0); // 0 remaining after this send

      const outcome = await service.sendSingleLead('camp-manual-2', 'lead-single-1');

      expect(outcome.success).toBe(true);
      expect(lead.status).toBe(CampaignLeadStatus.SENT);
      expect(mockEngine.sendTextMessage).toHaveBeenCalledWith('1234567890@c.us', 'Hello John');
      expect(camp.status).toBe(CampaignStatus.COMPLETED);
    });

    it('sendNextLead dispatches the next FIFO pending lead', async () => {
      const camp = {
        id: 'camp-manual-3',
        name: 'Manual Send Next',
        status: CampaignStatus.RUNNING,
        dispatchMode: 'manual',
        sessionIds: ['session_1'],
        template: 'Hi {{name}}',
        pacing: { simulateTyping: false },
      };

      const leadNext = {
        id: 'lead-next-1',
        campaignId: 'camp-manual-3',
        sessionId: 'session_1',
        phoneNumber: '9876543210',
        chatId: '9876543210@c.us',
        name: 'Sara',
        status: CampaignLeadStatus.PENDING,
      };

      const mockEngine = {
        checkNumberExists: jest.fn().mockResolvedValue(true),
        sendTextMessage: jest.fn().mockResolvedValue({ id: 'msg-2' }),
      };
      mockEngineRegistry.get.mockReturnValue(mockEngine);

      mockCampaignRepo.findOne.mockResolvedValue(camp);
      mockLeadRepo.findOne.mockResolvedValue(leadNext);
      mockLeadRepo.count.mockResolvedValue(3); // 3 remaining

      const outcome = await service.sendNextLead('camp-manual-3');

      expect(outcome.success).toBe(true);
      expect(outcome.hasMore).toBe(true);
      expect(outcome.lead?.id).toBe('lead-next-1');
      expect(leadNext.status).toBe(CampaignLeadStatus.SENT);
      expect(mockEngine.sendTextMessage).toHaveBeenCalledWith('9876543210@c.us', 'Hi Sara');
    });

    it('sendNextLead returns hasMore: false when all leads are processed', async () => {
      const camp = {
        id: 'camp-manual-4',
        name: 'Finished Campaign',
        status: CampaignStatus.RUNNING,
        dispatchMode: 'manual',
        sessionIds: ['session_1'],
      };

      mockCampaignRepo.findOne.mockResolvedValue(camp);
      mockLeadRepo.findOne.mockResolvedValue(null); // No more pending leads
      mockLeadRepo.count.mockResolvedValue(0);

      const outcome = await service.sendNextLead('camp-manual-4');

      expect(outcome.hasMore).toBe(false);
      expect(outcome.message).toContain('No more pending leads');
    });
  });
});
