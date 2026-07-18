import { describe, expect, it, vi, afterEach } from 'vitest';
import { TicketplusProvider } from './ticketplus.js';

describe('TicketplusProvider', () => {
  const provider = new TicketplusProvider();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('supports', () => {
    it('returns true for ticketplus.com.tw and its subdomains', () => {
      expect(provider.supports(new URL('https://ticketplus.com.tw/activity/4b47b5360d42451f65704664c40b1c72'))).toBe(true);
      expect(provider.supports(new URL('https://apis.ticketplus.com.tw/config'))).toBe(true);
      expect(provider.supports(new URL('https://sub.ticketplus.com.tw/something'))).toBe(true);
    });

    it('returns false for other domains', () => {
      expect(provider.supports(new URL('https://tixcraft.com/activity'))).toBe(false);
      expect(provider.supports(new URL('https://google.com'))).toBe(false);
    });
  });

  describe('decrypt', () => {
    it('decrypts known event UUID to sequential event ID', () => {
      // 音田雅則
      expect(provider.decrypt('4b47b5360d42451f65704664c40b1c72')).toBe('e000001412');
      // TREASURE
      expect(provider.decrypt('e5baf60463fccb6391ae4dcb2e314978')).toBe('e000001434');
    });

    it('decrypts known session UUID to sequential session ID', () => {
      expect(provider.decrypt('8bd271d31324af3a6f908f839b062da4')).toBe('s000002092');
    });

    it('gracefully handles invalid hex input', () => {
      expect(provider.decrypt('invalid_hex')).toContain('Failed to decrypt');
    });
  });

  describe('check', () => {
    it('successfully fetches and maps active ticket sessions', async () => {
      const mockEventJson = {
        title: '音田雅則 One Man Tour 2026 “Hiraeth” in Taipei',
        location: 'SUB LIVE'
      };

      const mockSessionsJson = {
        sessions: [
          {
            eventId: '4b47b5360d42451f65704664c40b1c72',
            sessionId: '8bd271d31324af3a6f908f839b062da4',
            name: '音田雅則 One Man Tour 2026',
            location: 'SUB LIVE',
            date: '2026-11-22',
            time: '18:30'
          }
        ]
      };

      const mockStatusJson = {
        errCode: '00',
        result: {
          event: [{ id: 'e000001412', status: 'onsale' }],
          session: [{ id: 's000002092', status: 'onsale', count: 999999 }]
        }
      };

      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url: any) => {
        let responseJson: any = null;
        if (url.includes('event.json')) {
          responseJson = mockEventJson;
        } else if (url.includes('sessions.json')) {
          responseJson = mockSessionsJson;
        } else if (url.includes('/config/api/v1/get?')) {
          responseJson = mockStatusJson;
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(responseJson)
        } as Response);
      });

      const result = await provider.check('https://ticketplus.com.tw/activity/4b47b5360d42451f65704664c40b1c72');

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(result).toMatchObject({
        status: 'available',
        eventName: '音田雅則 One Man Tour 2026 “Hiraeth” in Taipei',
        detail: '公開購票頁有 1 個可訂購場次'
      });
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions?.[0]).toMatchObject({
        key: '2026-11-22|18:30|SUB LIVE',
        dateTime: '2026-11-22 18:30',
        name: '音田雅則 One Man Tour 2026',
        venue: 'SUB LIVE',
        status: 'available'
      });
    });

    it('returns unavailable if all sessions are pending or soldout', async () => {
      const mockSessionsJson = {
        sessions: [
          {
            eventId: '4b47b5360d42451f65704664c40b1c72',
            sessionId: '8bd271d31324af3a6f908f839b062da4',
            date: '2026-11-22',
            time: '18:30'
          }
        ]
      };

      const mockStatusJson = {
        errCode: '00',
        result: {
          session: [{ id: 's000002092', status: 'pending' }]
        }
      };

      vi.spyOn(global, 'fetch').mockImplementation((url: any) => {
        let responseJson: any = null;
        if (url.includes('event.json')) {
          responseJson = null;
        } else if (url.includes('sessions.json')) {
          responseJson = mockSessionsJson;
        } else if (url.includes('/config/api/v1/get?')) {
          responseJson = mockStatusJson;
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(responseJson)
        } as Response);
      });

      const result = await provider.check('https://ticketplus.com.tw/activity/4b47b5360d42451f65704664c40b1c72');
      expect(result).toMatchObject({
        status: 'unavailable',
        detail: '所有公開場次皆暫停銷售、尚未開賣或已截止/售完'
      });
    });

    it('supports trailing slashes in URLs', async () => {
      const mockSessionsJson = {
        sessions: [
          {
            eventId: '4b47b5360d42451f65704664c40b1c72',
            sessionId: '8bd271d31324af3a6f908f839b062da4',
            date: '2026-11-22',
            time: '18:30'
          }
        ]
      };

      const mockStatusJson = {
        errCode: '00',
        result: {
          session: [{ id: 's000002092', status: 'pending' }]
        }
      };

      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url: any) => {
        let responseJson: any = null;
        if (url.includes('event.json')) {
          responseJson = null;
        } else if (url.includes('sessions.json')) {
          responseJson = mockSessionsJson;
        } else if (url.includes('/config/api/v1/get?')) {
          responseJson = mockStatusJson;
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(responseJson)
        } as Response);
      });

      // Test with trailing slash
      const result = await provider.check('https://ticketplus.com.tw/activity/4b47b5360d42451f65704664c40b1c72/');
      expect(result.status).toBe('unavailable');

      expect(fetchSpy).toHaveBeenCalled();
    });
  });
});
