import { describe, expect, it } from 'vitest';
import { resultForSessions, sessionsFromRows } from './tixcraft.js';

describe('Tixcraft public session table parser', () => {
  it('tracks each available session independently', () => {
    const sessions = sessionsFromRows([
      { dateTime: '2026/07/12 18:00', name: 'Edy Live Tour', venue: 'Legacy TERA', purchaseState: '立即訂購' },
      { dateTime: '2026/09/26 19:00', name: 'Edy Live Tour', venue: 'Backstage Live', purchaseState: '立即訂購' },
    ]);
    expect(resultForSessions(sessions, 'Edy Live Tour')).toMatchObject({ status: 'available' });
    expect(sessions).toHaveLength(2);
    expect(sessions[0].key).not.toBe(sessions[1].key);
  });

  it('recognizes an entirely sold-out event', () => {
    const sessions = sessionsFromRows([
      { dateTime: '2026/11/19 19:00', name: 'BTS', venue: '高雄國家體育場', purchaseState: '立即訂購 選購一空' },
      { dateTime: '2026/11/21 19:00', name: 'BTS', venue: '高雄國家體育場', purchaseState: '立即訂購 選購一空' },
    ]);
    expect(resultForSessions(sessions, 'BTS')).toMatchObject({ status: 'unavailable' });
  });
});
