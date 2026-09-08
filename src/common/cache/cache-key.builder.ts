/**
 * Standardized Redis Key Schema Enforcer adhering to `validate_redis_key_schemas`:
 * Pattern: ^{env}:{namespace}:{entity}:{id}:{attr}
 */
export class CacheKeyBuilder {
  static getPrefix(): string {
    const env = process.env.NODE_ENV || 'development';
    const namespace = process.env.REDIS_KEY_PREFIX || 'lw';
    return `${env}:${namespace}:wa`;
  }

  static sessionStatus(id: string): string {
    return `${this.getPrefix()}:session:${id}:status`;
  }

  static sessionInfo(id: string): string {
    return `${this.getPrefix()}:session:${id}:info`;
  }

  static sessionQr(id: string): string {
    return `${this.getPrefix()}:session:${id}:qr`;
  }

  static sessionsList(): string {
    return `${this.getPrefix()}:sessions:list`;
  }

  static sessionsStats(): string {
    return `${this.getPrefix()}:sessions:stats`;
  }

  static pacingBreaker(sessionId: string): string {
    return `${this.getPrefix()}:pacing:breaker:${sessionId}`;
  }

  static pacingStreak(sessionId: string): string {
    return `${this.getPrefix()}:pacing:streak:${sessionId}`;
  }

  static pacingGroupReachout(sessionId: string, dateStr: string): string {
    return `${this.getPrefix()}:pacing:group_reachout:${sessionId}:${dateStr}`;
  }

  static authEvictChannel(): string {
    return `${this.getPrefix()}:auth:evict`;
  }
}
