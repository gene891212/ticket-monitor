import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import type { CheckResult, TicketSession, TicketStatus } from '../types.js';
import type { TicketProvider } from './base.js';
import { TIXCRAFT_RULE } from './rules.js';

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

/** Reads only Tixcraft's public session-selection page using a persistent Playwright browser instance. */
export class TixcraftProvider implements TicketProvider {
  readonly name = 'tixcraft' as const;

  private browser: any = null;
  private context: any = null;
  private mainPage: any = null;
  private readonly cachedUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  supports(url: URL) {
    return TIXCRAFT_RULE.supports(url);
  }

  async check(eventUrl: string): Promise<CheckResult> {
    const purchaseUrl = this.toPurchaseUrl(eventUrl);
    if (!purchaseUrl) return { status: 'unknown', detail: '不是有效的 Tixcraft 活動網址' };

    try {
      await this.ensureBrowserInitialized();
      
      await this.mainPage.goto(purchaseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      
      // Wait 3 seconds for WAF challenge and rendering to settle
      await this.mainPage.waitForTimeout(3000);
      
      const html = await this.mainPage.content();
      if (this.isBlocked(html)) {
        throw new Error('Blocked by WAF');
      }
      
      return this.parseHtml(html);
    } catch (error: any) {
      console.warn('[TixcraftProvider] Browser check failed:', error.message);
      return { status: 'unknown', detail: `查詢失敗: ${error.message}` };
    }
  }

  private async ensureBrowserInitialized(): Promise<void> {
    if (this.browser && this.browser.isConnected() && this.mainPage && !this.mainPage.isClosed()) {
      return;
    }

    console.log('[TixcraftProvider] Initializing persistent Playwright browser...');
    this.browser = await chromium.launch({
      headless: process.env.PLAYWRIGHT_HEADLESS === 'true',
      args: ['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage'],
    });

    this.context = await this.browser.newContext({
      locale: 'zh-TW',
      userAgent: this.cachedUserAgent,
      viewport: { width: 1280, height: 900 }
    });

    // Override webdriver property
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    this.mainPage = await this.context.newPage();

    // Warm up context by visiting the homepage first
    console.log('[TixcraftProvider] Warming up browser context by visiting homepage...');
    try {
      await this.mainPage.goto('https://tixcraft.com', { waitUntil: 'networkidle', timeout: 30_000 });
      await this.mainPage.waitForTimeout(3000);
    } catch (err: any) {
      console.warn('[TixcraftProvider] Context warmup warning:', err.message);
    }
  }

  private isBlocked(html: string): boolean {
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

  private toPurchaseUrl(rawUrl: string): string | undefined {
    try {
      return TIXCRAFT_RULE.normalize(new URL(rawUrl)) ?? undefined;
    } catch {
      return undefined;
    }
  }
}
