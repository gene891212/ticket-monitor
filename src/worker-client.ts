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

async function checkResponse(response: Response, context: string) {
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Worker returned HTTP ${response.status} while ${context}. Details: ${body}`);
  }
}

export async function activeSubscriptions(): Promise<RemoteSubscription[]> {
  if (!baseUrl) throw new Error('CLOUDFLARE_WORKER_URL is required');
  const response = await fetch(`${baseUrl}/api/subscriptions`, { headers: headers(), signal: AbortSignal.timeout(15_000) });
  await checkResponse(response, 'listing subscriptions');
  return response.json() as Promise<RemoteSubscription[]>;
}

export async function reportSessions(subscriptionId: string, result: CheckResult, manualRequestId?: string) {
  if (!baseUrl) throw new Error('CLOUDFLARE_WORKER_URL is required');
  const response = await fetch(`${baseUrl}/api/subscriptions/${subscriptionId}/sessions`, {
    method: 'POST', headers: headers(), signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ eventName: result.eventName, sessions: result.sessions ?? [], manualRequestId }),
  });
  await checkResponse(response, 'reporting sessions');
  return response.json() as Promise<{ notified: number }>;
}

export async function failManualCheck(id: string) {
  if (!baseUrl) throw new Error('CLOUDFLARE_WORKER_URL is required');
  const response = await fetch(`${baseUrl}/api/manual-checks/${id}/fail`, { method: 'POST', headers: headers(), signal: AbortSignal.timeout(15_000) });
  await checkResponse(response, 'failing manual check');
}

export interface ManualCheck { id: string; subscriptionId: string; provider: Provider; eventUrl: string; }
export async function claimManualChecks(): Promise<ManualCheck[]> {
  if (!baseUrl) throw new Error('CLOUDFLARE_WORKER_URL is required');
  const response = await fetch(`${baseUrl}/api/manual-checks/claim`, { method: 'POST', headers: headers(), signal: AbortSignal.timeout(15_000) });
  await checkResponse(response, 'claiming manual checks');
  return response.json() as Promise<ManualCheck[]>;
}
