const { chromium } = require('playwright');
const http = require('http');

async function testBackendEndpoint(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:2785${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', (err) => resolve({ status: 500, error: err.message }));
  });
}

(async () => {
  console.log('=============== 🩺 LEADWEAVE REALTIME DIAGNOSTIC AUDIT ===============');
  
  // 1. Check Backend Endpoints
  console.log('\n--- 1. BACKEND ENGINE (Port 2785) ---');
  const healthRes = await testBackendEndpoint('/health');
  console.log(`[GET /health]: Status ${healthRes.status} | Output: ${healthRes.body || healthRes.error}`);
  
  const swaggerRes = await testBackendEndpoint('/api/docs');
  console.log(`[GET /api/docs]: Status ${swaggerRes.status}`);

  const sessionsRes = await testBackendEndpoint('/api/sessions');
  console.log(`[GET /api/sessions]: Status ${sessionsRes.status} | Output: ${sessionsRes.body.substring(0, 150)}`);

  // 2. Realtime Browser UI & Console Diagnostic
  console.log('\n--- 2. FRONTEND DASHBOARD & BROWSER (Port 2886) ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs = [];
  const networkErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      console.log(`❌ [Browser Console Error]: ${text}`);
    }
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push({ url: response.url(), status: response.status() });
      console.log(`⚠️  [Network Fail ${response.status()}]: ${response.url()}`);
    }
  });

  console.log('🌐 Loading http://localhost:2886...');
  await page.goto('http://localhost:2886', { waitUntil: 'networkidle' });

  // Test local storage / Auth bypass check if demo token present
  console.log('🔑 Checking localStorage & App State...');
  const localStorageData = await page.evaluate(() => JSON.stringify(localStorage));
  console.log(`localStorage: ${localStorageData}`);

  // Test interaction: Type company name if on login screen
  const companyInput = await page.$('input[placeholder*="Company"], input');
  if (companyInput) {
    console.log('👇 Found login input field, filling test company "default"...');
    await companyInput.fill('default');
    const nextBtn = await page.$('button');
    if (nextBtn) {
      await nextBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  await page.screenshot({ path: 'diag-login-step.png' });
  console.log('📸 Captured screenshot: diag-login-step.png');

  await browser.close();

  console.log('\n--- 3. SUMMARY OF DIAGNOSTIC ---');
  console.log(`Total Console Logs Recorded: ${consoleLogs.length}`);
  console.log(`Total Network 4xx/5xx Errors: ${networkErrors.length}`);
  console.log('========================================================================\n');
})();
