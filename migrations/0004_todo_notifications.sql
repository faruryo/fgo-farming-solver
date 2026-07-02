-- Migration number: 0004 	 2026-07-02T00:00:00.000Z

-- No FK between push_subscriptions and notification_log: no FK precedent in
-- 0001_init_schema.sql, and the dispatcher script deletes both explicitly on
-- subscription expiry (see openspec/changes/todo-management/design.md Decisions #1/#3).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS notification_log (
  subscription_id TEXT NOT NULL,
  notification_key TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (subscription_id, notification_key)
);
