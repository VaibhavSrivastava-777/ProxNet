-- Competitor companies mapping table
-- Stores competitor relationships for network companies to power competitor job scraping and market intelligence.

CREATE TABLE IF NOT EXISTS public.company_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  competitor_name TEXT NOT NULL,
  industry TEXT,
  discovery_source TEXT DEFAULT 'openai', -- 'seed', 'openai', 'manual'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_name, competitor_name)
);

CREATE INDEX IF NOT EXISTS idx_company_competitors_company ON company_competitors(company_name);
CREATE INDEX IF NOT EXISTS idx_company_competitors_competitor ON company_competitors(competitor_name);

-- RLS Policies
ALTER TABLE company_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on company_competitors"
  ON company_competitors FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read on company_competitors"
  ON company_competitors FOR SELECT
  TO authenticated
  USING (true);
