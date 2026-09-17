-- Job Application Tracker: Tracks user's job search pipeline
-- Stages: saved -> applied -> referral_sent -> referral_responded -> interview -> offer -> rejected -> withdrawn

CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID,  -- references scraped_jobs but nullable if job gets purged
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_url TEXT,
  stage TEXT NOT NULL DEFAULT 'saved' 
    CHECK (stage IN ('saved', 'applied', 'referral_sent', 'referral_responded', 'interview', 'offer', 'rejected', 'withdrawn')),
  referral_thread_id UUID,
  notes TEXT,
  match_score INTEGER,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_job_applications_user ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_stage ON job_applications(user_id, stage);

-- Prevent duplicate saves of the same job
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_applications_user_job 
  ON job_applications(user_id, job_id) 
  WHERE job_id IS NOT NULL;

-- RLS
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon_job_applications" ON job_applications FOR ALL TO anon USING (false);
