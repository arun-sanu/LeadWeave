/**
 * Comprehensive Application Telemetry & Diagnostic Logging Engine
 * Captures UI clicks, user journeys, Web Vitals, JS Heap memory, network latency,
 * exceptions, console events, and integrates with backend audit logs.
 * Includes automated 24-hour daily snapshots saved to local database storage (IndexedDB)
 * as text files with 91-day rolling FIFO retention (auto-pruned 1 by 1 after 91 days).
 */

import { auditApi, type AuditLog } from './api.ts';
import { idbGet, idbSet } from '../utils/indexedDbStore.ts';

export type TelemetryCategory =
  | 'click'
  | 'performance'
  | 'network'
  | 'error'
  | 'audit'
  | 'system';

export type TelemetrySeverity = 'info' | 'warn' | 'error' | 'critical' | 'telemetry' | 'perf' | 'debug';

export interface TelemetryEvent {
  id: string;
  timestamp: string;
  category: TelemetryCategory;
  severity: TelemetrySeverity;
  title: string;
  details?: Record<string, unknown> | string;
  source?: string;
  durationMs?: number;
  route?: string;
}

export interface PerformanceStats {
  fcp?: number;
  lcp?: number;
  cls?: number;
  fid?: number;
  inp?: number;
  ttfb?: number;
  domInteractive?: number;
  loadTime?: number;
  jsHeapUsedMB?: number;
  jsHeapTotalMB?: number;
  jsHeapLimitMB?: number;
  avgNetworkLatencyMs?: number;
  totalErrors?: number;
  totalClicks?: number;
}

export interface DailyLogSnapshot {
  id: string;
  date: string;
  timestamp: string;
  filename: string;
  content: string;
  sizeBytes: number;
  eventCount: number;
}

export const DAILY_LOG_ARCHIVE_KEY = 'leadweave_daily_log_archive';
export const MAX_RETENTION_DAYS = 91;

type TelemetryListener = (event: TelemetryEvent) => void;

