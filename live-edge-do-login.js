const { chromium } = require('playwright');

(async () => {
  console.log('🔌 Connecting to active Edge window on port 9222...');
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const ctx = browser.contexts()[0];
    const page = ctx.pages().find(p => p.url().includes('2886') || p.url().includes('localhost')) || ctx.pages()[0];

    page.on('console', msg => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
    page.on('response', res => {
      if (res.status() >= 400) {
        console.log(`⚠️ HTTP ${res.status()} ${res.url()}`);
      }
    });

    console.log(`📌 Page URL: ${page.url()}`);

    // If on Step 2 or login form, fill Arun and Nightshade
    console.log('✍️ Filling Full Name: "Arun" and Password: "Nightshade"...');
    
    // Fill full name input
    const inputs = await page.$$('input');
    if (inputs.length >= 2) {
      await inputs[0].fill('Arun');
      await inputs[1].fill('Nightshade');
    } else if (inputs.length === 1) {
      await inputs[0].fill('ModBit Labs');
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(1000);
      const inputsStep2 = await page.$$('input');
      if (inputsStep2.length >= 2) {
        await inputsStep2[0].fill('Arun');
        await inputsStep2[1].fill('Nightshade');
      }
    }

    console.log('🚀 Clicking Sign in button...');
    const signInBtn = await page.$('button:has-text("Sign in"), button:has-text("Next")');
    if (signInBtn) {
      await signInBtn.click();
    }

    await page.waitForTimeout(3000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('\n📄 Screen Text after Sign In:');
    console.log(bodyText.substring(0, 400));

    await page.screenshot({ path: 'edge-after-login-attempt.png' });
    console.log('📸 Captured screenshot: edge-after-login-attempt.png');
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
