const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Launching Chromium browser test...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log(`[Dashboard Console ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[Dashboard Error]:', err.message));

  console.log('🌐 Connecting to Dashboard UI (http://localhost:2886)...');
  try {
    const res = await page.goto('http://localhost:2886', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log(`✅ Dashboard HTTP Status: ${res.status()}`);
    console.log(`📄 Dashboard Title: "${await page.title()}"`);
    await page.screenshot({ path: 'dashboard-realtime.png' });
    console.log('📸 Saved dashboard-realtime.png');
  } catch (err) {
    console.error('❌ Dashboard connection error:', err.message);
  }

  console.log('\n🌐 Connecting to LeadWeave NestJS Backend (http://localhost:2785/api)...');
  try {
    const res = await page.goto('http://localhost:2785/api', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log(`✅ Backend API Status: ${res.status()}`);
    console.log(`📄 Backend Swagger Title: "${await page.title()}"`);
    await page.screenshot({ path: 'backend-swagger-realtime.png' });
    console.log('📸 Saved backend-swagger-realtime.png');
  } catch (err) {
    console.error('❌ Backend connection error:', err.message);
  }

  await browser.close();
  console.log('\n🏁 Realtime diagnostic finish.');
})();
