ALTER TABLE carpool_posts 
ADD COLUMN IF NOT EXISTS start_name text,
ADD COLUMN IF NOT EXISTS dest_name text;
