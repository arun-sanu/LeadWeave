const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('📡 [LIVE WATCHER] Connecting to Edge on http://localhost:9222...');
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('⚡ Connected to Edge remote debugging context!');

    const defaultContext = browser.contexts()[0];
    let page = defaultContext.pages().find(p => p.url().includes('localhost') || p.url().includes('2886'));

    if (!page) {
      page = defaultContext.pages()[0] || await defaultContext.newPage();
      await page.goto('http://localhost:2886');
    }

    console.log(`🔗 Watching Tab: ${page.url()} | Title: "${await page.title()}"`);

    // Stream logs in real-time
    page.on('console', msg => {
      console.log(`[Browser Console ${msg.type().toUpperCase()}]: ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.error(`💥 [UNCAUGHT REACT ERROR]: ${err.message}`);
    });

    page.on('requestfailed', req => {
      console.log(`❌ [NETWORK FAIL]: ${req.url()} (${req.failure()?.errorText})`);
    });

    console.log('\n📸 Taking live snapshot of your Edge browser tab...');
    await page.screenshot({ path: 'live-edge-tab.png' });
    console.log('✅ Saved live snapshot: live-edge-tab.png');

    console.log('\n🟢 REALTIME AUDIT AGENT IS ACTIVE AND WATCHING YOUR EDGE BROWSER.');
  } catch (err) {
    console.error('❌ Connection error:', err.message);
  }
})();
