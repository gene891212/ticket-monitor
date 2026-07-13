import { describe, expect, it } from 'vitest';
import { TixcraftProvider } from './tixcraft.js';
import { chromium } from 'playwright';

async function getFirstActiveEventUrl(): Promise<string> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
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
    await page.goto('https://tixcraft.com', { waitUntil: 'networkidle', timeout: 30000 });
    const hrefs = await page.locator('a').evaluateAll((links) =>
      links
        .map((link) => (link as HTMLAnchorElement).href)
        .filter((href) => href.includes('/activity/detail/') || href.includes('/activity/game/'))
    );
    const uniqueHrefs = Array.from(new Set(hrefs));
    if (uniqueHrefs.length > 0) {
      return uniqueHrefs[0];
    }
    throw new Error('No active events found on Tixcraft homepage');
  } finally {
    await browser.close();
  }
}

describe('TixcraftProvider Integration Test', () => {
  it('successfully fetches and parses active event ticket table using cookie caching', async () => {
    const provider = new TixcraftProvider();
    
    // 1. Get an active event URL dynamically from the homepage
    console.log('Retrieving an active event URL for testing...');
    const eventUrl = await getFirstActiveEventUrl();
    console.log(`Testing with URL: ${eventUrl}`);

    // 2. Perform the first check (should launch Playwright to fetch cookies, then request using fetch)
    console.log('\n--- Running CHECK #1 (Cookie Acquisition + Fetch) ---');
    const start1 = Date.now();
    const result1 = await provider.check(eventUrl);
    const duration1 = Date.now() - start1;
    console.log(`Check #1 took ${duration1}ms`);
    console.log('Check #1 Result Status:', result1.status);
    console.log('Check #1 Event Name:', result1.eventName);
    const sessions1 = result1.sessions ?? [];
    console.log('Check #1 Sessions Count:', sessions1.length);

    expect(result1.status).not.toBe('unknown'); // If WAF blocked us, status would be unknown due to fallback or WAF errors
    expect(result1.eventName).toBeDefined();
    expect(sessions1.length).toBeGreaterThan(0);

    // 3. Perform the second check (should use cached cookies directly, bypass browser launch)
    console.log('\n--- Running CHECK #2 (Cached Cookie Fetch) ---');
    const start2 = Date.now();
    const result2 = await provider.check(eventUrl);
    const duration2 = Date.now() - start2;
    console.log(`Check #2 took ${duration2}ms`);
    console.log('Check #2 Result Status:', result2.status);
    console.log('Check #2 Event Name:', result2.eventName);
    const sessions2 = result2.sessions ?? [];
    console.log('Check #2 Sessions Count:', sessions2.length);

    expect(result2.status).toBe(result1.status);
    expect(result2.eventName).toBe(result1.eventName);
    expect(sessions2.length).toBe(sessions1.length);

    // Check #2 must be significantly faster than Check #1 because it doesn't spin up Playwright
    console.log(`Performance comparison: Check #1 (${duration1}ms) vs Check #2 (${duration2}ms)`);
    expect(duration2).toBeLessThan(duration1);
  }, 90000); // Set a generous 90 seconds timeout for browser navigation and network fetches
});
