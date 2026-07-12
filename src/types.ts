export type Provider = 'tixcraft' | 'ticketplus' | 'kham';
export type TicketStatus = 'available' | 'unavailable' | 'unknown';

export interface TicketSession {
  key: string;
  dateTime: string;
  name: string;
  venue: string;
  status: TicketStatus;
}

export interface CheckResult {
  status: TicketStatus;
  eventName?: string;
  detail?: string;
  sessions?: TicketSession[];
}

export interface Subscription {
  id: string;
  line_user_id: string;
  provider: Provider;
  event_url: string;
  event_name: string | null;
  enabled: boolean;
  last_status: TicketStatus;
  last_notified_status: TicketStatus | null;
}
