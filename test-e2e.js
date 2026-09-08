const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Launching Chromium browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[Browser Uncaught Error]:', err.message));

  console.log('🌐 Navigating to Dashboard (http://localhost:5173)...');
  try {
    const response = await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 10000 });
    console.log(`✅ Status: ${response.status()}`);
    console.log(`📄 Page Title: "${await page.title()}"`);
    
    await page.screenshot({ path: 'dashboard-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved to dashboard-screenshot.png');
  } catch (err) {
    console.error('❌ Dashboard request error:', err.message);
  }

  console.log('\n🌐 Navigating to Backend API (http://localhost:3000/api)...');
  try {
    const response = await page.goto('http://localhost:3000/api', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log(`✅ API Swagger Status: ${response.status()}`);
  } catch (err) {
    console.error('❌ API request error:', err.message);
  }

  await browser.close();
  console.log('🏁 Diagnostic completed.');
})();
