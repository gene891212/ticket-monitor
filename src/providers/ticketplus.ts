import crypto from 'crypto';
import type { CheckResult, TicketSession, TicketStatus } from '../types.js';
import type { TicketProvider } from './base.js';

export class TicketplusProvider implements TicketProvider {
  readonly name = 'ticketplus' as const;

  private readonly aesKey = 'ILOVEFETIXFETIX!';
  private readonly aesIv = '!@#$FETIXEVENTiv';
  private readonly cachedUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  supports(url: URL): boolean {
    return url.hostname === 'ticketplus.com.tw' || url.hostname.endsWith('.ticketplus.com.tw');
  }

  /**
   * Decrypts the hex-encoded UUID into the internal sequential ID using AES-128-CBC.
   */
  decrypt(hex: string): string {
    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(this.aesKey), Buffer.from(this.aesIv));
      let decrypted = decipher.update(hex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err: any) {
      console.warn(`[TicketplusProvider] Decryption failed for hex "${hex}":`, err.message);
      return `Failed to decrypt: ${err.message}`;
    }
  }

  async check(eventUrl: string): Promise<CheckResult> {
    try {
      const url = new URL(eventUrl);
      const match = url.pathname.match(/^\/activity\/([^/]+)\/?$/);
      if (!match) {
        return { status: 'unknown', detail: '不是有效的 TicketPlus 活動網址' };
      }
      
      const eventUuid = match[1];
      const internalEventId = this.decrypt(eventUuid);
      if (internalEventId.startsWith('Failed')) {
        return { status: 'unknown', detail: '解密活動識別碼失敗' };
      }

      const headers = {
        'user-agent': this.cachedUserAgent,
        'origin': 'https://ticketplus.com.tw',
        'referer': eventUrl
      };

      // Fetch event information and sessions in parallel
      const [eventRes, sessionsRes] = await Promise.all([
        fetch(`https://apis.ticketplus.com.tw/config/api/v1/getS3?path=event/${eventUuid}/event.json`, { headers })
          .then(r => r.ok ? r.json() as Promise<any> : null)
          .catch(() => null),
        fetch(`https://apis.ticketplus.com.tw/config/api/v1/getS3?path=event/${eventUuid}/sessions.json`, { headers })
          .then(r => r.ok ? r.json() as Promise<any> : null)
          .catch(() => null)
      ]);

      if (!sessionsRes || !sessionsRes.sessions || sessionsRes.sessions.length === 0) {
        return { status: 'unknown', detail: '無法取得場次資料' };
      }

      const eventName = eventRes?.title || sessionsRes.sessions[0]?.name || undefined;

      // Extract and decrypt internal session IDs
      const sessionMappings = sessionsRes.sessions.map((s: any) => {
        const decryptedSessionId = this.decrypt(s.sessionId);
        return {
          original: s,
          decryptedId: decryptedSessionId
        };
      });

      const validSessionIds = sessionMappings
        .map((m: any) => m.decryptedId)
        .filter((id: string) => !id.startsWith('Failed'));

      if (validSessionIds.length === 0) {
        return { status: 'unknown', eventName, detail: '無法解析有效的場次識別碼' };
      }

      // Fetch status for all sessions in one request
      const statusUrl = `https://apis.ticketplus.com.tw/config/api/v1/get?eventId=${internalEventId}&sessionId=${validSessionIds.join(',')}`;
      const statusRes = await fetch(statusUrl, { headers })
        .then(r => r.ok ? r.json() as Promise<any> : null)
        .catch(() => null);

      if (!statusRes || !statusRes.result || !statusRes.result.session) {
        return { status: 'unknown', eventName, detail: '無法取得票況狀態' };
      }

      const statusMap = new Map<string, string>(
        statusRes.result.session.map((s: any) => [s.id, s.status])
      );

      const sessions: TicketSession[] = sessionMappings.map((m: any) => {
        const s = m.original;
        const decryptedId = m.decryptedId;
        const statusVal = statusMap.get(decryptedId) || 'unknown';

        let ticketStatus: TicketStatus = 'unknown';
        if (statusVal === 'onsale') {
          ticketStatus = 'available';
        } else if (['pending', 'soldout', 'over', 'end'].includes(statusVal)) {
          ticketStatus = 'unavailable';
        }

        const clean = (val: string) => val ? val.replace(/\s+/g, ' ').trim() : '';
        const key = [s.date, s.time, s.location].map(clean).join('|');

        return {
          key,
          dateTime: `${clean(s.date)} ${clean(s.time)}`.trim(),
          name: s.name || eventName || '未命名場次',
          venue: s.location || '未知地點',
          status: ticketStatus
        };
      });

      const availableCount = sessions.filter(s => s.status === 'available').length;
      const unavailableCount = sessions.filter(s => s.status === 'unavailable').length;

      let overallStatus: TicketStatus = 'unknown';
      let detail = '無法判定售票狀態';

      if (availableCount > 0) {
        overallStatus = 'available';
        detail = `公開購票頁有 ${availableCount} 個可訂購場次`;
      } else if (unavailableCount === sessions.length && sessions.length > 0) {
        overallStatus = 'unavailable';
        detail = '所有公開場次皆暫停銷售、尚未開賣或已截止/售完';
      }

      return {
        status: overallStatus,
        eventName,
        detail,
        sessions
      };
    } catch (err: any) {
      console.warn('[TicketplusProvider] Check failed:', err.message);
      return { status: 'unknown', detail: `查詢失敗: ${err.message}` };
    }
  }
}
