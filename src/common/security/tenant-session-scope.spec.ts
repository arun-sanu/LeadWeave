import {
  runWithRequestId,
  setRequestActor,
  getRequestActor,
  getActiveSessionScope,
  getActiveTenantScope,
} from '../services/request-context';
import {
  resolveSessionScope,
  sessionScopeVisible,
  applySessionScopeToQuery,
  applyTenantScopeToQuery,
} from './session-scope';

describe('Tenant & Session Scoping Security Suite', () => {
  const createMockQb = (alias?: string) => {
    const qb = {
      alias,
      andWhere: jest.fn().mockReturnThis(),
    };
    return qb;
  };
  describe('RequestContext ALS Scoping', () => {
    it('propagates allowedSessions and companyId within request context', () => {
      runWithRequestId('req-123', () => {
        expect(getActiveSessionScope()).toBeUndefined();
        expect(getActiveTenantScope()).toBeUndefined();

        setRequestActor({
          apiKeyId: 'key-test',
          allowedSessions: ['session-a', 'session-b'],
          companyId: 'tenant-999',
        });

        expect(getActiveSessionScope()).toEqual(['session-a', 'session-b']);
        expect(getActiveTenantScope()).toBe('tenant-999');

        const actor = getRequestActor();
        expect(actor).toEqual(
          expect.objectContaining({
            apiKeyId: 'key-test',
            allowedSessions: ['session-a', 'session-b'],
            companyId: 'tenant-999',
          }),
        );
      });
    });

    it('returns undefined outside active request scope', () => {
      expect(getActiveSessionScope()).toBeUndefined();
      expect(getActiveTenantScope()).toBeUndefined();
    });
  });

  describe('resolveSessionScope', () => {
    it('returns null for unrestricted keys without narrowing', () => {
      expect(resolveSessionScope(null)).toBeNull();
      expect(resolveSessionScope(undefined)).toBeNull();
      expect(resolveSessionScope([])).toBeNull();
    });

    it('narrows within allowedSessions for restricted keys', () => {
      expect(resolveSessionScope(['s1', 's2'], 's1')).toEqual(['s1']);
      expect(resolveSessionScope(['s1', 's2'], 's3')).toEqual([]);
      expect(resolveSessionScope(['s1', 's2'])).toEqual(['s1', 's2']);
    });
  });

  describe('sessionScopeVisible', () => {
    it('allows all scopes for unrestricted keys', () => {
      expect(sessionScopeVisible(null, 's1')).toBe(true);
      expect(sessionScopeVisible([], 's1')).toBe(true);
      expect(sessionScopeVisible(null, null)).toBe(true);
    });

    it('restricts scoped keys to explicitly allowed sessions', () => {
      expect(sessionScopeVisible(['s1'], 's1')).toBe(true);
      expect(sessionScopeVisible(['s1'], 's2')).toBe(false);
      expect(sessionScopeVisible(['s1'], null)).toBe(false);
      expect(sessionScopeVisible(['s1'], '*')).toBe(false);
    });
  });

  describe('applySessionScopeToQuery', () => {
    it('leaves query unchanged for unrestricted keys', () => {
      const qb = createMockQb('msg');
      applySessionScopeToQuery(qb, 'sessionId', null);
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('appends 1 = 0 when key has empty allowedSessions list', () => {
      const qb = createMockQb('msg');
      applySessionScopeToQuery(qb, 'sessionId', []);
      expect(qb.andWhere).toHaveBeenCalledWith('1 = 0');
    });

    it('appends IN filter for restricted session list with alias', () => {
      const qb = createMockQb('m');
      applySessionScopeToQuery(qb, 'sessionId', ['s1', 's2']);
      expect(qb.andWhere).toHaveBeenCalledWith('m.sessionId IN (:...__allowedSessions)', {
        __allowedSessions: ['s1', 's2'],
      });
    });

    it('appends IN filter without alias when alias is not set', () => {
      const qb = createMockQb(undefined);
      applySessionScopeToQuery(qb, 'sessionId', ['s1']);
      expect(qb.andWhere).toHaveBeenCalledWith('sessionId IN (:...__allowedSessions)', {
        __allowedSessions: ['s1'],
      });
    });

    it('automatically reads scope from ALS request context when explicitScope is omitted', () => {
      runWithRequestId('req-scoped', () => {
        setRequestActor({ allowedSessions: ['s-auto-1'] });

        const qb = createMockQb('s');
        applySessionScopeToQuery(qb, 'sessionId');
        expect(qb.andWhere).toHaveBeenCalledWith('s.sessionId IN (:...__allowedSessions)', {
          __allowedSessions: ['s-auto-1'],
        });
      });
    });
  });

  describe('applyTenantScopeToQuery', () => {
    it('returns unmodified query builder when no companyId is present', () => {
      const qb = createMockQb('c');
      applyTenantScopeToQuery(qb, 'companyId', null);
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('appends tenant equality filter when companyId is specified', () => {
      const qb = createMockQb('c');
      applyTenantScopeToQuery(qb, 'companyId', 'tenant-alpha');
      expect(qb.andWhere).toHaveBeenCalledWith('c.companyId = :__companyId', {
        __companyId: 'tenant-alpha',
      });
    });

    it('automatically reads companyId from ALS request context when explicitCompanyId is omitted', () => {
      runWithRequestId('req-tenant-scope', () => {
        setRequestActor({ companyId: 'tenant-beta' });

        const qb = createMockQb('sess');
        applyTenantScopeToQuery(qb, 'companyId');
        expect(qb.andWhere).toHaveBeenCalledWith('sess.companyId = :__companyId', {
          __companyId: 'tenant-beta',
        });
      });
    });
  });
});
