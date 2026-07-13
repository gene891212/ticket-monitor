import { chromium } from 'playwright';

async function run() {
  const homepageUrl = 'https://tixcraft.com';
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  console.log('Launching Playwright to get cookies metadata...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
    const context = await browser.newContext({
      locale: 'zh-TW',
      userAgent: userAgent,
    });
    
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();
    await page.goto(homepageUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const cookies = await context.cookies();
    console.log('\n=================== Cookie Expiration Details ===================');
    cookies.forEach(c => {
      let expiryString = 'Session (Expires when browser closes)';
      if (c.expires && c.expires !== -1) {
        const date = new Date(c.expires * 1000);
        expiryString = date.toISOString() + ` (${Math.round((c.expires * 1000 - Date.now()) / 1000 / 60)} minutes from now)`;
      }
      console.log(`Cookie Name: ${c.name}`);
      console.log(`  - Domain:   ${c.domain}`);
      console.log(`  - Value:    ${c.value.slice(0, 30)}...`);
      console.log(`  - Expiry:   ${expiryString}`);
      console.log(`  - HttpOnly: ${c.httpOnly}`);
      console.log(`  - Secure:   ${c.secure}`);
      console.log(`  - SameSite: ${c.sameSite}`);
      console.log('-----------------------------------------------------------------');
    });
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
