const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log(`[Dashboard Console ${msg.type()}]:`, msg.text()));
  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`⚠️ HTTP ${res.status()} ${res.url()}`);
    }
  });

  console.log('🌐 Loading Dashboard...');
  await page.goto('http://localhost:2886', { waitUntil: 'networkidle' });

  console.log('📝 Submitting Company Name: "default"...');
  await page.fill('input', 'default');
  await page.click('button:has-text("Next")');

  await page.waitForTimeout(1500);

  const headingText = await page.evaluate(() => document.body.innerText);
  console.log('\n📄 Page Text Snippet after clicking Next:');
  console.log(headingText.substring(0, 400));

  await page.screenshot({ path: 'diag-login-step-2.png' });
  console.log('\n📸 Captured screenshot: diag-login-step-2.png');

  await browser.close();
})();
