-- Adds is_anonymous column to questions table (defaults to true for privacy-first model)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT true;
