import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Session, SessionStatus } from '../session/entities/session.entity';
import { Message, MessageStatus } from '../message/entities/message.entity';
import { CacheService } from '../../common/cache';

/** SQL for the integer hour-of-day (0-23) bucket, per DB dialect. */
export function hourBucketSql(dbType: string): string {
  return dbType === 'postgres'
    ? `CAST(EXTRACT(HOUR FROM m."createdAt") AS INTEGER)`
    : `CAST(strftime('%H', m.createdAt) AS INTEGER)`;
}

export interface OverviewStats {
  sessions: {
    active: number;
    total: number;
    byStatus: Record<string, number>;
  };
  messages: {
    sent: number;
    received: number;
    failed: number;
    today: { sent: number; received: number };
  };
}

export interface SessionStats {
  session: { id: string; name: string; status: string };
  messages: { sent: number; received: number; today: number; failed: number };
  hourlyActivity: Array<{ hour: number; sent: number; received: number }>;
}

@Injectable()
export class StatsService {
  /**
   * In-process TTL memo for the aggregate responses, keyed by query shape ('overview',
   * 'session:<id>'). The aggregates run GROUP BY scans over the messages table — on the default
   * SQLite backend synchronously on the event loop — so polling would otherwise re-run them on
   * every request. TTL-only invalidation: entries expire after stats.cacheTtlMs; there is no
   * write-path hook. Session-scoped entries are additionally re-validated on serve (getSessionStats),
   * so a deleted session is not resurrected from the memo. Key cardinality is bounded (1 global
   * shape + one per session), so no size eviction is needed.
   */
  private readonly memo = new Map<string, { expiresAt: number; value: unknown }>();

  constructor(
    @InjectRepository(Session, 'data')
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Message, 'data')
    private readonly messageRepo: Repository<Message>,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  /** The data-connection dialect ('sqlite' | 'postgres'), used to pick portable date SQL. */
  private get dataDbType(): string {
    return this.messageRepo.manager.dataSource.options.type;
  }

  /** Memo TTL in ms; 0 disables memoization (every request hits the DB). Read per call. */
  private get memoTtlMs(): number {
    return this.configService.get<number>('stats.cacheTtlMs', 30000);
  }

  /** Returns the memoized value for `key` while fresh; otherwise computes, stores, returns it. */
  private async memoized<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const ttl = this.memoTtlMs;
    if (ttl <= 0) return compute();
    const now = Date.now();
    const hit = this.memo.get(key);
    if (hit && hit.expiresAt > now) return hit.value as T;
    const value = await compute();
    this.memo.set(key, { expiresAt: now + ttl, value });
    return value;
  }

  async getOverview(): Promise<OverviewStats> {
    return this.memoized('overview', () => this.loadOverview());
  }

  private async loadOverview(): Promise<OverviewStats> {
    // Get session stats
    const sessions = await this.sessionRepo.find();
    const byStatus: Record<string, number> = {};
    let active = 0;

    for (const session of sessions) {
      byStatus[session.status] = (byStatus[session.status] || 0) + 1;
      if (session.status === SessionStatus.READY) active++;
    }

    // Get message stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const messageStats = await this.messageRepo
      .createQueryBuilder('m')
      .select('m.direction', 'direction')
      .addSelect('COUNT(*)', 'count')
      .groupBy('m.direction')
      .getRawMany<{ direction: string; count: string }>();

    const todayStats = await this.messageRepo
      .createQueryBuilder('m')
      .select('m.direction', 'direction')
      .addSelect('COUNT(*)', 'count')
      .where('m.createdAt >= :todayStart', { todayStart })
      .groupBy('m.direction')
      .getRawMany<{ direction: string; count: string }>();

    const sent = parseInt(messageStats.find(m => m.direction === 'outgoing')?.count || '0');
    const received = parseInt(messageStats.find(m => m.direction === 'incoming')?.count || '0');
    const todaySent = parseInt(todayStats.find(m => m.direction === 'outgoing')?.count || '0');
    const todayReceived = parseInt(todayStats.find(m => m.direction === 'incoming')?.count || '0');

    // Count failed messages
    const failed = await this.messageRepo.count({
      where: { status: MessageStatus.FAILED },
    });

    // Cache session stats
    await this.cacheService.setSessionsStats({
      active,
      total: sessions.length,
      byStatus,
    });

    return {
      sessions: {
        active,
        total: sessions.length,
        byStatus,
      },
      messages: {
        sent,
        received,
        failed,
        today: { sent: todaySent, received: todayReceived },
      },
    };
  }

  async getSessionStats(sessionId: string): Promise<SessionStats> {
    // The memo has no write-path hook, so a `session:<id>` entry can outlive its session row and
    // would keep serving a deleted session's stats until the TTL expires. Re-check existence on
    // every call — a cheap primary-key lookup next to the aggregate scans the memo exists to
    // avoid — and drop the stale entry instead of serving it.
    const key = `session:${sessionId}`;
    if ((await this.sessionRepo.count({ where: { id: sessionId } })) === 0) {
      this.memo.delete(key);
      throw new NotFoundException('Session not found');
    }
    return this.memoized(key, () => this.loadSessionStats(sessionId));
  }

  private async loadSessionStats(sessionId: string): Promise<SessionStats> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Message counts
    const stats = await this.messageRepo
      .createQueryBuilder('m')
      .select('m.direction', 'direction')
      .addSelect('COUNT(*)', 'count')
      .where('m.sessionId = :sessionId', { sessionId })
      .groupBy('m.direction')
      .getRawMany<{ direction: string; count: string }>();

    const todayCount = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.sessionId = :sessionId', { sessionId })
      .andWhere('m.createdAt >= :todayStart', { todayStart })
      .getCount();

    const sent = parseInt(stats.find(s => s.direction === 'outgoing')?.count || '0');
    const received = parseInt(stats.find(s => s.direction === 'incoming')?.count || '0');

    // Count failed messages for this session
    const failed = await this.messageRepo.count({
      where: { sessionId, status: MessageStatus.FAILED },
    });

    // Hourly activity (last 24h)
    const hourlyActivity = await this.getHourlyActivity(sessionId);

    return {
      session: { id: session.id, name: session.name, status: session.status },
      messages: { sent, received, today: todayCount, failed },
      hourlyActivity,
    };
  }

  private async getHourlyActivity(sessionId: string): Promise<Array<{ hour: number; sent: number; received: number }>> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const raw = await this.messageRepo
      .createQueryBuilder('m')
      .select(hourBucketSql(this.dataDbType), 'hour')
      .addSelect(`SUM(CASE WHEN m.direction = 'outgoing' THEN 1 ELSE 0 END)`, 'sent')
      .addSelect(`SUM(CASE WHEN m.direction = 'incoming' THEN 1 ELSE 0 END)`, 'received')
      .where('m.sessionId = :sessionId', { sessionId })
      .andWhere('m.createdAt >= :since', { since })
      .groupBy('hour')
      .orderBy('hour', 'ASC')
      .getRawMany<{ hour: string; sent: string; received: string }>();

    // Fill in missing hours
    const result: Array<{ hour: number; sent: number; received: number }> = [];
    const hourMap = new Map(raw.map(r => [parseInt(r.hour), r]));

    for (let h = 0; h < 24; h++) {
      const data = hourMap.get(h);
      result.push({
        hour: h,
        sent: data ? parseInt(data.sent || '0') : 0,
        received: data ? parseInt(data.received || '0') : 0,
      });
    }

    return result;
  }
}
