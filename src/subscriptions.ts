import { pool } from './db/pool.js';
import type { Provider, Subscription, TicketSession, TicketStatus } from './types.js';

interface StoredSession extends TicketSession { last_notified_status: TicketStatus | null; }

export async function add(userId: string, provider: Provider, url: string, name?: string) {
  const { rows } = await pool.query<Subscription>(`INSERT INTO subscriptions (line_user_id, provider, event_url, event_name)
    VALUES ($1, $2, $3, $4) ON CONFLICT (line_user_id, event_url) DO UPDATE SET enabled = TRUE, updated_at = now()
    RETURNING *`, [userId, provider, url, name ?? null]);
  return rows[0];
}
export async function list(userId: string) {
  return (await pool.query<Subscription>('SELECT * FROM subscriptions WHERE line_user_id = $1 ORDER BY created_at DESC', [userId])).rows;
}
export async function remove(userId: string, id: string) {
  return (await pool.query('UPDATE subscriptions SET enabled = FALSE, updated_at = now() WHERE id = $1 AND line_user_id = $2', [id, userId])).rowCount === 1;
}
export async function active() { return (await pool.query<Subscription>('SELECT * FROM subscriptions WHERE enabled = TRUE')).rows; }
export async function record(id: string, status: TicketStatus, name?: string) {
  await pool.query('UPDATE subscriptions SET last_status = $2, event_name = COALESCE($3, event_name), updated_at = now() WHERE id = $1', [id, status, name ?? null]);
}
export async function markNotified(id: string, status: TicketStatus) {
  await pool.query('UPDATE subscriptions SET last_notified_status = $2, updated_at = now() WHERE id = $1', [id, status]);
}

export async function recordSession(subscriptionId: string, session: TicketSession): Promise<StoredSession> {
  const { rows } = await pool.query<StoredSession>(`
    INSERT INTO subscription_sessions (
      subscription_id, session_key, session_date_time, session_name, session_venue, last_status
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (subscription_id, session_key) DO UPDATE SET
      session_date_time = EXCLUDED.session_date_time,
      session_name = EXCLUDED.session_name,
      session_venue = EXCLUDED.session_venue,
      last_status = EXCLUDED.last_status,
      updated_at = now()
    RETURNING session_key AS key, session_date_time AS "dateTime", session_name AS name,
      session_venue AS venue, last_status AS status, last_notified_status
  `, [subscriptionId, session.key, session.dateTime, session.name, session.venue, session.status]);
  return rows[0];
}

export async function markSessionNotified(subscriptionId: string, sessionKey: string, status: TicketStatus) {
  await pool.query(`UPDATE subscription_sessions SET last_notified_status = $3, updated_at = now()
    WHERE subscription_id = $1 AND session_key = $2`, [subscriptionId, sessionKey, status]);
}
