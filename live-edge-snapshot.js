const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('2886') || p.url().includes('localhost')) || ctx.pages()[0];
  console.log(`Current page URL: ${page.url()}`);
  await page.screenshot({ path: 'edge-current-view.png' });
  console.log('Saved edge-current-view.png');
})();
