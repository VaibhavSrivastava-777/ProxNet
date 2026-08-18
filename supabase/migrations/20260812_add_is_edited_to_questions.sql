-- Adds is_edited column to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false;
