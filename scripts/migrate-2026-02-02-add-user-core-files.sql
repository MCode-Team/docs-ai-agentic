-- Migration: Add user_core_files and user_daily_memory tables
-- These tables are required for OpenClaw-style core files functionality

CREATE TABLE IF NOT EXISTS user_core_files (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  file_key TEXT NOT NULL, -- 'IDENTITY' | 'USER' | 'SOUL' | 'MEMORY'
  content TEXT NOT NULL DEFAULT '',
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, file_key)
);

CREATE INDEX IF NOT EXISTS idx_user_core_files_user ON user_core_files(user_id);

-- Daily memory logs like OpenClaw's memory/YYYY-MM-DD.md
CREATE TABLE IF NOT EXISTS user_daily_memory (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_memory_user_day ON user_daily_memory(user_id, day);

-- Queue for event-driven memory maintenance
CREATE TABLE IF NOT EXISTS memory_maintenance_queue (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  run_after TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_maintenance_queue_run_after
ON memory_maintenance_queue(status, run_after);
