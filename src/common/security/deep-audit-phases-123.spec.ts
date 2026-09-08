import { resolveSessionScope, sessionScopeVisible, applySessionScopeToQuery } from './session-scope';
import { ApiKeyGuard } from '../../modules/auth/guards/api-key.guard';
import { Reflector } from '@nestjs/core';
import {
  gaussianRandom,
  calculateHumanDelay,
  calculateTypingDuration,
  calculateBatchBreather,
} from '../utils/human-jitter';
import defaultDataSource, {
  buildPostgresDataSourceOptions,
} from '../../database/data-source';
import { MessageSendService } from '../../modules/message/message-send.service';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Message } from '../../modules/message/entities/message.entity';
import { SessionService } from '../../modules/session/session.service';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { HookManager } from '../../core/hooks';
import { TemplateService } from '../../modules/template/template.service';
import { SendPacingService } from '../../modules/message/send-pacing.service';
import { ConfigService } from '@nestjs/config';

describe('Deep & Hard Stress Test Suite: Phases 1, 2, and 3', () => {
  // =========================================================================
  // Phase 1: Deep Security, Authorization & Session Scoping Tests
  // =========================================================================
  describe('Phase 1: Deep Security & Scoping Fences', () => {
    describe('resolveSessionScope adversarial permutations', () => {
      it('handles undefined, null, empty array, and explicit lists strictly', () => {
        // Universal (unrestricted null, undefined, empty array)
        expect(resolveSessionScope(null)).toBeNull();
        expect(resolveSessionScope(undefined)).toBeNull();
        expect(resolveSessionScope([])).toBeNull();
        expect(resolveSessionScope(null, 'target-session')).toEqual(['target-session']);
        expect(resolveSessionScope(undefined, 'target-session')).toEqual(['target-session']);
        expect(resolveSessionScope([], 'target-session')).toEqual(['target-session']);

        // Explicit allowlist (restricted)
        expect(resolveSessionScope(['s1', 's2'])).toEqual(['s1', 's2']);
        expect(resolveSessionScope(['s1', 's2'], 's1')).toEqual(['s1']);
        expect(resolveSessionScope(['s1', 's2'], 's3')).toEqual([]);
        expect(resolveSessionScope(['s1'], 's2')).toEqual([]);
      });
    });

    describe('sessionScopeVisible adversarial checks', () => {
      it('strictly forbids scoped keys from accessing null, undefined, or wildcard scopes', () => {
        // Universal key
        expect(sessionScopeVisible(null, 's1')).toBe(true);
        expect(sessionScopeVisible(undefined, 's1')).toBe(true);
        expect(sessionScopeVisible(null, '*')).toBe(true);
        expect(sessionScopeVisible(null, null)).toBe(true);

        // Scoped keys with allowed sessions
        expect(sessionScopeVisible(['s1', 's2'], 's1')).toBe(true);
        expect(sessionScopeVisible(['s1', 's2'], 's2')).toBe(true);
        expect(sessionScopeVisible(['s1', 's2'], 's3')).toBe(false);
        expect(sessionScopeVisible(['s1'], null)).toBe(false);
        expect(sessionScopeVisible(['s1'], undefined)).toBe(false);
        expect(sessionScopeVisible(['s1'], '*')).toBe(false);
      });
    });

    describe('applySessionScopeToQuery SQL protection', () => {
      it('correctly appends 1 = 0 on empty array to prevent data leaks', () => {
        const mockQb = {
          alias: 'sess',
          andWhere: jest.fn().mockReturnThis(),
        };

        // Restricted to empty set => 1 = 0
        applySessionScopeToQuery(mockQb, 'id', []);
        expect(mockQb.andWhere).toHaveBeenCalledWith('1 = 0');

        // Restricted to ['s-1', 's-2'] => IN filter
        mockQb.andWhere.mockClear();
        applySessionScopeToQuery(mockQb, 'id', ['s-1', 's-2']);
        expect(mockQb.andWhere).toHaveBeenCalledWith('sess.id IN (:...__allowedSessions)', {
          __allowedSessions: ['s-1', 's-2'],
        });

        // Unrestricted => no where clause added
        mockQb.andWhere.mockClear();
        applySessionScopeToQuery(mockQb, 'id', null);
        expect(mockQb.andWhere).not.toHaveBeenCalled();
      });
    });

    describe('ApiKeyGuard Supabase Token & Role Mapping', () => {
      let guard: ApiKeyGuard;
      let mockAuthService: any;
      let mockReflector: Reflector;
      let mockConfigService: any;
      let mockAuditService: any;
      let mockSupabaseService: any;

      beforeEach(() => {
        mockAuthService = { validateApiKey: jest.fn(), hasPermission: jest.fn().mockReturnValue(true) };
        mockReflector = new Reflector();
        mockConfigService = { get: jest.fn() };
        mockAuditService = { logWarn: jest.fn() };
        mockSupabaseService = {
          isEnabled: jest.fn().mockReturnValue(true),
          verifyToken: jest.fn(),
        };

        guard = new ApiKeyGuard(
          mockAuthService,
          mockReflector,
          mockConfigService,
          mockAuditService,
          mockSupabaseService,
        );
      });

      it('assigns allowedSessions: null ONLY to Superadmins / Admins, and empty array to Viewers', async () => {
        // Mock Admin User
        mockSupabaseService.verifyToken.mockResolvedValueOnce({
          id: 'admin-usr-1',
          email: 'admin@company.com',
          role: 'admin',
          company_id: 'comp-100',
        });

        const reqAdmin: any = {
          headers: { authorization: 'Bearer admin-token' },
          params: {},
        };
        const contextAdmin: any = {
          switchToHttp: () => ({ getRequest: () => reqAdmin }),
          getHandler: () => ({}),
          getClass: () => ({}),
        };

        const canAdmin = await guard.canActivate(contextAdmin);
        expect(canAdmin).toBe(true);
        expect(reqAdmin.apiKey.allowedSessions).toBeNull();

        // Mock Viewer User
        mockSupabaseService.verifyToken.mockResolvedValueOnce({
          id: 'viewer-usr-2',
          email: 'viewer@company.com',
          role: 'viewer',
          company_id: 'comp-100',
        });

        const reqViewer: any = {
          headers: { authorization: 'Bearer viewer-token' },
          params: {},
        };
        const contextViewer: any = {
          switchToHttp: () => ({ getRequest: () => reqViewer }),
          getHandler: () => ({}),
          getClass: () => ({}),
        };

        const canViewer = await guard.canActivate(contextViewer);
        expect(canViewer).toBe(true);
        expect(reqViewer.apiKey.allowedSessions).toEqual([]);
      });
    });
  });

  // =========================================================================
  // Phase 2: Deep Database & DataSource Entity Parity Tests
  // =========================================================================
  describe('Phase 2: Deep Database & DataSource Parity', () => {
    it('verifies that data-source.ts includes campaign and lead-sheet entities', () => {
      const options = defaultDataSource.options;
      const entities = options.entities as string[];
      expect(Array.isArray(entities)).toBe(true);

      const hasCampaign = entities.some(e => e.includes('campaign'));
      const hasLeadSheet = entities.some(e => e.includes('lead-sheet'));
      const hasSession = entities.some(e => e.includes('session'));
      const hasMessage = entities.some(e => e.includes('message'));

      expect(hasCampaign).toBe(true);
      expect(hasLeadSheet).toBe(true);
      expect(hasSession).toBe(true);
      expect(hasMessage).toBe(true);
    });

    it('verifies PostgreSQL data source builder creates complete options', () => {
      const pgOptions = buildPostgresDataSourceOptions({
        DATABASE_TYPE: 'postgres',
        DATABASE_HOST: '127.0.0.1',
        DATABASE_PORT: '5432',
        DATABASE_NAME: 'test_db',
        POSTGRES_SCHEMA: 'custom_schema',
      });

      expect(pgOptions.type).toBe('postgres');
      expect((pgOptions as any).schema).toBe('custom_schema');
      expect((pgOptions as any).database).toBe('test_db');
      const entities = pgOptions.entities as string[];
      expect(entities.some(e => e.includes('campaign'))).toBe(true);
      expect(entities.some(e => e.includes('lead-sheet'))).toBe(true);
    });
  });

  // =========================================================================
  // Phase 3: Deep Anti-Ban Pacing & Human Jitter Hard Tests
  // =========================================================================
  describe('Phase 3: Anti-Ban Presence Simulation & Mathematical Modeling', () => {
    describe('Statistical Gaussian Distribution (10,000 samples)', () => {
      it('satisfies 3-sigma Gaussian bounds and variance properties', () => {
        const mean = 5000;
        const stdDev = 500;
        const min = 3500;
        const max = 6500;
        const samples: number[] = [];

        for (let i = 0; i < 10000; i++) {
          const val = gaussianRandom(mean, stdDev, min, max);
          expect(val).toBeGreaterThanOrEqual(min);
          expect(val).toBeLessThanOrEqual(max);
          samples.push(val);
        }

        const calculatedMean = samples.reduce((a, b) => a + b, 0) / samples.length;
        // Calculated mean should be within 1.5% of expected mean (5000)
        expect(calculatedMean).toBeGreaterThan(4925);
        expect(calculatedMean).toBeLessThan(5075);
      });
    });

    describe('calculateTypingDuration and Presence Calculations', () => {
      it('calculates duration realistically scaling with text length', () => {
        const short = calculateTypingDuration('Hi', 500, 5000);
        const long = calculateTypingDuration('A'.repeat(200), 500, 5000);

        expect(short).toBeGreaterThanOrEqual(500);
        expect(long).toBeGreaterThanOrEqual(short);
        expect(long).toBeLessThanOrEqual(5000);
      });

      it('returns minMs immediately on empty text', () => {
        expect(calculateTypingDuration('', 800, 4000)).toBe(800);
      });

      it('computes batch breathers strictly on multiples of batchSize', () => {
        expect(calculateBatchBreather(9, 10)).toBe(0);
        expect(calculateBatchBreather(10, 10)).toBeGreaterThanOrEqual(1000);
        expect(calculateBatchBreather(20, 10)).toBeGreaterThanOrEqual(1000);
        expect(calculateBatchBreather(21, 10)).toBe(0);
      });
    });

    describe('MessageSendService Multi-Media Presence Triggers', () => {
      let service: MessageSendService;
      let mockEngine: any;
      let mockRepo: any;
      let mockEngines: any;

      beforeEach(async () => {
        process.env.SIMULATE_TYPING = 'true';
        process.env.SIMULATE_TYPING_MAX_MS = '1'; // Fast execution in test

        mockEngine = {
          sendChatState: jest.fn().mockResolvedValue(undefined),
          sendTextMessage: jest.fn().mockResolvedValue({ id: 'msg-1', timestamp: 1000 }),
          sendImageMessage: jest.fn().mockResolvedValue({ id: 'msg-2', timestamp: 1000 }),
          sendVideoMessage: jest.fn().mockResolvedValue({ id: 'msg-3', timestamp: 1000 }),
          sendAudioMessage: jest.fn().mockResolvedValue({ id: 'msg-4', timestamp: 1000 }),
        };

        mockRepo = {
          create: jest.fn().mockImplementation(dto => ({ id: 'saved-1', ...dto })),
          save: jest.fn().mockImplementation(msg => Promise.resolve({ id: 'saved-1', ...msg })),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        mockEngines = {
          require: jest.fn().mockReturnValue(mockEngine),
        };

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            MessageSendService,
            { provide: getRepositoryToken(Message, 'data'), useValue: mockRepo },
            { provide: SessionService, useValue: { findOne: jest.fn().mockResolvedValue({ id: 'sess-1' }) } },
            { provide: EngineRegistry, useValue: mockEngines },
            {
              provide: HookManager,
              useValue: {
                execute: jest.fn().mockImplementation((event, payload) =>
                  Promise.resolve({ continue: true, data: { input: payload?.input } }),
                ),
              },
            },
            { provide: TemplateService, useValue: {} },
            {
              provide: SendPacingService,
              useValue: {
                assertSendAllowed: jest.fn(),
                recordSendFailure: jest.fn(),
                recordSendSuccess: jest.fn(),
              },
            },
            {
              provide: ConfigService,
              useValue: { get: jest.fn().mockReturnValue(undefined) },
            },
          ],
        }).compile();

        service = module.get<MessageSendService>(MessageSendService);
      });

      afterEach(() => {
        delete process.env.SIMULATE_TYPING;
        delete process.env.SIMULATE_TYPING_MAX_MS;
      });

      it('triggers typing presence for text sends', async () => {
        await service.sendText('sess-1', { chatId: '123@c.us', text: 'Hello' });
        expect(mockEngine.sendChatState).toHaveBeenCalledWith('123@c.us', 'typing');
        expect(mockEngine.sendTextMessage).toHaveBeenCalled();
      });

      it('triggers typing presence for images with caption', async () => {
        await service.sendImage('sess-1', {
          chatId: '123@c.us',
          base64: Buffer.from('fake').toString('base64'),
          mimetype: 'image/png',
          caption: 'Look at this photo',
        });
        expect(mockEngine.sendChatState).toHaveBeenCalledWith('123@c.us', 'typing');
        expect(mockEngine.sendImageMessage).toHaveBeenCalled();
      });

      it('does NOT trigger typing presence for image without caption', async () => {
        await service.sendImage('sess-1', {
          chatId: '123@c.us',
          base64: Buffer.from('fake').toString('base64'),
          mimetype: 'image/png',
        });
        expect(mockEngine.sendChatState).not.toHaveBeenCalled();
        expect(mockEngine.sendImageMessage).toHaveBeenCalled();
      });

      it('triggers recording presence for PTT voice notes (ptt: true)', async () => {
        await service.sendAudio('sess-1', {
          chatId: '123@c.us',
          base64: Buffer.from('fake').toString('base64'),
          mimetype: 'audio/ogg',
          ptt: true,
        });
        expect(mockEngine.sendChatState).toHaveBeenCalledWith('123@c.us', 'recording');
        expect(mockEngine.sendAudioMessage).toHaveBeenCalled();
      });

      it('does NOT trigger recording presence for regular audio (ptt: false)', async () => {
        await service.sendAudio('sess-1', {
          chatId: '123@c.us',
          base64: Buffer.from('fake').toString('base64'),
          mimetype: 'audio/mp3',
          ptt: false,
        });
        expect(mockEngine.sendChatState).not.toHaveBeenCalled();
        expect(mockEngine.sendAudioMessage).toHaveBeenCalled();
      });
    });
  });
});