class TelemetryService {
  private events: TelemetryEvent[] = [];
  private maxEvents = 1000;
  private listeners: Set<TelemetryListener> = new Set();
  private performanceStats: PerformanceStats = {};
  private networkLatencies: number[] = [];
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    this.logSystem('Telemetry Service Initialized', {
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${window.screen.width}x${window.screen.height}`,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cores: navigator.hardwareConcurrency || 'unknown',
    });

    this.setupClickTracker();
    this.setupErrorTracker();
    this.setupPerformanceObserver();
    this.measureInitialPerformance();
    this.scheduleDailyArchiveCheck();
  }

  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  public clearEvents() {
    this.events = [];
    this.networkLatencies = [];
    this.logSystem('Telemetry events buffer cleared by user');
  }

  public getPerformanceStats(): PerformanceStats {
    this.updateMemoryStats();
    if (this.networkLatencies.length > 0) {
      const avg =
        this.networkLatencies.reduce((a, b) => a + b, 0) /
        this.networkLatencies.length;
      this.performanceStats.avgNetworkLatencyMs = Math.round(avg);
    }
    const errors = this.events.filter(e => e.severity === 'error' || e.severity === 'critical').length;
    const clicks = this.events.filter(e => e.category === 'click').length;
    this.performanceStats.totalErrors = errors;
    this.performanceStats.totalClicks = clicks;

    return { ...this.performanceStats };
  }

  public logEvent(
    category: TelemetryCategory,
    severity: TelemetrySeverity,
    title: string,
    details?: Record<string, unknown> | string,
    durationMs?: number,
    source?: string
  ) {
    const event: TelemetryEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      category,
      severity,
      title,
      details,
      durationMs,
      source: source || 'app',
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    };

    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    this.listeners.forEach(fn => {
      try {
        fn(event);
      } catch (err) {
        console.error('Error in telemetry listener', err);
      }
    });
  }

  public logClick(target: string, meta?: Record<string, unknown>) {
    this.logEvent('click', 'telemetry', `Click: ${target}`, meta, undefined, 'ui_interaction');
  }

  public logPerformance(metricName: string, valueMs: number, meta?: Record<string, unknown>) {
    this.logEvent('performance', valueMs > 3000 ? 'warn' : 'perf', `Perf: ${metricName} = ${Math.round(valueMs)}ms`, {
      metric: metricName,
      valueMs,
      ...meta,
    }, valueMs, 'web_vitals');
  }

  public logNetwork(method: string, url: string, status: number, durationMs: number) {
    this.networkLatencies.push(durationMs);
    if (this.networkLatencies.length > 50) this.networkLatencies.shift();

    const isError = status >= 400;
    this.logEvent(
      'network',
      isError ? (status >= 500 ? 'critical' : 'error') : 'info',
      `${method} ${url} [${status}] (${Math.round(durationMs)}ms)`,
      { method, url, status, durationMs },
      durationMs,
      'http_client'
    );
  }

  public logError(message: string, stack?: string, details?: Record<string, unknown>) {
    this.logEvent('error', 'error', message, { stack, ...details }, undefined, 'exception_tracker');
  }

  public logSystem(title: string, details?: Record<string, unknown> | string) {
    this.logEvent('system', 'info', title, details, undefined, 'system_engine');
  }

  // Fetch backend audit logs and merge as audit events
  public async fetchAndMergeAuditLogs(): Promise<TelemetryEvent[]> {
    try {
      const res = await auditApi.list({ limit: 50 });
      const auditLogs: AuditLog[] = res?.data || [];

      const auditEvents: TelemetryEvent[] = auditLogs.map(log => ({
        id: `audit-${log.id}`,
        timestamp: log.createdAt,
        category: 'audit',
        severity: (log.severity === 'error' ? 'error' : log.severity === 'warn' ? 'warn' : 'info') as TelemetrySeverity,
        title: `Audit: ${log.action}`,
        details: {
          session: log.sessionName || log.sessionId,
          apiKey: log.apiKeyName || log.apiKeyId,
          ip: log.ipAddress,
          method: log.method,
          path: log.path,
          statusCode: log.statusCode,
          error: log.errorMessage,
        },
        source: 'backend_audit_trail',
        route: log.path || undefined,
      }));

      // Merge avoiding duplicates
      const existingIds = new Set(this.events.map(e => e.id));
      const newItems = auditEvents.filter(e => !existingIds.has(e.id));
      this.events = [...newItems, ...this.events].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(0, this.maxEvents);

      return this.events;
    } catch (err) {
      console.warn('Failed to merge backend audit logs:', err);
      return this.events;
    }
  }

  // Generate TXT report
  public exportAsTxt(additionalFilter?: { category?: string; severity?: string; search?: string }): string {
    const stats = this.getPerformanceStats();
    let rows = [...this.events];

    if (additionalFilter?.category && additionalFilter.category !== 'all') {
      rows = rows.filter(r => r.category === additionalFilter.category);
    }
    if (additionalFilter?.severity && additionalFilter.severity !== 'all') {
      rows = rows.filter(r => r.severity === additionalFilter.severity);
    }
    if (additionalFilter?.search) {
      const q = additionalFilter.search.toLowerCase();
      rows = rows.filter(
        r =>
          r.title.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          JSON.stringify(r.details || '').toLowerCase().includes(q)
      );
    }

    const timestamp = new Date().toISOString();
    const divider = '='.repeat(80);
    const subDivider = '-'.repeat(80);

    const lines: string[] = [
      divider,
      `  LEADWEAVE / OPENWA COMPREHENSIVE SYSTEM DIAGNOSTICS & TELEMETRY REPORT`,
      `  Generated At: ${timestamp}`,
      `  Active URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`,
      `  User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
      divider,
      '',
      '--- PERFORMANCE, MEMORY & BOTTLENECK METRICS ---',
      `  • Total Telemetry Events Captured : ${this.events.length}`,
      `  • Filtered Events in Export       : ${rows.length}`,
      `  • Total User Interactions (Clicks): ${stats.totalClicks || 0}`,
      `  • Total Logged Errors             : ${stats.totalErrors || 0}`,
      `  • Average API Latency             : ${stats.avgNetworkLatencyMs ? `${stats.avgNetworkLatencyMs} ms` : 'N/A'}`,
      `  • JS Heap Memory (Used / Total)   : ${stats.jsHeapUsedMB ? `${stats.jsHeapUsedMB} MB / ${stats.jsHeapTotalMB} MB (Limit: ${stats.jsHeapLimitMB} MB)` : 'N/A'}`,
      `  • TTFB (Time to First Byte)       : ${stats.ttfb ? `${Math.round(stats.ttfb)} ms` : 'N/A'}`,
      `  • DOM Interactive / Load Time     : ${stats.domInteractive ? `${Math.round(stats.domInteractive)} ms` : 'N/A'} / ${stats.loadTime ? `${Math.round(stats.loadTime)} ms` : 'N/A'}`,
      `  • Core Web Vitals (FCP / LCP / CLS): ${stats.fcp ? `${Math.round(stats.fcp)} ms` : 'N/A'} / ${stats.lcp ? `${Math.round(stats.lcp)} ms` : 'N/A'} / ${stats.cls ? stats.cls.toFixed(3) : '0.000'}`,
      '',
      subDivider,
      `  EVENT STREAM & DIAGNOSTIC LOG ENTRIES (${rows.length} records)`,
      subDivider,
      '',
    ];

    rows.forEach((evt, idx) => {
      lines.push(
        `[#${String(idx + 1).padStart(4, '0')}] [${evt.timestamp}] [${evt.severity.toUpperCase().padEnd(9, ' ')}] [${evt.category.toUpperCase().padEnd(11, ' ')}] ${evt.title}`
      );
      if (evt.route) {
        lines.push(`    Route   : ${evt.route}`);
      }
      if (evt.source) {
        lines.push(`    Source  : ${evt.source}`);
      }
      if (evt.durationMs !== undefined) {
        lines.push(`    Duration: ${Math.round(evt.durationMs)} ms`);
      }
      if (evt.details) {
        const detailsStr =
          typeof evt.details === 'string'
            ? evt.details
            : JSON.stringify(evt.details, null, 2).replace(/\n/g, '\n    ');
        lines.push(`    Details : ${detailsStr}`);
      }
      lines.push('');
    });

    lines.push(divider);
    lines.push('  END OF DIAGNOSTIC LOG DUMP');
    lines.push(divider);

    return lines.join('\n');
  }

