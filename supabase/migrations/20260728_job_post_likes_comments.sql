-- Migration: Job Post Likes and Comments

CREATE TABLE IF NOT EXISTS job_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_post_id, user_id)
);

CREATE TABLE IF NOT EXISTS job_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE job_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_post_comments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read on job_post_likes') THEN
    EXECUTE 'CREATE POLICY "Allow authenticated read on job_post_likes" ON job_post_likes FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated insert on job_post_likes') THEN
    EXECUTE 'CREATE POLICY "Allow authenticated insert on job_post_likes" ON job_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow user delete on job_post_likes') THEN
    EXECUTE 'CREATE POLICY "Allow user delete on job_post_likes" ON job_post_likes FOR DELETE USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read on job_post_comments') THEN
    EXECUTE 'CREATE POLICY "Allow authenticated read on job_post_comments" ON job_post_comments FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated insert on job_post_comments') THEN
    EXECUTE 'CREATE POLICY "Allow authenticated insert on job_post_comments" ON job_post_comments FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow author delete on job_post_comments') THEN
    EXECUTE 'CREATE POLICY "Allow author delete on job_post_comments" ON job_post_comments FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $$;
