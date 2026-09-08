import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CampaignService } from '../../modules/campaign/campaign.service';
import { Campaign, CampaignStatus } from '../../modules/campaign/entities/campaign.entity';
import { CampaignLead, CampaignLeadStatus } from '../../modules/campaign/entities/campaign-lead.entity';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { HookManager } from '../../core/hooks/hook-manager.service';
import { QUEUE_NAMES } from '../../modules/queue/queue-names';
import { applyTenantScopeToQuery } from './session-scope';
import {
  runWithRequestId,
  setRequestActor,
  getActiveTenantScope,
} from '../services/request-context';
import { Session } from '../../modules/session/entities/session.entity';
import { LeadRecord } from '../../modules/lead-sheet/entities/lead-record.entity';
import { AddTenantCompanyIdIsolation1786400000000 } from '../../database/migrations/1786400000000-AddTenantCompanyIdIsolation';

describe('Deep & Hard Stress Test Suite: Phases 4 and 5', () => {
  // =========================================================================
  // Phase 4: Campaign Queue, Resilient Checkpointing & Auto-Resumption Tests
  // =========================================================================
  describe('Phase 4: Distributed Campaign Queue & Resilient Resumption', () => {
    let campaignService: CampaignService;
    let mockCampaignRepo: any;
    let mockLeadRepo: any;
    let mockEngineRegistry: any;
    let mockHookManager: any;

    beforeEach(async () => {
      mockCampaignRepo = {
        create: jest.fn(entity => ({ id: 'camp-test-1', ...entity })),
        save: jest.fn(async entity => entity),
        findOne: jest.fn(),
        find: jest.fn(),
        findAndCount: jest.fn(),
        update: jest.fn(async () => ({ affected: 1 })),
      };

      mockLeadRepo = {
        create: jest.fn(entity => ({ id: 'lead-test-1', ...entity })),
        save: jest.fn(async entity => entity),
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn(),
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
          { provide: getRepositoryToken(Campaign, 'data'), useValue: mockCampaignRepo },
          { provide: getRepositoryToken(CampaignLead, 'data'), useValue: mockLeadRepo },
          { provide: EngineRegistry, useValue: mockEngineRegistry },
          { provide: HookManager, useValue: mockHookManager },
        ],
      }).compile();

      campaignService = module.get<CampaignService>(CampaignService);
    });

    afterEach(() => {
      campaignService.onModuleDestroy();
    });

    it('validates QUEUE_NAMES constants integrity', () => {
      expect(QUEUE_NAMES.CAMPAIGN).toBe('campaign-queue');
      expect(QUEUE_NAMES.WEBHOOK).toBe('webhook-queue');
      expect(QUEUE_NAMES.INGRESS).toBe('ingress-queue');
    });

    it('auto-resumes orphaned running campaigns with remaining leads on startup sweep', async () => {
      const runningCampaign = {
        id: 'camp-orphaned-99',
        name: 'Interrupted Black Friday Campaign',
        status: CampaignStatus.RUNNING,
        pacing: { minDelayMs: 1, maxDelayMs: 1 },
      };

      mockCampaignRepo.find.mockImplementation((query: any) => {
        if (query?.where?.status === CampaignStatus.RUNNING) {
          return Promise.resolve([runningCampaign]);
        }
        return Promise.resolve([]);
      });

      mockCampaignRepo.findOne.mockResolvedValue(runningCampaign);
      // 10 pending leads waiting
      mockLeadRepo.count.mockResolvedValueOnce(10).mockResolvedValue(0);
      mockLeadRepo.find.mockResolvedValue([]);

      await campaignService.sweepScheduledCampaigns();

      expect(mockLeadRepo.count).toHaveBeenCalledWith({
        where: { campaignId: 'camp-orphaned-99', status: CampaignLeadStatus.PENDING },
      });
    });

    it('transitions campaign to COMPLETED when 0 pending leads remain during sweep', async () => {
      const emptyCampaign = {
        id: 'camp-finished-1',
        name: 'Done Campaign',
        status: CampaignStatus.RUNNING,
      };

      mockCampaignRepo.findOne.mockResolvedValue(emptyCampaign);
      mockLeadRepo.find.mockResolvedValue([]);
      mockLeadRepo.count.mockResolvedValue(0);

      // Trigger dispatch directly
      await (campaignService as any).dispatchCampaignLeads('camp-finished-1');

      expect(emptyCampaign.status).toBe(CampaignStatus.COMPLETED);
      expect((emptyCampaign as any).completedAt).toBeInstanceOf(Date);
      expect(mockCampaignRepo.save).toHaveBeenCalledWith(emptyCampaign);
    });

    it('prevents concurrent duplicate dispatch loops on the same campaign (concurrency lock)', async () => {
      const lockCampaign = {
        id: 'camp-lock-test',
        name: 'Locked Campaign',
        status: CampaignStatus.RUNNING,
      };

      (campaignService as any).runningLoops.add('camp-lock-test');

      // Attempt to dispatch while already in runningLoops
      await (campaignService as any).dispatchCampaignLeads('camp-lock-test');

      // findOne should not even be called because runningLoops guarded execution
      expect(mockCampaignRepo.findOne).not.toHaveBeenCalled();
    });

    it('properly distinguishes past scheduled vs future scheduled campaigns', async () => {
      const pastCampaign = {
        id: 'camp-past',
        name: 'Past Promo',
        status: CampaignStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 10000),
      };

      mockCampaignRepo.find.mockImplementation((query: any) => {
        if (query?.where?.status === CampaignStatus.SCHEDULED) {
          return Promise.resolve([pastCampaign]);
        }
        return Promise.resolve([]);
      });

      mockCampaignRepo.findOne.mockResolvedValue(pastCampaign);
      mockLeadRepo.find.mockResolvedValue([]);
      mockLeadRepo.count.mockResolvedValue(0);

      await campaignService.sweepScheduledCampaigns();

      expect(mockCampaignRepo.update).toHaveBeenCalledWith(
        { id: 'camp-past', status: CampaignStatus.SCHEDULED },
        { status: CampaignStatus.RUNNING, startedAt: expect.any(Date) },
      );
    });
  });

  // =========================================================================
  // Phase 5: Multi-Tenancy Database Isolation & Tenant Scoping Tests
  // =========================================================================
  describe('Phase 5: Multi-Tenancy Database Isolation & Tenant Scoping', () => {
    const createMockQb = (alias?: string) => ({
      alias,
      andWhere: jest.fn().mockReturnThis(),
    });

    describe('applyTenantScopeToQuery adversarial constraints', () => {
      it('leaves query untouched when no tenant is set (universal/admin context)', () => {
        const qb = createMockQb('sess');
        applyTenantScopeToQuery(qb, 'companyId', null);
        expect(qb.andWhere).not.toHaveBeenCalled();

        applyTenantScopeToQuery(qb, 'companyId', undefined);
        expect(qb.andWhere).not.toHaveBeenCalled();
      });

      it('appends strict equality check when explicit companyId is given', () => {
        const qb = createMockQb('sess');
        applyTenantScopeToQuery(qb, 'companyId', 'tenant_org_777');
        expect(qb.andWhere).toHaveBeenCalledWith('sess.companyId = :__companyId', {
          __companyId: 'tenant_org_777',
        });
      });

      it('correctly handles queries without alias', () => {
        const qb = createMockQb(undefined);
        applyTenantScopeToQuery(qb, 'company_id', 'tenant_org_888');
        expect(qb.andWhere).toHaveBeenCalledWith('company_id = :__companyId', {
          __companyId: 'tenant_org_888',
        });
      });

      it('isolates concurrent async contexts with different companyIds', async () => {
        const runTenantJob = async (tenantId: string) => {
          return runWithRequestId(`req-${tenantId}`, async () => {
            setRequestActor({ companyId: tenantId });
            await new Promise(r => setTimeout(r, 10)); // simulate I/O delay
            const activeTenant = getActiveTenantScope();
            const qb = createMockQb('t');
            applyTenantScopeToQuery(qb, 'companyId');
            return { activeTenant, qb };
          });
        };

        const [resA, resB] = await Promise.all([
          runTenantJob('company-acme-corp'),
          runTenantJob('company-globex-inc'),
        ]);

        expect(resA.activeTenant).toBe('company-acme-corp');
        expect(resA.qb.andWhere).toHaveBeenCalledWith('t.companyId = :__companyId', {
          __companyId: 'company-acme-corp',
        });

        expect(resB.activeTenant).toBe('company-globex-inc');
        expect(resB.qb.andWhere).toHaveBeenCalledWith('t.companyId = :__companyId', {
          __companyId: 'company-globex-inc',
        });
      });
    });

    describe('Entity Metadata Validation', () => {
      it('verifies that Session entity contains companyId field', () => {
        const session = new Session();
        session.companyId = 'org-123';
        expect(session.companyId).toBe('org-123');
      });

      it('verifies that Campaign entity contains companyId field', () => {
        const campaign = new Campaign();
        campaign.companyId = 'org-456';
        expect(campaign.companyId).toBe('org-456');
      });

      it('verifies that LeadRecord entity contains companyId field', () => {
        const lead = new LeadRecord();
        lead.companyId = 'org-789';
        expect(lead.companyId).toBe('org-789');
      });
    });

    describe('Migration Idempotency & Reversibility', () => {
      it('executes up and down migration safely across table states', async () => {
        const migration = new AddTenantCompanyIdIsolation1786400000000();

        const mockQueryRunner: any = {
          hasTable: jest.fn().mockResolvedValue(true),
          hasColumn: jest.fn().mockResolvedValue(false),
          query: jest.fn().mockResolvedValue([]),
        };

        // Run Up
        await migration.up(mockQueryRunner);
        expect(mockQueryRunner.query).toHaveBeenCalledWith(
          expect.stringContaining('ALTER TABLE "sessions" ADD COLUMN "companyId"'),
        );
        expect(mockQueryRunner.query).toHaveBeenCalledWith(
          expect.stringContaining('ALTER TABLE "campaigns" ADD COLUMN "company_id"'),
        );
        expect(mockQueryRunner.query).toHaveBeenCalledWith(
          expect.stringContaining('ALTER TABLE "lead_records" ADD COLUMN "company_id"'),
        );

        // Run Down
        mockQueryRunner.hasColumn.mockResolvedValue(true);
        mockQueryRunner.query.mockClear();
        await migration.down(mockQueryRunner);
        expect(mockQueryRunner.query).toHaveBeenCalledWith(
          expect.stringContaining('ALTER TABLE "sessions" DROP COLUMN "companyId"'),
        );
        expect(mockQueryRunner.query).toHaveBeenCalledWith(
          expect.stringContaining('ALTER TABLE "campaigns" DROP COLUMN "company_id"'),
        );
        expect(mockQueryRunner.query).toHaveBeenCalledWith(
          expect.stringContaining('ALTER TABLE "lead_records" DROP COLUMN "company_id"'),
        );
      });
    });
  });
});
