import '../test-helpers/register-hooks.ts';
import { test, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Campaign, CampaignLead, CampaignStats, CampaignAnalytics as ICampaignAnalytics } from '../services/api';
import type { installJsdomGlobals as installJsdomGlobalsFn } from '../test-helpers/jsdom.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const STATS: CampaignStats = {
  total: 150,
  sent: 120,
  delivered: 110,
  read: 95,
  replied: 30,
  failed: 5,
  pending: 25,
  deliveryRate: 91.6,
  readRate: 79.1,
  replyRate: 25.0,
};

const CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-1',
    name: 'Summer Sale Broadcast',
    status: 'running',
    sessionIds: ['session-1'],
    template: 'Hello {{name}}',
    stats: STATS,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'camp-2',
    name: 'VIP Outreach',
    status: 'completed',
    sessionIds: ['session-1'],
    template: 'VIP exclusive {{name}}',
    stats: { ...STATS, total: 50, sent: 50, delivered: 48, read: 45, failed: 0, pending: 0 },
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
];

const ANALYTICS: ICampaignAnalytics = {
  campaign: CAMPAIGNS[0],
  stats: STATS,
  funnel: [
    { stage: 'Total', count: 150, percent: 100 },
    { stage: 'Sent', count: 120, percent: 80 },
    { stage: 'Delivered', count: 110, percent: 73.3 },
    { stage: 'Read', count: 95, percent: 63.3 },
    { stage: 'Replied', count: 30, percent: 20 },
  ],
  timeline: [
    { time: '10:00', replies: 12, optOuts: 1 },
    { time: '11:00', replies: 18, optOuts: 0 },
  ],
};

const LEADS: CampaignLead[] = [
  {
    id: 'lead-1',
    phone: '15551234567',
    name: 'John Doe',
    status: 'read',
    sentAt: '2026-06-01T10:05:00.000Z',
    deliveredAt: '2026-06-01T10:05:30.000Z',
    readAt: '2026-06-01T10:10:00.000Z',
  },
  {
    id: 'lead-2',
    phone: '15559876543',
    name: 'Jane Smith',
    status: 'failed',
    errorMessage: 'Number unreachable',
    sentAt: '2026-06-01T10:06:00.000Z',
  },
];

interface FetchCall {
  method: string;
  path: string;
  body?: string;
}

const fetchCalls: FetchCall[] = [];

function installFetchStub(): void {
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const body = typeof init?.body === 'string' ? init.body : undefined;
    fetchCalls.push({ method, path, body });

    let responseData: unknown = [];
    if (path.startsWith('/api/campaigns') && !path.includes('/analytics') && !path.includes('/leads') && !path.includes('/camp-1') && !path.includes('/pause')) {
      responseData = { items: CAMPAIGNS, total: CAMPAIGNS.length };
    } else if (path.includes('/analytics')) {
      responseData = ANALYTICS;
    } else if (path.includes('/leads')) {
      responseData = { items: LEADS, total: LEADS.length };
    } else if (path === '/api/campaigns/camp-1') {
      responseData = CAMPAIGNS[0];
    } else if (method === 'POST' && (path.includes('/pause') || path.includes('/start') || path.includes('/stop'))) {
      responseData = { success: true };
    }

    return Promise.resolve(
      new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
}

type RTL = typeof import('@testing-library/react');
type CampaignAnalyticsModule = typeof import('./CampaignAnalytics.tsx');
type ToastProviderModule = typeof import('../components/Toast.tsx');
type RoleModule = typeof import('../components/RoleProvider.tsx');

let rtl: RTL;
let CampaignAnalytics: CampaignAnalyticsModule['CampaignAnalytics'];
let ToastProvider: ToastProviderModule['ToastProvider'];
let RoleProvider: RoleModule['RoleProvider'];
let installJsdomGlobals: typeof installJsdomGlobalsFn;

before(async () => {
  ({ installJsdomGlobals } = await import('../test-helpers/jsdom.ts'));
  await installJsdomGlobals();
  installFetchStub();

  const { i18nReady } = await import('../i18n/index.ts');
  await i18nReady;

  rtl = await import('@testing-library/react');
  ({ CampaignAnalytics } = await import('./CampaignAnalytics.tsx'));
  ({ ToastProvider } = await import('../components/Toast.tsx'));
  ({ RoleProvider } = await import('../components/RoleProvider.tsx'));
});

afterEach(() => {
  rtl.cleanup();
  fetchCalls.length = 0;
});

function renderAnalytics() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return rtl.render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        RoleProvider,
        { initialRole: 'admin' },
        createElement(ToastProvider, null, createElement(CampaignAnalytics)),
      ),
    ),
  );
}

test('renders campaign selection and metrics cards', async () => {
  renderAnalytics();

  const select = await rtl.screen.findByRole('combobox');
  assert.ok(select);

  // Check metrics rendered
  const totalLeads = await rtl.screen.findByText(/150/);
  assert.ok(totalLeads);
});

test('renders leads table with contacts and statuses', async () => {
  renderAnalytics();

  const leadName = await rtl.screen.findByText('John Doe');
  assert.ok(leadName);

  const phone = await rtl.screen.findByText(/15551234567/);
  assert.ok(phone);

  const failedLead = await rtl.screen.findByText('Jane Smith');
  assert.ok(failedLead);
});

test('filters leads by search query in the search input', async () => {
  renderAnalytics();

  await rtl.screen.findByText('John Doe');
  const searchInput = rtl.screen.getByPlaceholderText(/search/i);

  rtl.fireEvent.change(searchInput, { target: { value: 'Jane' } });

  await rtl.waitFor(() => {
    assert.ok(rtl.screen.getByText('Jane Smith'));
    assert.equal(rtl.screen.queryByText('John Doe'), null);
  });
});

test('pauses active campaign when pause button is clicked', async () => {
  renderAnalytics();

  await rtl.screen.findByText('John Doe');

  const pauseBtn = rtl.screen.getByRole('button', { name: /pause/i });
  rtl.fireEvent.click(pauseBtn);

  await rtl.waitFor(() => {
    const hasPauseCall = fetchCalls.some(c => c.method === 'POST' && c.path.includes('/pause'));
    assert.ok(hasPauseCall, 'Expected POST /pause call');
  });
});
