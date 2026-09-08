import '../test-helpers/register-hooks.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { telemetryService, MAX_RETENTION_DAYS } from './telemetry.ts';

describe('TelemetryService', () => {
  it('should log click events with metadata', () => {
    telemetryService.logClick('button#save-btn', { screen: 'storage' });
    const events = telemetryService.getEvents();
    const clickEvent = events.find(e => e.title.includes('button#save-btn'));

    assert.ok(clickEvent, 'Click event should be logged');
    assert.strictEqual(clickEvent.category, 'click');
    assert.strictEqual(clickEvent.severity, 'telemetry');
  });

  it('should log performance metrics and update stats', () => {
    telemetryService.logPerformance('Test Latency Metric', 150);
    const stats = telemetryService.getPerformanceStats();

    assert.ok(typeof stats.totalClicks === 'number');
    assert.ok(typeof stats.totalErrors === 'number');
  });

  it('should format full diagnostic dump as .txt', () => {
    telemetryService.logError('Test synthetic exception for diagnostic verification');
    const txtOutput = telemetryService.exportAsTxt();

    assert.ok(txtOutput.includes('LEADWEAVE / OPENWA COMPREHENSIVE SYSTEM DIAGNOSTICS & TELEMETRY REPORT'));
    assert.ok(txtOutput.includes('Test synthetic exception for diagnostic verification'));
    assert.ok(txtOutput.includes('END OF DIAGNOSTIC LOG DUMP'));
  });

  it('should save 24-hour daily snapshots with 91-day rolling retention', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const snap = await telemetryService.saveDailySnapshot(today);

    assert.strictEqual(snap.date, today);
    assert.ok(snap.filename.includes(today));
    assert.ok(snap.content.includes('LEADWEAVE / OPENWA COMPREHENSIVE SYSTEM DIAGNOSTICS & TELEMETRY REPORT'));

    const allSnaps = await telemetryService.getDailySnapshots();
    assert.ok(allSnaps.length >= 1);
    assert.ok(allSnaps.length <= MAX_RETENTION_DAYS);
  });
});
