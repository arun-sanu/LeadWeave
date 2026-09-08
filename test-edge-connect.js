const { chromium } = require('playwright');

(async () => {
  console.log('🔌 Attempting to connect to running Microsoft Edge instance via CDP on port 9222...');
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✅ Successfully connected to Microsoft Edge!');
    
    const contexts = browser.contexts();
    console.log(`Found ${contexts.length} browser contexts.`);
    
    for (const ctx of contexts) {
      const pages = ctx.pages();
      console.log(`Context has ${pages.length} open tab(s):`);
      for (const page of pages) {
        console.log(`  - Page URL: ${page.url()} | Title: "${await page.title()}"`);
      }
    }

    if (contexts.length > 0 && contexts[0].pages().length > 0) {
      const activePage = contexts[0].pages()[0];
      await activePage.screenshot({ path: 'edge-active-tab.png' });
      console.log('📸 Captured screenshot of active Edge tab: edge-active-tab.png');
    }
  } catch (err) {
    console.log('⚠️ Could not connect via CDP port 9222:', err.message);
    console.log('💡 Note: To allow Antigravity to attach to your open Edge browser in real-time, Edge should be started with debugging enabled: msedge --remote-debugging-port=9222');
  }
})();
