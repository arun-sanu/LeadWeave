import { CacheKeyBuilder } from './cache-key.builder';

describe('CacheKeyBuilder (Redis Key Schema Enforcer)', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalPrefix = process.env.REDIS_KEY_PREFIX;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.REDIS_KEY_PREFIX = originalPrefix;
  });

  it('generates standardized keys conforming to ^{env}:{namespace}:{entity}:{id}:{attr}', () => {
    process.env.NODE_ENV = 'test';
    process.env.REDIS_KEY_PREFIX = 'lw';

    const statusKey = CacheKeyBuilder.sessionStatus('sess-123');
    expect(statusKey).toBe('test:lw:wa:session:sess-123:status');

    const infoKey = CacheKeyBuilder.sessionInfo('sess-123');
    expect(infoKey).toBe('test:lw:wa:session:sess-123:info');

    const qrKey = CacheKeyBuilder.sessionQr('sess-123');
    expect(qrKey).toBe('test:lw:wa:session:sess-123:qr');

    const listKey = CacheKeyBuilder.sessionsList();
    expect(listKey).toBe('test:lw:wa:sessions:list');

    const statsKey = CacheKeyBuilder.sessionsStats();
    expect(statsKey).toBe('test:lw:wa:sessions:stats');
  });

  it('falls back to development environment when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;
    delete process.env.REDIS_KEY_PREFIX;

    expect(CacheKeyBuilder.sessionStatus('s1')).toBe('development:lw:wa:session:s1:status');
  });
});
