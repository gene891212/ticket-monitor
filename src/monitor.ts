import { providerFor } from './providers/registry.js';
import { activeSubscriptions, claimManualChecks, failManualCheck, reportSessions } from './worker-client.js';
import type { TicketSession } from './types.js';

let running = false;

// Cache map of: subscriptionId -> previous session list
const sessionCache = new Map<string, TicketSession[]>();

export function hasStatusChanged(prev: TicketSession[] | undefined, next: TicketSession[]): boolean {
  if (!prev) return true;
  if (prev.length !== next.length) return true;
  const prevMap = new Map(prev.map((s) => [s.key, s]));
  for (const session of next) {
    const prevSession = prevMap.get(session.key);
    if (!prevSession) return true;
    if (prevSession.status !== session.status) return true;
    if (prevSession.statusName !== session.statusName) return true;
  }
  return false;
}

export async function poll() {
  if (running) return;
  running = true;
  try {
    const subscriptions = await activeSubscriptions();

    // Clean up cache for subscriptions that are no longer active
    const activeIds = new Set(subscriptions.map((s) => s.id));
    for (const cachedId of sessionCache.keys()) {
      if (!activeIds.has(cachedId)) {
        sessionCache.delete(cachedId);
      }
    }

    for (const subscription of subscriptions) {
      const provider = providerFor(subscription.event_url);
      if (!provider) continue;
      try {
        const result = await provider.check(subscription.event_url);
        const nextSessions = result.sessions ?? [];
        const prevSessions = sessionCache.get(subscription.id);

        if (hasStatusChanged(prevSessions, nextSessions)) {
          const { notified } = await reportSessions(subscription.id, result);
          console.log('checked subscription (status changed)', subscription.id, result.status, { notified });
        } else {
          console.log('checked subscription (no change, skipped reporting)', subscription.id, result.status);
        }

        // Always update cache to the latest state
        sessionCache.set(subscription.id, nextSessions);
      } catch (error) {
        console.error('monitor check failed', subscription.id, error);
      }
    }
  } catch (error) {
    console.error('monitor poll tick failed', error);
  } finally {
    running = false;
  }
}

export async function pollManual() {
  for (const request of await claimManualChecks()) {
    try {
      const provider = providerFor(request.eventUrl);
      if (!provider) throw new Error('Unsupported provider');
      const result = await provider.check(request.eventUrl);
      await reportSessions(request.subscriptionId, result, request.id);
      
      // Update cache with the latest results from the manual check to keep it in sync
      if (result.sessions) {
        sessionCache.set(request.subscriptionId, result.sessions);
      }
    } catch (error) {
      console.error('manual check failed', request.id, error);
      await failManualCheck(request.id);
    }
  }
}
