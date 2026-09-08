import {
  recordMessageSendMetric,
  getMessageSendMetrics,
  resetMessageSendMetrics,
} from './message-send-metrics';

describe('message-send-metrics', () => {
  beforeEach(() => {
    resetMessageSendMetrics();
  });

  it('records successful message send metrics with labels and duration', () => {
    recordMessageSendMetric('text', 'baileys', 'success', 120);
    recordMessageSendMetric('text', 'baileys', 'success', 80);

    const metrics = getMessageSendMetrics();
    expect(metrics.totalCount).toBe(2);
    expect(metrics.avgDurationMs).toBe(100);
    expect(metrics.counts.get('type="text",engine="baileys",status="success"')).toBe(2);
  });

  it('records failed message send metrics', () => {
    recordMessageSendMetric('image', 'wwebjs', 'failed', 50);

    const metrics = getMessageSendMetrics();
    expect(metrics.totalCount).toBe(1);
    expect(metrics.avgDurationMs).toBe(50);
    expect(metrics.counts.get('type="image",engine="wwebjs",status="failed"')).toBe(1);
  });

  it('resets metrics correctly', () => {
    recordMessageSendMetric('text', 'baileys', 'success', 100);
    resetMessageSendMetrics();

    const metrics = getMessageSendMetrics();
    expect(metrics.totalCount).toBe(0);
    expect(metrics.avgDurationMs).toBe(0);
    expect(metrics.counts.size).toBe(0);
  });
});
