import { chromium } from 'playwright';

async function run() {
  const urls = [
    'https://tixcraft.com/activity/game/26_aespa',
    'https://tixcraft.com/activity/game/26_btskns',
    'https://tixcraft.com/activity/game/26_echo'
  ];

  console.log('Launching persistent browser...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    locale: 'zh-TW',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    for (let i = 0; i < 2; i++) {
      console.log(`\n--- Starting Loop ${i + 1} ---`);
      for (const url of urls) {
        console.log(`Checking: ${url}`);
        const page = await context.newPage();
        try {
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(3000);
          const title = await page.title();
          console.log(`-> Status: ${response?.status()}, Title: "${title}"`);
        } catch (err: any) {
          console.error(`-> Error checking ${url}:`, err.message);
        } finally {
          await page.close();
        }
      }
      console.log('Waiting 5 seconds before next loop...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
