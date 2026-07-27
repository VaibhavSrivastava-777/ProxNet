-- Core job posts table
CREATE TABLE IF NOT EXISTS job_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('seeker', 'giver')),
  role TEXT NOT NULL,
  company TEXT,
  experience_years TEXT,
  skills TEXT,
  description TEXT,
  contact_info TEXT,

  -- Visibility & Scope
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_meters INT DEFAULT 2000,
  is_public BOOLEAN DEFAULT true,

  -- Metadata
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE POLICY "Allow authenticated read on job_posts" ON job_posts FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on job_posts" ON job_posts FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Allow creator update on job_posts" ON job_posts FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Allow creator delete on job_posts" ON job_posts FOR DELETE USING (auth.uid() = creator_id);

CREATE POLICY "Allow authenticated read on interests" ON job_post_interests FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on interests" ON job_post_interests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow authenticated update on interests" ON job_post_interests FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated read on job_invites" ON job_post_invites FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on job_invites" ON job_post_invites FOR INSERT WITH CHECK (auth.uid() = invited_by);
