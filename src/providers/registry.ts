import type { TicketProvider } from './base.js';
import { TixcraftProvider } from './tixcraft.js';
import { TicketplusProvider } from './ticketplus.js';

const providers: TicketProvider[] = [
  new TixcraftProvider(),
  new TicketplusProvider()
];
export function providerFor(rawUrl: string): TicketProvider | undefined {
  try { const url = new URL(rawUrl); return providers.find((provider) => provider.supports(url)); }
  catch { return undefined; }
}
