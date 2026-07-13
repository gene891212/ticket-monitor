import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import type { CheckResult, TicketSession, TicketStatus } from '../types.js';
import type { TicketProvider } from './base.js';

type SessionRow = { dateTime: string; name: string; venue: string; purchaseState: string };

function sessionStatus(purchaseState: string): TicketStatus {
  if (/選購一空/.test(purchaseState)) return 'unavailable';
  if (/立即訂購/.test(purchaseState)) return 'available';
  return 'unknown';
}

function sessionKey(row: SessionRow) {
  return [row.dateTime, row.name, row.venue].map((value) => value.replace(/\s+/g, ' ').trim()).join('|');
}

export function sessionsFromRows(rows: SessionRow[]): TicketSession[] {
  return rows.map((row) => ({
    key: sessionKey(row),
    dateTime: row.dateTime,
    name: row.name,
    venue: row.venue,
    status: sessionStatus(row.purchaseState),
  }));
}

export function resultForSessions(sessions: TicketSession[], eventName?: string): CheckResult {
  const available = sessions.filter((session) => session.status === 'available');
  const unavailable = sessions.filter((session) => session.status === 'unavailable');
  const status: TicketStatus = available.length ? 'available' : unavailable.length === sessions.length && sessions.length ? 'unavailable' : 'unknown';
  const detail = status === 'available'
    ? `公開購票頁有 ${available.length} 個可訂購場次`
    : status === 'unavailable'
      ? '所有公開場次皆顯示「選購一空」'
      : '公開場次尚未開賣或無法判定票況';
  return { status, eventName, detail, sessions };
}

/** Reads only Tixcraft's public session-selection page; it never logs in or enters checkout. */
export class TixcraftProvider implements TicketProvider {
  readonly name = 'tixcraft' as const;

  private cachedCookies = '';
  private cachedUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  private lastFetchedTime = 0;
  private readonly cookieLifetimeMs = 50 * 60 * 1000; // Refresh cookies every 50 minutes

  supports(url: URL) {
    return url.hostname === 'tixcraft.com' || url.hostname.endsWith('.tixcraft.com');
  }

  async check(eventUrl: string): Promise<CheckResult> {
    const purchaseUrl = this.toPurchaseUrl(eventUrl);
    if (!purchaseUrl) return { status: 'unknown', detail: '不是有效的 Tixcraft 活動網址' };

    const now = Date.now();
    // 1. Proactive cookie refresh: if empty or expired (> 50 mins)
    if (!this.cachedCookies || (now - this.lastFetchedTime) > this.cookieLifetimeMs) {
      try {
        await this.refreshCookies();
      } catch (err) {
        console.warn('[TixcraftProvider] Failed to proactively refresh cookies, will try with whatever cache is left', err);
      }
    }

    // 2. Try raw fetch check
    try {
      let html = await this.fetchWithCookies(purchaseUrl);

      // 3. Reactive block detection: if blocked, refresh cookies and retry once
      if (this.isBlocked(html)) {
        console.warn('[TixcraftProvider] Cached cookies expired or blocked. Refreshing cookies and retrying...');
        await this.refreshCookies();
        html = await this.fetchWithCookies(purchaseUrl);

        if (this.isBlocked(html)) {
          throw new Error('Blocked by WAF even after refreshing cookies');
        }
      }

      console.log(`[TixcraftProvider] Successfully fetched and parsed page via fetch: ${purchaseUrl}`);
      return this.parseHtml(html);
    } catch (error: any) {
      console.warn('[TixcraftProvider] Fetch check failed. Falling back to direct Playwright browser check.', error.message);
      // 4. Fallback: Full Playwright check
      return this.directPlaywrightCheck(purchaseUrl);
    }
  }

  private async refreshCookies(): Promise<void> {
    console.log('[TixcraftProvider] Launching Playwright to refresh cookies...');
    const homepageUrl = 'https://tixcraft.com';
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage'],
    });

    try {
      const context = await browser.newContext({
        locale: 'zh-TW',
        userAgent: this.cachedUserAgent,
      });

      // Override webdriver property
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const page = await context.newPage();
      await page.goto(homepageUrl, { waitUntil: 'networkidle', timeout: 30_000 });

      const cookies = await context.cookies();
      this.cachedCookies = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      this.lastFetchedTime = Date.now();
      console.log(`[TixcraftProvider] Successfully refreshed cookies. Count: ${cookies.length}`);
    } finally {
      await browser.close();
    }
  }

  private async fetchWithCookies(url: string): Promise<string> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': this.cachedUserAgent,
        'Cookie': this.cachedCookies,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
      },
    });

    if (response.status === 401 || response.status === 403) {
      return '__BLOCKED__';
    }

    return response.text();
  }

  private isBlocked(html: string): boolean {
    if (html === '__BLOCKED__') return true;
    return html.includes('Attention Required') ||
           html.includes('Cloudflare') ||
           html.includes('Just a moment') ||
           html.includes("Let's Get Your Identity Verified");
  }

  private parseHtml(html: string): CheckResult {
    const $ = cheerio.load(html);
    const eventName = $('h1').first().text().trim() || undefined;
    const rows = $('table tr');
    const sessionRows: SessionRow[] = [];

    rows.each((index, element) => {
      // Skip table header
      if (index === 0) return;
      const cells = $(element).find('td').map((_, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get();
      if (cells.length >= 4) {
        sessionRows.push({
          dateTime: cells[0],
          name: cells[1],
          venue: cells[2],
          purchaseState: cells[3],
        });
      }
    });

    return resultForSessions(sessionsFromRows(sessionRows), eventName);
  }

  private async directPlaywrightCheck(purchaseUrl: string): Promise<CheckResult> {
    console.log('[TixcraftProvider] Executing direct Playwright fallback check...');
    const browser = await chromium.launch({
      headless: process.env.PLAYWRIGHT_HEADLESS === 'true',
      args: ['--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage({ locale: 'zh-TW', viewport: { width: 1280, height: 900 } });
      await page.goto(purchaseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForSelector('table tr', { timeout: 15_000 });
      const eventName = (await page.locator('h1').first().textContent())?.trim() || undefined;
      const rows = page.locator('table tr');
      const sessionRows: SessionRow[] = [];
      for (let index = 1; index < await rows.count(); index += 1) {
        const cells = (await rows.nth(index).locator('td').allTextContents()).map((cell) => cell.replace(/\s+/g, ' ').trim());
        if (cells.length >= 4) sessionRows.push({ dateTime: cells[0], name: cells[1], venue: cells[2], purchaseState: cells[3] });
      }
      return resultForSessions(sessionsFromRows(sessionRows), eventName);
    } finally {
      await browser.close();
    }
  }

  private toPurchaseUrl(rawUrl: string): string | undefined {
    const url = new URL(rawUrl);
    const match = url.pathname.match(/^\/activity\/(?:detail|game)\/([^/]+)$/);
    if (!match) return undefined;
    url.pathname = `/activity/game/${match[1]}`;
    url.search = '';
    url.hash = '';
    return url.toString();
  }
}
