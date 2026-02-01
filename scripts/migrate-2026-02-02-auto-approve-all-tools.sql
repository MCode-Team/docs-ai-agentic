-- Migration: add auto_approve_all_tools to user_preferences
-- Safe to run multiple times.

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS auto_approve_all_tools BOOLEAN DEFAULT true;

-- Backfill existing rows (in case DEFAULT doesn't apply retroactively in some setups)
UPDATE user_preferences
SET auto_approve_all_tools = COALESCE(auto_approve_all_tools, true);
