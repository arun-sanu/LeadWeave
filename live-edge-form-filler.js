const { chromium } = require('playwright');

(async () => {
  console.log('🔌 Connecting to open Edge browser...');
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const ctx = browser.contexts()[0];
    let page = ctx.pages().find(p => p.url().includes('localhost') || p.url().includes('2886'));
    if (!page) {
      page = ctx.pages()[0] || await ctx.newPage();
      await page.goto('http://localhost:2886');
    }

    console.log('📝 Filling company "ModBit Labs" to test login flow...');
    await page.fill('input', 'ModBit Labs');
    await page.click('button:has-text("Next")');

    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'edge-modbit-click.png' });
    console.log('📸 Screenshot saved: edge-modbit-click.png');
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
