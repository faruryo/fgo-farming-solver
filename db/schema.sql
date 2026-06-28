CREATE TABLE IF NOT EXISTS farming_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  objective TEXT NOT NULL,
  target_items TEXT NOT NULL, -- JSON string
  total_ap REAL NOT NULL,
  total_lap REAL NOT NULL,
  result_data TEXT NOT NULL, -- JSON string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  quest_selection TEXT,       -- JSON string. NULL = pre-feature rows.
  batch_id TEXT               -- UUID shared by A/B dual-goal pair. NULL = single-goal row.
);

CREATE INDEX IF NOT EXISTS idx_results_user_id ON farming_results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_created_at ON farming_results(created_at);
CREATE INDEX IF NOT EXISTS idx_results_batch ON farming_results(batch_id);

-- id format: "{user_id}:{YYYY-MM-DD}" so daily UPSERT works via ON CONFLICT(id).
CREATE TABLE IF NOT EXISTS state_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_created
  ON state_snapshots(user_id, created_at DESC);