  // =========================================================================
  // 24-Hour Snapshot Archival & 91-Day Rolling FIFO Retention Engine
  // =========================================================================

  /**
   * Retrieves all stored 24-hour log snapshots from local database storage (IndexedDB).
   */
  public async getDailySnapshots(): Promise<DailyLogSnapshot[]> {
    try {
      const stored = await idbGet<DailyLogSnapshot[]>(DAILY_LOG_ARCHIVE_KEY);
      return stored || [];
    } catch {
      return [];
    }
  }

  /**
   * Saves current 24-hour logs into local DB storage as a text file snapshot.
   * Enforces 91-day retention limit by deleting records older than 91 days 1 by 1 (FIFO).
   */
  public async saveDailySnapshot(customDate?: string): Promise<DailyLogSnapshot> {
    const todayStr = customDate || new Date().toISOString().slice(0, 10);
    const filename = `leadweave-system-logs-${todayStr}.txt`;
    const txtContent = this.exportAsTxt();
    const sizeBytes = new Blob([txtContent]).size;

    const newSnapshot: DailyLogSnapshot = {
      id: `snapshot-${todayStr}`,
      date: todayStr,
      timestamp: new Date().toISOString(),
      filename,
      content: txtContent,
      sizeBytes,
      eventCount: this.events.length,
    };

    const existing = await this.getDailySnapshots();

    // Upsert today's snapshot
    const filtered = existing.filter(s => s.date !== todayStr);
    const combined = [newSnapshot, ...filtered];

    // Sort by date descending (newest first)
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 91-Day Rolling Retention: Delete entries older than 91 days 1 by 1
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_RETENTION_DAYS);
    const cutoffTime = cutoffDate.getTime();

    const pruned = combined.filter(snapshot => {
      const snapTime = new Date(snapshot.date).getTime();
      return snapTime >= cutoffTime;
    });

    // Also enforce maximum array count of 91 days
    while (pruned.length > MAX_RETENTION_DAYS) {
      pruned.pop(); // Remove oldest 1 by 1
    }

    await idbSet(DAILY_LOG_ARCHIVE_KEY, pruned);
    this.logSystem(`24-Hour Log Snapshot archived (${filename}) with 91-day retention`);

