import { chromium } from 'playwright';
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

  supports(url: URL) {
    return url.hostname === 'tixcraft.com' || url.hostname.endsWith('.tixcraft.com');
  }

  async check(eventUrl: string): Promise<CheckResult> {
    const purchaseUrl = this.toPurchaseUrl(eventUrl);
    if (!purchaseUrl) return { status: 'unknown', detail: '不是有效的 Tixcraft 活動網址' };
    try {
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
    } catch (error) {
      console.warn('Tixcraft public session page could not be read', error);
      return { status: 'unknown', detail: '公開購票頁未提供可讀取的場次資料' };
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
