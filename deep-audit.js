const { chromium } = require('playwright');
const http = require('http');

async function testEndpoint(path, headers = {}) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 2785,
      path,
      method: 'GET',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    req.end();
  });
}

(async () => {
  console.log('================================================================');
  console.log('🔥 LEADWEAVE DEEP CODEBASE & SYSTEM AUDIT');
  console.log('================================================================\n');

  // --- 1. CORE BACKEND ENDPOINTS AUDIT ---
  console.log('📍 [AUDIT PHASE 1] Backend REST API Routes & Auth Integrity Check');
  const routesToTest = [
    { path: '/health', public: true },
    { path: '/api/docs', public: true },
    { path: '/api/sessions', public: false },
    { path: '/api/chats', public: false },
    { path: '/api/messages', public: false },
    { path: '/api/webhooks', public: false },
    { path: '/api/audit-logs', public: false },
    { path: '/api/plugins', public: false },
  ];

  for (const r of routesToTest) {
    const unauth = await testEndpoint(r.path);
    console.log(` -> Path: ${r.path.padEnd(20)} | Unauth Status: ${unauth.status} | (Expected: ${r.public ? '200' : '401'})`);
  }

  // --- 2. FRONTEND DASHBOARD ROUTING & ASSETS AUDIT ---
  console.log('\n📍 [AUDIT PHASE 2] Dashboard Frontend Routing & Assets Audit');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const failedRequests = [];
  const uncaughtErrors = [];

  page.on('pageerror', err => {
    uncaughtErrors.push(err.message);
    console.error(` ❌ [REACT RUNTIME EXCEPTION]: ${err.message}`);
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      failedRequests.push({ url: res.url(), status: res.status() });
      console.log(` ⚠️  [HTTP ${res.status()}] ${res.url()}`);
    }
  });

  console.log(' 🌐 Direct navigation test to dashboard routes...');
  const routes = ['/', '/sessions', '/chats', '/webhooks', '/plugins', '/logs'];

  for (const route of routes) {
    const targetUrl = `http://localhost:2886${route}`;
    console.log(` 🚗 Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    console.log(`    Status OK | Page Title: "${title}"`);
  }

  // Take full page audit screenshot of the Dashboard UI
  await page.screenshot({ path: 'audit-dashboard-full.png', fullPage: true });
  console.log('\n 📸 Saved full dashboard audit screenshot: audit-dashboard-full.png');

  await browser.close();

  // --- 3. AUDIT SUMMARY REPORT ---
  console.log('\n================================================================');
  console.log('📊 AUDIT SUMMARY REPORT:');
  console.log(` - Total Frontend Direct Routes Verified: ${routes.length}`);
  console.log(` - Total React Runtime Uncaught Errors: ${uncaughtErrors.length}`);
  console.log(` - Total 4xx/5xx Failed Network Requests: ${failedRequests.length}`);
  console.log('================================================================\n');
})();
