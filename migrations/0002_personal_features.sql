CREATE TABLE IF NOT EXISTS favorites (
  drive_file_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS recent_items (
  drive_file_id TEXT PRIMARY KEY,
  opened_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recent_opened ON recent_items(opened_at DESC);
