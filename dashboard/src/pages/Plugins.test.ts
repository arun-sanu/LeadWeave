import '../test-helpers/register-hooks.ts';
import { test, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Plugin, CatalogPlugin, Session } from '../services/api';
import type { installJsdomGlobals as installJsdomGlobalsFn } from '../test-helpers/jsdom.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SESSIONS: Session[] = [
  {
    id: 'session-1',
    name: 'Main Session',
    status: 'ready',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const PLUGINS = [
  {
    id: 'lead-enricher',
    name: 'Lead Enricher',
    version: '1.0.0',
    type: 'extension',
    description: 'Enriches lead profiles with public company metadata',
    author: 'LeadWeave Team',
    enabled: true,
    status: 'enabled',
    hasConfigUi: false,
    config: { apiKey: '***', minScore: 50 },
    configSchema: {
      type: 'object' as const,
      properties: {
        apiKey: { title: 'API Key', type: 'string', secret: true },
        minScore: { title: 'Minimum Score', type: 'number', default: 50 },
      },
    },
  },
  {
    id: 'postgres-storage',
    name: 'PostgreSQL Storage',
    version: '2.1.0',
    type: 'storage',
    description: 'Persists chat history and media to PostgreSQL',
    author: 'LeadWeave',
    enabled: false,
    status: 'disabled',
    hasConfigUi: false,
    config: {},
  },
] as unknown as Plugin[];

const CATALOG = [
  {
    id: 'slack-sync',
    name: 'Slack Sync',
    version: '1.2.0',
    type: 'extension',
    description: 'Sync WhatsApp incoming messages into Slack channels',
    author: 'Community',
    installed: false,
    stars: 120,
    downloads: 4500,
  },
] as unknown as CatalogPlugin[];

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
    if (path === '/api/plugins') {
      responseData = PLUGINS;
    } else if (path === '/api/plugins/catalog') {
      responseData = CATALOG;
    } else if (path === '/api/sessions') {
      responseData = SESSIONS;
    } else if (method === 'POST' && path.includes('/enable')) {
      responseData = { success: true };
    } else if (method === 'POST' && path.includes('/disable')) {
      responseData = { success: true };
    } else if (method === 'PUT' && path.includes('/config')) {
      responseData = { success: true, config: JSON.parse(body || '{}') };
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
type PluginsPageModule = typeof import('./Plugins.tsx');
type RoleProviderModule = typeof import('../components/RoleProvider.tsx');
type ToastProviderModule = typeof import('../components/Toast.tsx');

let rtl: RTL;
let Plugins: PluginsPageModule['default'];
let RoleProvider: RoleProviderModule['RoleProvider'];
let ToastProvider: ToastProviderModule['ToastProvider'];
let installJsdomGlobals: typeof installJsdomGlobalsFn;

before(async () => {
  ({ installJsdomGlobals } = await import('../test-helpers/jsdom.ts'));
  await installJsdomGlobals();
  installFetchStub();

  const { i18nReady } = await import('../i18n/index.ts');
  await i18nReady;

  rtl = await import('@testing-library/react');
  ({ default: Plugins } = await import('./Plugins.tsx'));
  ({ RoleProvider } = await import('../components/RoleProvider.tsx'));
  ({ ToastProvider } = await import('../components/Toast.tsx'));
});

afterEach(() => {
  rtl.cleanup();
  fetchCalls.length = 0;
});

function renderPlugins(initialRole = 'admin') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return rtl.render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        RoleProvider,
        { initialRole: initialRole as 'admin' },
        createElement(ToastProvider, null, createElement(Plugins)),
      ),
    ),
  );
}

test('renders installed plugins and count stats', async () => {
  renderPlugins();

  const headings = await rtl.screen.findAllByText('Lead Enricher');
  assert.ok(headings.length > 0);

  const pgPlugin = await rtl.screen.findByText('PostgreSQL Storage');
  assert.ok(pgPlugin);

  // Checks rail stats
  assert.ok(rtl.screen.getByText('installed'));
});

test('toggles plugin status between enabled and disabled', async () => {
  renderPlugins();

  await rtl.screen.findAllByText('Lead Enricher');

  // Find toggle or disable button for Lead Enricher
  const disableBtns = rtl.screen.getAllByRole('button', { name: /disable/i });
  assert.ok(disableBtns.length > 0);

  rtl.fireEvent.click(disableBtns[0]);

  await rtl.waitFor(() => {
    const hasDisableCall = fetchCalls.some(c => c.method === 'POST' && c.path.includes('/disable'));
    assert.ok(hasDisableCall, 'Expected a POST /disable call');
  });
});

test('opens plugin settings modal when configure button is clicked', async () => {
  renderPlugins();

  await rtl.screen.findAllByText('Lead Enricher');

  const configBtns = rtl.screen.getAllByRole('button', { name: /configure/i });
  assert.ok(configBtns.length > 0);

  rtl.fireEvent.click(configBtns[0]);

  // Modal opens and shows configuration settings
  await rtl.waitFor(() => {
    const modals = rtl.screen.getAllByRole('dialog');
    assert.ok(modals.length > 0);
  });
});

test('opens install plugin modal when install button is clicked', async () => {
  renderPlugins();

  await rtl.screen.findAllByText('Lead Enricher');

  const installBtn = rtl.screen.getByRole('button', { name: /install plugin/i });
  rtl.fireEvent.click(installBtn);

  // Install modal opens
  await rtl.waitFor(() => {
    const modals = rtl.screen.getAllByRole('dialog');
    assert.ok(modals.length > 0);
  });
});
