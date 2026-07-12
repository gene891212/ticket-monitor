import type { CheckResult, Provider } from '../types.js';

export interface TicketProvider {
  readonly name: Provider;
  supports(url: URL): boolean;
  check(url: string): Promise<CheckResult>;
}
