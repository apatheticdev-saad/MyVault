PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_initialized INTEGER NOT NULL DEFAULT 0,
  auth_mode TEXT NOT NULL DEFAULT 'pin' CHECK (auth_mode IN ('pin', 'username_password')),
  pin_length INTEGER NOT NULL DEFAULT 6 CHECK (pin_length IN (4, 6)),
  pin_salt TEXT,
  pin_hash TEXT,
  recovery_salt TEXT,
  recovery_hash TEXT,
  username TEXT,
  password_salt TEXT,
  password_hash TEXT,
  google_refresh_token_enc TEXT,
  google_access_token_enc TEXT,
  google_access_token_expires_at INTEGER,
  google_root_folder_id TEXT,
  google_oauth_state TEXT,
  google_oauth_state_created_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  drive_file_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  parent_drive_id TEXT,
  is_trashed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  modified_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent_drive_id, is_trashed);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);

CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  drive_session_url_enc TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  parent_drive_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  drive_file_id TEXT NOT NULL,
  expires_at INTEGER,
  allow_download INTEGER NOT NULL DEFAULT 1,
  password_salt TEXT,
  password_hash TEXT,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_share_token ON share_links(token_hash);
