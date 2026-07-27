-- Core job posts table (safe creation and column additions for existing schemas)
CREATE TABLE IF NOT EXISTS job_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('seeker', 'giver')),
  role TEXT NOT NULL,
  company TEXT,
  experience_years TEXT,
  skills TEXT,
  description TEXT,
  contact_info TEXT,

  -- Visibility & Scope
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_meters INT DEFAULT 2000,
  is_public BOOLEAN DEFAULT true,

  -- Metadata
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on job_posts table if it was created previously
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS experience_years TEXT;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS skills TEXT;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS contact_info TEXT;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS center_lat DOUBLE PRECISION;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS center_lng DOUBLE PRECISION;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS radius_meters INT DEFAULT 2000;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Sync user_id and creator_id for backward compatibility
UPDATE job_posts SET creator_id = user_id WHERE creator_id IS NULL AND user_id IS NOT NULL;
UPDATE job_posts SET user_id = creator_id WHERE user_id IS NULL AND creator_id IS NOT NULL;

-- Job post interest tracking (RSVP equivalent)
CREATE TABLE IF NOT EXISTS job_post_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'interested',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_post_id, user_id)
);

-- @-mention invites
CREATE TABLE IF NOT EXISTS job_post_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE job_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_post_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_post_invites ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read on job_posts') THEN
    CREATE POLICY "Allow authenticated read on job_posts" ON job_posts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated insert on job_posts') THEN
    CREATE POLICY "Allow authenticated insert on job_posts" ON job_posts FOR INSERT WITH CHECK (auth.uid() = COALESCE(creator_id, user_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow creator update on job_posts') THEN
    CREATE POLICY "Allow creator update on job_posts" ON job_posts FOR UPDATE USING (auth.uid() = COALESCE(creator_id, user_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow creator delete on job_posts') THEN
    CREATE POLICY "Allow creator delete on job_posts" ON job_posts FOR DELETE USING (auth.uid() = COALESCE(creator_id, user_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read on interests') THEN
    CREATE POLICY "Allow authenticated read on interests" ON job_post_interests FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated insert on interests') THEN
    CREATE POLICY "Allow authenticated insert on interests" ON job_post_interests FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read on job_invites') THEN
    CREATE POLICY "Allow authenticated read on job_invites" ON job_post_invites FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated insert on job_invites') THEN
    CREATE POLICY "Allow authenticated insert on job_invites" ON job_post_invites FOR INSERT WITH CHECK (auth.uid() = invited_by);
  END IF;
END $$;
