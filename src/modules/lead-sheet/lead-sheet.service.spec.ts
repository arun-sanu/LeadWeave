import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeadSheetService } from './lead-sheet.service';
import { LeadRecord, LeadStatus } from './entities/lead-record.entity';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { HookManager } from '../../core/hooks/hook-manager.service';
import { ContactService } from '../contact/contact.service';

describe('LeadSheetService', () => {
  let service: LeadSheetService;
  let mockLeadRepo: any;
  let mockEngineRegistry: any;
  let mockHookManager: any;
  let mockContactService: any;
  let mockEngine: any;

  beforeEach(async () => {
    mockEngine = {
      checkNumberExists: jest.fn(),
      sendTextMessage: jest.fn(),
    };

    mockLeadRepo = {
      create: jest.fn(dto => ({ ...dto, id: 'mock-uuid-123' })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    mockEngineRegistry = {
      get: jest.fn().mockReturnValue(mockEngine),
    };

    mockHookManager = {
      register: jest.fn(),
    };

    mockContactService = {
      blockContact: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadSheetService,
        { provide: getRepositoryToken(LeadRecord, 'data'), useValue: mockLeadRepo },
        { provide: EngineRegistry, useValue: mockEngineRegistry },
        { provide: HookManager, useValue: mockHookManager },
        { provide: ContactService, useValue: mockContactService },
      ],
    }).compile();

    service = module.get<LeadSheetService>(LeadSheetService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should initialize and register inbound hook', () => {
    service.onModuleInit();
    expect(mockHookManager.register).toHaveBeenCalledWith(
      'core-lead-sheet',
      'message:received',
      expect.any(Function),
      10,
    );
  });

  describe('processLeadTrigger', () => {
    it('should mark NOT_ON_WA if phone does not exist on WhatsApp', async () => {
      mockEngine.checkNumberExists.mockResolvedValue(false);

      const res = await service.processLeadTrigger({
        sessionId: 'default',
        phone: '+15550001111',
        name: 'Bob',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe(LeadStatus.NOT_ON_WA);
      expect(mockEngine.sendTextMessage).not.toHaveBeenCalled();
    });

    it('should send greeting and set 20h timeout if phone is valid', async () => {
      mockEngine.checkNumberExists.mockResolvedValue(true);
      mockEngine.sendTextMessage.mockResolvedValue({ id: 'msg-1', timestamp: 123456 });

      const res = await service.processLeadTrigger({
        sessionId: 'default',
        phone: '+15550002222',
        name: 'Alice',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe(LeadStatus.GREETING_SENT);
      expect(mockEngine.sendTextMessage).toHaveBeenCalledWith(
        '15550002222@c.us',
        expect.stringContaining('Alice'),
      );
    });
  });

  describe('handleInboundHook (Opt-out & Reply handling)', () => {
    it('should handle STOP opt-out, send apology, and block contact', async () => {
      const activeLead: any = {
        id: 'lead-1',
        sessionId: 'default',
        chatId: '15550002222@c.us',
        phoneNumber: '+15550002222',
        leadName: 'Alice',
        status: LeadStatus.GREETING_SENT,
      };
      mockLeadRepo.findOne.mockResolvedValue(activeLead);

      await service.handleInboundHook('default', {
        from: '15550002222@c.us',
        fromMe: false,
        body: 'STOP',
      });

      expect(activeLead.status).toBe(LeadStatus.OPT_OUT);
      expect(mockEngine.sendTextMessage).toHaveBeenCalledWith(
        '15550002222@c.us',
        expect.stringContaining('So sorry to bother you Alice'),
      );
      expect(mockContactService.blockContact).toHaveBeenCalledWith('default', '15550002222@c.us');
    });

    it('should handle normal reply and transition to REPLIED', async () => {
      const activeLead: any = {
        id: 'lead-2',
        sessionId: 'default',
        chatId: '15550003333@c.us',
        phoneNumber: '+15550003333',
        leadName: 'John',
        status: LeadStatus.GREETING_SENT,
      };
      mockLeadRepo.findOne.mockResolvedValue(activeLead);

      await service.handleInboundHook('default', {
        from: '15550003333@c.us',
        fromMe: false,
        body: 'Yes, please send more info!',
      });

      expect(activeLead.status).toBe(LeadStatus.REPLIED);
      expect(activeLead.repliedAt).toBeDefined();
    });
  });

  describe('sweepExpiredTimeouts (20h W-RNR transition)', () => {
    it('should mark expired leads as W-RNR', async () => {
      const staleLead: any = {
        id: 'lead-3',
        phoneNumber: '+15550004444',
        status: LeadStatus.GREETING_SENT,
        timeoutAt: new Date(Date.now() - 1000),
      };
      mockLeadRepo.find.mockResolvedValue([staleLead]);

      await service.sweepExpiredTimeouts();

      expect(staleLead.status).toBe(LeadStatus.W_RNR);
      expect(mockLeadRepo.save).toHaveBeenCalledWith(staleLead);
    });
  });
});
