import type { Provider } from '../types.js';

export interface ProviderRule {
  readonly name: Provider;
  supports(url: URL): boolean;
  normalize(url: URL): string | null;
}

export const TIXCRAFT_RULE: ProviderRule = {
  name: 'tixcraft',
  supports(url: URL): boolean {
    return url.hostname === 'tixcraft.com' || url.hostname.endsWith('.tixcraft.com');
  },
  normalize(url: URL): string | null {
    const match = url.pathname.match(/^\/activity\/(?:detail|game)\/([^/]+)$/i);
    if (!match) return null;
    const parsed = new URL(url.toString());
    parsed.pathname = `/activity/game/${match[1]}`;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  }
};

export const TICKETPLUS_RULE: ProviderRule = {
  name: 'ticketplus',
  supports(url: URL): boolean {
    return url.hostname === 'ticketplus.com.tw' || url.hostname.endsWith('.ticketplus.com.tw');
  },
  normalize(url: URL): string | null {
    const match = url.pathname.match(/^\/activity\/([^/]+)\/?$/i);
    if (!match) return null;
    const parsed = new URL(url.toString());
    parsed.pathname = `/activity/${match[1]}`;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  }
};

export const PROVIDER_RULES: ProviderRule[] = [
  TIXCRAFT_RULE,
  TICKETPLUS_RULE
];

export function ruleForUrl(rawUrl: string): ProviderRule | undefined {
  try {
    const url = new URL(rawUrl);
    return PROVIDER_RULES.find(rule => rule.supports(url));
  } catch {
    return undefined;
  }
}
