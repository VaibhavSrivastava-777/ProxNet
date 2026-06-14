DO $$ 
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'carpool_posts'::regclass AND contype = 'c' AND conname LIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE carpool_posts DROP CONSTRAINT ' || constraint_name;
  END IF;
END $$;

ALTER TABLE carpool_posts 
ADD CONSTRAINT carpool_posts_status_check CHECK (status IN ('active', 'expired', 'matched', 'implicit'));
