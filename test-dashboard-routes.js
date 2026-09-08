const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log(`[Dashboard Console ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[Dashboard Error]:', err.message));

  console.log('🔍 Testing Dashboard root element & navigation...');
  await page.goto('http://localhost:2886', { waitUntil: 'networkidle' });

  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML);
  console.log('Rendered Root inner HTML snippet:', rootHtml ? rootHtml.substring(0, 300) : 'EMPTY');

  await page.screenshot({ path: 'dashboard-full-page.png', fullPage: true });
  console.log('📸 Captured dashboard-full-page.png');

  await browser.close();
})();
