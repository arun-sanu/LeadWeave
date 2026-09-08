import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StatsService, hourBucketSql } from './stats.service';
import { Session, SessionStatus } from '../session/entities/session.entity';
import { Message, MessageDirection, MessageStatus } from '../message/entities/message.entity';

describe('stats SQL dialect helpers', () => {
  it('uses strftime on sqlite (hour bucket)', () => {
    expect(hourBucketSql('sqlite')).toBe(`CAST(strftime('%H', m.createdAt) AS INTEGER)`);
  });

  it('uses to_char/extract with a quoted createdAt on postgres', () => {
    expect(hourBucketSql('postgres')).toBe(`CAST(EXTRACT(HOUR FROM m."createdAt") AS INTEGER)`);
  });
});

describe('StatsService hourly activity on SQLite (end-to-end regression)', () => {
  let ds: DataSource;
  let service: StatsService;

  beforeEach(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Session, Message],
      synchronize: true,
    });
    await ds.initialize();
    const cache = { setSessionsStats: jest.fn() };
    const config = { get: () => 30000 };
    service = new StatsService(ds.getRepository(Session), ds.getRepository(Message), cache as never, config as never);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  const seedMessage = (over: Partial<Message>) =>
    ds.getRepository(Message).save(
      ds.getRepository(Message).create({
        sessionId: 's1',
        chatId: 'c1',
        from: 'a',
        to: 'b',
        type: 'text',
        direction: MessageDirection.OUTGOING,
        status: MessageStatus.SENT,
        ...over,
      }),
    );

  it('getSessionStats returns 24 hourly buckets with the right counts', async () => {
    await ds
      .getRepository(Session)
      .save(ds.getRepository(Session).create({ id: 's1', name: 'n', status: SessionStatus.READY, config: {} }));
    await seedMessage({ direction: MessageDirection.OUTGOING });
    await seedMessage({ direction: MessageDirection.OUTGOING });
    await seedMessage({ direction: MessageDirection.INCOMING });

    const stats = await service.getSessionStats('s1');
    expect(stats.hourlyActivity).toHaveLength(24);
    const totals = stats.hourlyActivity.reduce(
      (acc, h) => ({ sent: acc.sent + h.sent, received: acc.received + h.received }),
      { sent: 0, received: 0 },
    );
    expect(totals.sent).toBe(2);
    expect(totals.received).toBe(1);
  });
});

describe('StatsService aggregate memo (in-process TTL)', () => {
  let ds: DataSource;

  beforeEach(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Session, Message],
      synchronize: true,
    });
    await ds.initialize();
    const sessions = ds.getRepository(Session);
    await sessions.save(sessions.create({ id: 's1', name: 'n1', status: SessionStatus.READY, config: {} }));
    await sessions.save(sessions.create({ id: 's2', name: 'n2', status: SessionStatus.READY, config: {} }));
    const messages = ds.getRepository(Message);
    const base = {
      chatId: 'c1',
      from: 'a',
      to: 'b',
      type: 'text',
      direction: MessageDirection.OUTGOING,
      status: MessageStatus.SENT,
    };
    await messages.save(messages.create({ ...base, sessionId: 's1' }));
    await messages.save(messages.create({ ...base, sessionId: 's2' }));
  });

  afterEach(async () => {
    await ds.destroy();
  });

  const makeService = (ttlMs: number) =>
    new StatsService(
      ds.getRepository(Session),
      ds.getRepository(Message),
      { setSessionsStats: jest.fn() } as never,
      { get: () => ttlMs } as never,
    );

  it('serves a repeated identical call from the memo within the TTL (no second DB hit)', async () => {
    const service = makeService(30000);
    const spy = jest.spyOn(ds.getRepository(Message), 'createQueryBuilder');

    await service.getOverview();
    const afterFirst = spy.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    await service.getOverview();
    expect(spy.mock.calls.length).toBe(afterFirst);
  });

  it('re-runs the aggregate once the TTL has expired', async () => {
    const service = makeService(30000);
    const spy = jest.spyOn(ds.getRepository(Message), 'createQueryBuilder');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    try {
      await service.getOverview();
      const afterFirst = spy.mock.calls.length;

      nowSpy.mockReturnValue(1_000_000 + 30_001);
      await service.getOverview();
      expect(spy.mock.calls.length).toBeGreaterThan(afterFirst);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('keys the memo by query shape and by session id', async () => {
    const service = makeService(30000);
    const spy = jest.spyOn(ds.getRepository(Message), 'createQueryBuilder');

    await service.getOverview();
    const n = spy.mock.calls.length;

    await service.getSessionStats('s1');
    await service.getSessionStats('s1'); // memo hit — no new queries
    const afterS1 = spy.mock.calls.length;
    expect(afterS1).toBeGreaterThan(n);

    await service.getSessionStats('s2'); // different session → different key → DB hit
    expect(spy.mock.calls.length).toBeGreaterThan(afterS1);
  });

  it('a 0 TTL disables the memo (every call hits the DB)', async () => {
    const service = makeService(0);
    const spy = jest.spyOn(ds.getRepository(Message), 'createQueryBuilder');

    await service.getOverview();
    const n = spy.mock.calls.length;
    await service.getOverview();
    expect(spy.mock.calls.length).toBeGreaterThan(n);
  });

  it('does not serve a deleted session from the memo — the stale entry is evicted, not served', async () => {
    const service = makeService(30000);

    const first = await service.getSessionStats('s1'); // populates the 'session:s1' memo entry
    expect(first.session.name).toBe('n1');

    await ds.getRepository(Session).delete('s1');
    // Within the TTL the memo still holds the deleted session's snapshot; serving it would
    // resurrect a deleted session with a 200 instead of the honest 404.
    await expect(service.getSessionStats('s1')).rejects.toThrow(NotFoundException);

    // The stale entry is evicted, not just bypassed: a re-created session recomputes immediately
    // instead of waiting out the TTL with the pre-delete snapshot.
    await ds
      .getRepository(Session)
      .save(
        ds.getRepository(Session).create({ id: 's1', name: 'n1-recreated', status: SessionStatus.READY, config: {} }),
      );
    const recomputed = await service.getSessionStats('s1');
    expect(recomputed.session.name).toBe('n1-recreated');
  });
});
