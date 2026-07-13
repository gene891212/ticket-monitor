import { describe, expect, it } from 'vitest';
import { hasStatusChanged } from './monitor.js';
import type { TicketSession } from './types.js';

describe('monitor state change detection', () => {
  it('returns true if there is no previous session cache', () => {
    const next: TicketSession[] = [
      { key: 'session1', dateTime: '2026/07/20', name: 'Show', venue: 'Dome', status: 'available' }
    ];
    expect(hasStatusChanged(undefined, next)).toBe(true);
  });

  it('returns false if session list and status are identical', () => {
    const prev: TicketSession[] = [
      { key: 'session1', dateTime: '2026/07/20', name: 'Show', venue: 'Dome', status: 'available' }
    ];
    const next: TicketSession[] = [
      { key: 'session1', dateTime: '2026/07/20', name: 'Show', venue: 'Dome', status: 'available' }
    ];
    expect(hasStatusChanged(prev, next)).toBe(false);
  });

  it('returns true if a session status changed', () => {
    const prev: TicketSession[] = [
      { key: 'session1', dateTime: '2026/07/20', name: 'Show', venue: 'Dome', status: 'unavailable' }
    ];
    const next: TicketSession[] = [
      { key: 'session1', dateTime: '2026/07/20', name: 'Show', venue: 'Dome', status: 'available' }
    ];
    expect(hasStatusChanged(prev, next)).toBe(true);
  });

  it('returns true if session list length changed', () => {
    const prev: TicketSession[] = [
      { key: 'session1', dateTime: '2026/07/20', name: 'Show', venue: 'Dome', status: 'available' }
    ];
    const next: TicketSession[] = [
      { key: 'session1', dateTime: '2026/07/20', name: 'Show', venue: 'Dome', status: 'available' },
      { key: 'session2', dateTime: '2026/07/21', name: 'Show 2', venue: 'Dome', status: 'unavailable' }
    ];
    expect(hasStatusChanged(prev, next)).toBe(true);
  });

  it('returns true if session keys differ', () => {
    const prev: TicketSession[] = [
      { key: 'session1', dateTime: '2026/07/20', name: 'Show', venue: 'Dome', status: 'available' }
    ];
    const next: TicketSession[] = [
      { key: 'session2', dateTime: '2026/07/20', name: 'Show', venue: 'Dome', status: 'available' }
    ];
    expect(hasStatusChanged(prev, next)).toBe(true);
  });
});
