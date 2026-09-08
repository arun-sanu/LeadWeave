import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SessionService } from './session.service';
import { Session, SessionStatus } from './entities/session.entity';
import { Message } from '../message/entities/message.entity';
import { ConfigService } from '@nestjs/config';
import { SessionErrorStore } from './session-error-store.service';
import { SessionRestrictionStore } from './session-restriction-store.service';
import { PresenceStore } from './presence-store.service';
import { SessionEngineLifecycle } from './session-engine-lifecycle.service';
import { SessionLivenessWatchdog } from './session-liveness-watchdog.service';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { HookManager } from '../../core/hooks';
import { AuditService } from '../audit/audit.service';
import { runWithRequestId, setRequestActor } from '../../common/services/request-context';

describe('SessionService Multi-Tenant & User Workspace Isolation', () => {
  let service: SessionService;
  let repository: any;
  let mockSessions: Session[];

  beforeEach(async () => {
    mockSessions = [
      {
        id: 'sess-modbit-1',
        name: 'modbit-line-1',
        status: SessionStatus.READY,
        companyId: 'company-modbit-labs',
        userId: 'user-arun-modbit',
        phone: null,
        pushName: null,
        config: {},
        proxyUrl: null,
        proxyType: null,
        connectedAt: new Date(),
        lastActiveAt: new Date(),
        nodeId: null,
        claimedAt: null,
        nodeUrl: null,
        leaseExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'sess-lifegrains-1',
        name: 'lifegrains-line-1',
        status: SessionStatus.READY,
        companyId: 'company-lifegrains',
        userId: 'user-arun-lifegrains',
        phone: null,
        pushName: null,
        config: {},
        proxyUrl: null,
        proxyType: null,
        connectedAt: new Date(),
        lastActiveAt: new Date(),
        nodeId: null,
        claimedAt: null,
        nodeUrl: null,
        leaseExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'sess-lifegrains-2',
        name: 'lifegrains-agent-2',
        status: SessionStatus.READY,
        companyId: 'company-lifegrains',
        userId: 'user-agent-rachel',
        phone: null,
        pushName: null,
        config: {},
        proxyUrl: null,
        proxyType: null,
        connectedAt: new Date(),
        lastActiveAt: new Date(),
        nodeId: null,
        claimedAt: null,
        nodeUrl: null,
        leaseExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    repository = {
      find: jest.fn().mockImplementation((opts: any) => {
        let list = [...mockSessions];
        if (opts?.where) {
          if (Array.isArray(opts.where)) {
            list = list.filter(s =>
              opts.where.some((cond: any) => {
                const compMatch = !cond.companyId || s.companyId === cond.companyId;
                const userMatch = cond.userId && s.userId === cond.userId;
                const idMatch = cond.id && cond.id._value && cond.id._value.includes(s.id);
                return compMatch && (userMatch || idMatch);
              }),
            );
          } else {
            if (opts.where.companyId) {
              list = list.filter(s => s.companyId === opts.where.companyId);
            }
            if (opts.where.userId) {
              list = list.filter(s => s.userId === opts.where.userId);
            }
            if (opts.where.id && opts.where.id._value) {
              list = list.filter(s => opts.where.id._value.includes(s.id));
            }
          }
        }
        return Promise.resolve(list);
      }),
      findOne: jest.fn().mockImplementation(({ where }: any) => {
        const found = mockSessions.find(s => s.id === where.id);
        return Promise.resolve(found || null);
      }),
      create: jest.fn().mockImplementation((data: any) => ({ ...data, id: 'sess-new-created' })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: getRepositoryToken(Session, 'data'),
          useValue: repository,
        },
        {
          provide: getRepositoryToken(Message, 'data'),
          useValue: {},
        },
        {
          provide: getDataSourceToken('data'),
          useValue: { transaction: jest.fn((fn: any) => fn({ save: (x: any) => x })) },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: SessionErrorStore,
          useValue: { attachTo: (s: any) => s, record: jest.fn(), clear: jest.fn() },
        },
        {
          provide: SessionRestrictionStore,
          useValue: { attachTo: (s: any) => s, record: jest.fn(), clear: jest.fn() },
        },
        { provide: PresenceStore, useValue: {} },
        { provide: HookManager, useValue: { execute: jest.fn() } },
        { provide: SessionEngineLifecycle, useValue: {} },
        { provide: SessionLivenessWatchdog, useValue: {} },
        { provide: EngineRegistry, useValue: { isLive: jest.fn(), get: jest.fn() } },
        { provide: AuditService, useValue: { logInfo: jest.fn(), logWarn: jest.fn() } },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  describe('Company Workspace Isolation', () => {
    it('LifeGrains Company Admin cannot see ModBit Labs sessions in findAll', async () => {
      await runWithRequestId('req-lifegrains-admin', async () => {
        setRequestActor({
          userId: 'user-arun-lifegrains',
          userRole: 'companyadmin',
          companyId: 'company-lifegrains',
        });

        const result = await service.findAll();
        expect(result.map(s => s.id)).toEqual(['sess-lifegrains-1', 'sess-lifegrains-2']);
        expect(result.some(s => s.id === 'sess-modbit-1')).toBe(false);
      });
    });

    it('ModBit Labs Company Admin cannot see LifeGrains sessions in findAll', async () => {
      await runWithRequestId('req-modbit-admin', async () => {
        setRequestActor({
          userId: 'user-arun-modbit',
          userRole: 'companyadmin',
          companyId: 'company-modbit-labs',
        });

        const result = await service.findAll();
        expect(result.map(s => s.id)).toEqual(['sess-modbit-1']);
        expect(result.some(s => s.companyId === 'company-lifegrains')).toBe(false);
      });
    });

    it('LifeGrains Company Admin cannot access ModBit Labs session via findOne', async () => {
      await runWithRequestId('req-lifegrains-admin', async () => {
        setRequestActor({
          userId: 'user-arun-lifegrains',
          userRole: 'companyadmin',
          companyId: 'company-lifegrains',
        });

        await expect(service.findOne('sess-modbit-1')).rejects.toThrow(NotFoundException);
      });
    });

    it('Superadmin can see all sessions across companies', async () => {
      await runWithRequestId('req-superadmin', async () => {
        setRequestActor({
          userId: 'user-superadmin',
          userRole: 'superadmin',
        });

        const result = await service.findAll();
        expect(result.length).toBe(3);
      });
    });
  });

  describe('User Workspace Isolation under Company', () => {
    it('Agent Rachel in LifeGrains only sees sessions she owns or is assigned to', async () => {
      await runWithRequestId('req-agent-rachel', async () => {
        setRequestActor({
          userId: 'user-agent-rachel',
          userRole: 'user',
          companyId: 'company-lifegrains',
          allowedSessions: ['sess-lifegrains-2'],
        });

        const result = await service.findAll(['sess-lifegrains-2']);
        expect(result.map(s => s.id)).toEqual(['sess-lifegrains-2']);
        expect(result.some(s => s.id === 'sess-lifegrains-1')).toBe(false);
      });
    });

    it('Agent Rachel cannot access Arun’s session in the same company', async () => {
      await runWithRequestId('req-agent-rachel', async () => {
        setRequestActor({
          userId: 'user-agent-rachel',
          userRole: 'user',
          companyId: 'company-lifegrains',
          allowedSessions: ['sess-lifegrains-2'],
        });

        await expect(service.findOne('sess-lifegrains-1')).rejects.toThrow(NotFoundException);
      });
    });

    it('Stamps creator companyId and userId when creating a session', async () => {
      await runWithRequestId('req-create-session', async () => {
        setRequestActor({
          userId: 'user-arun-lifegrains',
          userRole: 'companyadmin',
          companyId: 'company-lifegrains',
        });

        const created = await service.create({ name: 'new-line' });
        expect(created.companyId).toBe('company-lifegrains');
        expect(created.userId).toBe('user-arun-lifegrains');
      });
    });
  });
});
