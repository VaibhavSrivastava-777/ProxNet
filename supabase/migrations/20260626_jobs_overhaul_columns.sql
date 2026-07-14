-- Migration to add scraping columns and profile digest for jobs overhaul

ALTER TABLE public.company_ats_config
ADD COLUMN IF NOT EXISTS scrape_notes TEXT,
ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_jobs_found INTEGER DEFAULT 0;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS profile_digest JSONB DEFAULT NULL;
