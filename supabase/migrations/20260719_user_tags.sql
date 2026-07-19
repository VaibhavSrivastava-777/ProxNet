-- Add tags array column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

-- Create an index for faster searching
CREATE INDEX IF NOT EXISTS idx_users_tags ON users USING GIN (tags);
