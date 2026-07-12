import { providerFor } from './providers/registry.js';
import { activeSubscriptions, claimManualChecks, failManualCheck, reportSessions } from './worker-client.js';

let running = false;

export async function poll() {
  if (running) return;
  running = true;
  try {
    const subscriptions = await activeSubscriptions();
    for (const subscription of subscriptions) {
      const provider = providerFor(subscription.event_url);
      if (!provider) continue;
      try {
        const result = await provider.check(subscription.event_url);
        const { notified } = await reportSessions(subscription.id, result);
        console.log('checked subscription', subscription.id, result.status, { notified });
      } catch (error) {
        console.error('monitor check failed', subscription.id, error);
      }
    }
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
    } catch (error) {
      console.error('manual check failed', request.id, error);
      await failManualCheck(request.id);
    }
  }
}
