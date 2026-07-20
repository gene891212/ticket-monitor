CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  line_user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  event_url TEXT NOT NULL,
  event_name TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(line_user_id, event_url)
);

CREATE TABLE IF NOT EXISTS subscription_sessions (
  subscription_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  session_date_time TEXT NOT NULL,
  session_name TEXT NOT NULL,
  session_venue TEXT NOT NULL,
  last_status TEXT NOT NULL DEFAULT 'unknown',
  last_status_name TEXT,
  last_notified_status TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (subscription_id, session_key),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE TABLE IF NOT EXISTS manual_check_requests (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  reply_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claimed_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS manual_check_requests_pending_idx ON manual_check_requests(status, created_at);
