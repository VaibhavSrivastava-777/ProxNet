DO $$ 
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'job_posts'::regclass AND contype = 'c' AND conname LIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE job_posts DROP CONSTRAINT ' || constraint_name;
  END IF;
END $$;

ALTER TABLE job_posts 
ADD CONSTRAINT job_posts_status_check CHECK (status IN ('active', 'matched', 'implicit'));
