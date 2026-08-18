-- Per-user target companies table
-- Stores each user's preferred companies and their resolved career site ATS configs.
-- Separate from global company_ats_config; each user gets their own rows.

CREATE TABLE IF NOT EXISTS public.user_target_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  careers_url TEXT,                          -- User-provided or auto-discovered career site URL
  ats_provider TEXT,                         -- Resolved ATS provider (greenhouse, lever, workday, custom, etc.)
  ats_board_token TEXT,                      -- Resolved board token or full URL for the provider
  is_auto_discovered BOOLEAN DEFAULT false,  -- Whether the ATS was auto-discovered vs manually provided
  last_scraped_at TIMESTAMPTZ,
  scrape_status TEXT DEFAULT 'pending' CHECK (scrape_status IN ('pending', 'success', 'failed', 'no_ats')),
  scrape_notes TEXT,
  total_jobs_found INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_name)
);

CREATE INDEX IF NOT EXISTS idx_utc_user ON user_target_companies(user_id);

-- RLS
ALTER TABLE user_target_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_anon_user_target_companies" ON user_target_companies FOR ALL TO anon USING (false);
