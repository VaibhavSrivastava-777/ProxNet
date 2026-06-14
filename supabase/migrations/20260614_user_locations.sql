ALTER TABLE users 
ADD COLUMN IF NOT EXISTS home_name text,
ADD COLUMN IF NOT EXISTS office_name text;
