import { pool } from './pool.js';

await pool.query(`
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    event_url TEXT NOT NULL,
    event_name TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_status TEXT NOT NULL DEFAULT 'unknown',
    last_notified_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(line_user_id, event_url)
  );
  CREATE INDEX IF NOT EXISTS subscriptions_enabled_idx ON subscriptions (enabled) WHERE enabled;
  CREATE TABLE IF NOT EXISTS subscription_sessions (
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    session_key TEXT NOT NULL,
    session_date_time TEXT NOT NULL,
    session_name TEXT NOT NULL,
    session_venue TEXT NOT NULL,
    last_status TEXT NOT NULL DEFAULT 'unknown',
    last_notified_status TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (subscription_id, session_key)
  );
`);
await pool.end();
