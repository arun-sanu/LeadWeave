const { chromium } = require('playwright');

(async () => {
  console.log('🔌 Connecting to active Edge browser session on port 9222...');
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const ctx = browser.contexts()[0];
    let page = ctx.pages().find(p => p.url().includes('2886') || p.url().includes('localhost'));
    if (!page) {
      page = ctx.pages()[0] || await ctx.newPage();
      await page.goto('http://localhost:2886');
    }

    console.log(`📌 Active Edge Page: ${page.url()}`);
    
    // Fill company
    await page.fill('input', 'ModBit Labs');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    const step2Text = await page.evaluate(() => document.body.innerText);
    console.log('\n📄 Step 2 Screen Text Snippet:');
    console.log(step2Text.substring(0, 300));

    await page.screenshot({ path: 'edge-step-2-view.png' });
    console.log('📸 Saved edge-step-2-view.png');
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
