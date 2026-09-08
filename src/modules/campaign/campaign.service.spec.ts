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
      create: jest.fn((entity) => ({ id: 'camp-123', ...entity })),
      save: jest.fn(async (entity) => entity),
      update: jest.fn(async () => ({ affected: 1 })),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
    };

    mockLeadRepo = {
      create: jest.fn((entity) => ({ id: 'lead-123', ...entity })),
      save: jest.fn(async (entity) => entity),
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
        stats: { total: 1, pending: 0, sent: 1, delivered: 0, read: 0, replied: 0, optOut: 0, failed: 0, responseRate: 0 },
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
        stats: { total: 1, pending: 0, sent: 1, delivered: 0, read: 0, replied: 0, optOut: 0, failed: 0, responseRate: 0 },
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
});
