import 'dotenv/config';
import type { CheckResult, Provider } from './types.js';

export interface RemoteSubscription {
  id: string;
  provider: Provider;
  event_url: string;
}

const baseUrl = process.env.CLOUDFLARE_WORKER_URL?.replace(/\/$/, '');
const token = process.env.WORKER_API_TOKEN;

function headers() {
  if (!token) throw new Error('WORKER_API_TOKEN is required');
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

export async function activeSubscriptions(): Promise<RemoteSubscription[]> {
  if (!baseUrl) throw new Error('CLOUDFLARE_WORKER_URL is required');
  const response = await fetch(`${baseUrl}/api/subscriptions`, { headers: headers(), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Worker returned HTTP ${response.status} while listing subscriptions`);
  return response.json() as Promise<RemoteSubscription[]>;
}

export async function reportSessions(subscriptionId: string, result: CheckResult) {
  if (!baseUrl) throw new Error('CLOUDFLARE_WORKER_URL is required');
  const response = await fetch(`${baseUrl}/api/subscriptions/${subscriptionId}/sessions`, {
    method: 'POST', headers: headers(), signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ eventName: result.eventName, sessions: result.sessions ?? [] }),
  });
  if (!response.ok) throw new Error(`Worker returned HTTP ${response.status} while reporting sessions`);
  return response.json() as Promise<{ notified: number }>;
}