    return newSnapshot;
  }

  /**
   * Download a stored daily snapshot as a .txt file.
   */
  public downloadSnapshot(snapshot: DailyLogSnapshot) {
    const blob = new Blob([snapshot.content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = snapshot.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Delete a single daily snapshot from local DB storage.
   */
  public async deleteSnapshot(id: string): Promise<void> {
    const existing = await this.getDailySnapshots();
    const updated = existing.filter(s => s.id !== id);
    await idbSet(DAILY_LOG_ARCHIVE_KEY, updated);
  }

  /**
   * Background schedule to check and auto-save the 24-hour daily snapshot
   * and purge snapshots > 91 days old.
   */
  private scheduleDailyArchiveCheck() {
    const checkAndArchive = async () => {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const existing = await this.getDailySnapshots();
        const hasToday = existing.some(s => s.date === todayStr);

        // If today's snapshot doesn't exist yet, or auto-syncing:
        if (!hasToday && this.events.length > 0) {
          await this.saveDailySnapshot(todayStr);
        }
      } catch (err) {
        console.warn('Daily archive rotation check failed:', err);
      }
    };

    // Run initial check after 5 seconds, then every 1 hour
    setTimeout(() => {
      void checkAndArchive();
    }, 5000);

    setInterval(() => {
      void checkAndArchive();
    }, 3600 * 1000);
  }

  // --- Private Internal Handlers ---

  private setupClickTracker() {
    window.addEventListener(
      'click',
      (e: MouseEvent) => {
        try {
          const target = e.target as HTMLElement | null;
          if (!target) return;

          const buttonOrLink = target.closest('button, a, input, [role="button"], [role="tab"], select, textarea');
          const element = buttonOrLink || target;

          const tagName = element.tagName.toLowerCase();
          const htmlEl = element as HTMLElement;
          const text = (htmlEl.innerText || htmlEl.textContent || (element as HTMLInputElement).value || (element as HTMLInputElement).placeholder || '')
            .trim()
            .slice(0, 50);
          const id = element.id ? `#${element.id}` : '';
          const className = element.className && typeof element.className === 'string' ? `.${element.className.split(' ').slice(0, 2).join('.')}` : '';

          const targetDescriptor = `<${tagName}${id}${className}> "${text.replace(/\s+/g, ' ')}"`;

          this.logClick(targetDescriptor, {
            tagName,
            id: element.id || undefined,
            className: element.className || undefined,
            textSnippet: text || undefined,
            coordinates: { x: Math.round(e.clientX), y: Math.round(e.clientY) },
          });
        } catch {
          // avoid breaking UI
        }
      },
      { capture: true, passive: true }
    );
  }

  private setupErrorTracker() {
    window.addEventListener('error', (event: ErrorEvent) => {
      this.logError(
        event.message || 'Uncaught JavaScript Exception',
        event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }
      );
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
          ? reason
          : 'Unhandled Promise Rejection';
      const stack = reason instanceof Error ? reason.stack : undefined;
      this.logError(`Unhandled Promise: ${message}`, stack, { reason: String(reason) });
    });
  }

  private setupPerformanceObserver() {
    try {
      if ('PerformanceObserver' in window) {
        // Observe paint (FCP)
        const paintObserver = new PerformanceObserver(entryList => {
          for (const entry of entryList.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              this.performanceStats.fcp = entry.startTime;
              this.logPerformance('First Contentful Paint (FCP)', entry.startTime);
            }
          }
        });
        paintObserver.observe({ type: 'paint', buffered: true });

        // Observe LCP
        const lcpObserver = new PerformanceObserver(entryList => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            this.performanceStats.lcp = lastEntry.startTime;
            this.logPerformance('Largest Contentful Paint (LCP)', lastEntry.startTime);
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

        // Observe Long Tasks (Bottlenecks)
        try {
          const longTaskObserver = new PerformanceObserver(entryList => {
            for (const entry of entryList.getEntries()) {
              if (entry.duration > 50) {
                this.logEvent(
                  'performance',
                  'warn',
                  `Main Thread Bottleneck (Long Task: ${Math.round(entry.duration)}ms)`,
                  {
                    durationMs: entry.duration,
                    startTime: entry.startTime,
                    name: entry.name,
                  },
                  entry.duration,
                  'browser_engine'
                );
              }
            }
          });
          longTaskObserver.observe({ type: 'longtask', buffered: true });
        } catch {
          // Long task observer may not be supported on all browsers
        }
      }
    } catch {
      // PerformanceObserver error fallback
    }
  }

  private measureInitialPerformance() {
    setTimeout(() => {
      try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (nav) {
          this.performanceStats.ttfb = nav.responseStart - nav.requestStart;
          this.performanceStats.domInteractive = nav.domInteractive;
          this.performanceStats.loadTime = nav.loadEventEnd;

          this.logPerformance('Time to First Byte (TTFB)', this.performanceStats.ttfb);
          this.logPerformance('DOM Interactive', this.performanceStats.domInteractive);
          this.logPerformance('Full Page Load', this.performanceStats.loadTime);
        }
      } catch {
        // ignore
      }
    }, 1000);
  }

  private updateMemoryStats() {
    try {
      const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      if (perfMemory) {
        this.performanceStats.jsHeapUsedMB = Math.round((perfMemory.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
        this.performanceStats.jsHeapTotalMB = Math.round((perfMemory.totalJSHeapSize / (1024 * 1024)) * 10) / 10;
        this.performanceStats.jsHeapLimitMB = Math.round((perfMemory.jsHeapSizeLimit / (1024 * 1024)) * 10) / 10;
      }
    } catch {
      // ignore
    }
  }
}

export const telemetryService = new TelemetryService();
