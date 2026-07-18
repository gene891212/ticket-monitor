import { chromium } from 'playwright';

async function run() {
  const targetUrl = 'https://tixcraft.com/activity/game/26_btskns';
  console.log(`Launching browser to visit: ${targetUrl}`);
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const context = await browser.newContext({
      locale: 'zh-TW',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();
    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    console.log('Response Status:', response?.status());
    console.log('Redirected to:', page.url());
    
    await page.waitForTimeout(5000);
    
    console.log('Page Title:', await page.title());
    
    const cookies = await context.cookies();
    console.log('Cookies retrieved:', cookies.map(c => c.name));
    
    const bodyText = await page.locator('body').innerText();
    console.log('Body text snippet:', bodyText.trim().slice(0, 300));
  } catch (err: any) {
    console.error('Error occurred:', err.message);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
