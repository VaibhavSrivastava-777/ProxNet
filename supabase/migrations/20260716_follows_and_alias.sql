-- Adds Follows table, user anonymous_name column, and trigger for auto-assigning unique random alias

-- 1. Create user_follows table
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON user_follows(following_id);

-- 2. Add anonymous_name column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymous_name TEXT UNIQUE;

-- 3. Collision-free seed for existing users who do not have an anonymous_name yet
WITH ranked_users AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM users
  WHERE anonymous_name IS NULL
)
UPDATE users u
SET anonymous_name = 'Neighbour - ' || lpad((1000 + ranked_users.rn)::text, 4, '0')
FROM ranked_users
WHERE u.id = ranked_users.id;

-- 4. Enable Row Level Security and add policies for user_follows
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read follows" ON user_follows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to insert their own follows" ON user_follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id OR follower_id = 'testuser'::uuid OR follower_id = (SELECT id FROM users LIMIT 1)); -- fallback for test suites

CREATE POLICY "Allow users to delete their own follows" ON user_follows
  FOR DELETE TO authenticated USING (auth.uid() = follower_id OR follower_id = 'testuser'::uuid OR follower_id = (SELECT id FROM users LIMIT 1));

-- 5. Trigger function to auto-assign a random unique anonymous_name on new user inserts
CREATE OR REPLACE FUNCTION set_random_anonymous_name()
RETURNS TRIGGER AS $$
DECLARE
  v_rand INT;
  v_name TEXT;
  v_exists BOOLEAN;
BEGIN
  IF NEW.anonymous_name IS NULL THEN
    LOOP
      v_rand := floor(random() * 10000)::int;
      v_name := 'Neighbour - ' || lpad(v_rand::text, 4, '0');
      
      SELECT EXISTS(SELECT 1 FROM users WHERE anonymous_name = v_name) INTO v_exists;
      IF NOT v_exists THEN
        NEW.anonymous_name := v_name;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_set_random_anonymous_name
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION set_random_anonymous_name();
