/**
 * In-memory metrics tracking for outbound WhatsApp message operations.
 * Emitted as Prometheus counters and latency gauges.
 */

const sendCounts = new Map<string, number>();
let totalSendDurationMs = 0;
let totalSendCount = 0;

export function recordMessageSendMetric(
  type: string,
  engine: string,
  status: 'success' | 'failed',
  durationMs: number,
): void {
  const key = `type="${type}",engine="${engine}",status="${status}"`;
  sendCounts.set(key, (sendCounts.get(key) || 0) + 1);
  totalSendDurationMs += Math.max(0, durationMs);
  totalSendCount += 1;
}

export function getMessageSendMetrics(): {
  counts: Map<string, number>;
  avgDurationMs: number;
  totalCount: number;
} {
  return {
    counts: new Map(sendCounts),
    avgDurationMs: totalSendCount > 0 ? Math.round(totalSendDurationMs / totalSendCount) : 0,
    totalCount: totalSendCount,
  };
}

export function resetMessageSendMetrics(): void {
  sendCounts.clear();
  totalSendDurationMs = 0;
  totalSendCount = 0;
}

export function renderOutboundMessageMetrics(): string[] {
  const lines: string[] = [];
  lines.push('# HELP leadweave_outbound_messages_total Outbound messages dispatched through WhatsApp engines.');
  lines.push('# TYPE leadweave_outbound_messages_total counter');
  if (sendCounts.size === 0) {
    lines.push('leadweave_outbound_messages_total 0');
  } else {
    for (const [labels, count] of sendCounts.entries()) {
      lines.push(`leadweave_outbound_messages_total{${labels}} ${count}`);
    }
  }

  lines.push(
    '# HELP leadweave_outbound_message_avg_duration_ms Average duration in ms to dispatch an outbound message.',
  );
  lines.push('# TYPE leadweave_outbound_message_avg_duration_ms gauge');
  const avg = totalSendCount > 0 ? Math.round(totalSendDurationMs / totalSendCount) : 0;
  lines.push(`leadweave_outbound_message_avg_duration_ms ${avg}`);

  return lines;
}
