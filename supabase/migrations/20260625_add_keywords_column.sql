-- Migration to add keywords column to scraped_jobs table
ALTER TABLE public.scraped_jobs 
ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}'::text[];

-- Recreate or update match_scraped_jobs RPC function to include the keywords column if it was defined with a static column list.
-- If the function returns "SETOF scraped_jobs" or "TABLE(like scraped_jobs)", it will automatically pick up the new column.
-- Otherwise, if the user experiences matching issues, they should verify their SQL RPC definition in Supabase.
