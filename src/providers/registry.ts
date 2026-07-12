import type { TicketProvider } from './base.js';
import { TixcraftProvider } from './tixcraft.js';

const providers: TicketProvider[] = [new TixcraftProvider()];
export function providerFor(rawUrl: string): TicketProvider | undefined {
  try { const url = new URL(rawUrl); return providers.find((provider) => provider.supports(url)); }
  catch { return undefined; }
}
