-- Migration: 20260918_user_scrapbook.sql
-- Adds scrapbook profile fields and micro_status for viral proximity interactions

-- 1. Extend users table with humble scrapbook attributes
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS help_offers text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tinkering_with text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ask_me_about text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS quick_chat_preference text DEFAULT 'chai',
ADD COLUMN IF NOT EXISTS society_name text DEFAULT NULL;

-- Index for searching users offering help
CREATE INDEX IF NOT EXISTS idx_users_help_offers ON users USING GIN (help_offers);
CREATE INDEX IF NOT EXISTS idx_users_society_name ON users (society_name);

-- 2. Micro Status Table for 15-Minute Chai / Walk & Talk Beacons
CREATE TABLE IF NOT EXISTS micro_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity text NOT NULL CHECK (activity IN ('chai', 'walk', 'sports', 'quick_chat')),
  note text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_micro_status_expires ON micro_status (expires_at);
CREATE INDEX IF NOT EXISTS idx_micro_status_user ON micro_status (user_id);
