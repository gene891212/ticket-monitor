import { providerFor } from './providers/registry.js';
import { activeSubscriptions, reportSessions } from './worker-client.js';

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
