-- Institutes & Alumni Affiliations Schema

CREATE TABLE IF NOT EXISTS institutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_code TEXT UNIQUE,
  verified_domains TEXT[] DEFAULT '{}',
  logo_url TEXT,
  category TEXT DEFAULT 'university'
    CHECK (category IN ('iit', 'iim', 'nit', 'bits', 'iiit', 'university', 'other')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_institute_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  degree TEXT,
  batch_year INT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('verified_domain', 'verified_manual', 'unverified')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, institute_id, degree)
);

CREATE INDEX IF NOT EXISTS idx_affiliations_user ON user_institute_affiliations(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliations_institute ON user_institute_affiliations(institute_id);
CREATE INDEX IF NOT EXISTS idx_institutes_domains ON institutes USING GIN (verified_domains);

-- Row Level Security
ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_institute_affiliations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'institutes' AND policyname = 'allow_read_institutes') THEN
    CREATE POLICY "allow_read_institutes" ON institutes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_institute_affiliations' AND policyname = 'allow_read_affiliations') THEN
    CREATE POLICY "allow_read_affiliations" ON user_institute_affiliations FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_institute_affiliations' AND policyname = 'deny_anon_affiliations_write') THEN
    CREATE POLICY "deny_anon_affiliations_write" ON user_institute_affiliations FOR INSERT TO anon WITH CHECK (false);
  END IF;
END $$;

-- Pre-seed top Indian institutes with official domains
INSERT INTO institutes (name, short_code, verified_domains, category) VALUES
  ('IIT Kanpur', 'IITK', ARRAY['iitk.ac.in'], 'iit'),
  ('IIT Bombay', 'IITB', ARRAY['iitb.ac.in'], 'iit'),
  ('IIT Delhi', 'IITD', ARRAY['iitd.ac.in'], 'iit'),
  ('IIT Madras', 'IITM', ARRAY['iitm.ac.in'], 'iit'),
  ('IIT Kharagpur', 'IITKGP', ARRAY['iitkgp.ac.in'], 'iit'),
  ('IIT Roorkee', 'IITR', ARRAY['iitr.ac.in'], 'iit'),
  ('IIT Guwahati', 'IITG', ARRAY['iitg.ac.in'], 'iit'),
  ('IIT Hyderabad', 'IITH', ARRAY['iith.ac.in'], 'iit'),
  ('IIT BHU', 'IITBHU', ARRAY['iitbhu.ac.in', 'itbhu.ac.in'], 'iit'),
  ('IIT Indore', 'IITI', ARRAY['iiti.ac.in'], 'iit'),
  ('IIT Gandhinagar', 'IITGN', ARRAY['iitgn.ac.in'], 'iit'),
  ('IIT Jodhpur', 'IITJ', ARRAY['iitj.ac.in'], 'iit'),
  ('IIT Patna', 'IITP', ARRAY['iitp.ac.in'], 'iit'),
  ('IIT Mandi', 'IITMandi', ARRAY['iitmandi.ac.in'], 'iit'),
  ('IIT Ropar', 'IITRPR', ARRAY['iitrpr.ac.in'], 'iit'),
  ('IIT Tirupati', 'IITTP', ARRAY['iittp.ac.in'], 'iit'),
  ('IIT Palakkad', 'IITPKD', ARRAY['iitpkd.ac.in'], 'iit'),
  ('IIT Dhanbad', 'IITISM', ARRAY['iitism.ac.in'], 'iit'),
  ('IIT Bhilai', 'IITBhilai', ARRAY['iitbhilai.ac.in'], 'iit'),
  ('IIT Dharwad', 'IITDH', ARRAY['iitdh.ac.in'], 'iit'),
  ('IIT Jammu', 'IITJMU', ARRAY['iitjammu.ac.in'], 'iit'),
  ('IIT Goa', 'IITGoa', ARRAY['iitgoa.ac.in'], 'iit'),
  ('IIM Ahmedabad', 'IIMA', ARRAY['iima.ac.in'], 'iim'),
  ('IIM Bangalore', 'IIMB', ARRAY['iimb.ac.in'], 'iim'),
  ('IIM Calcutta', 'IIMC', ARRAY['iimcal.ac.in'], 'iim'),
  ('IIM Lucknow', 'IIML', ARRAY['iiml.ac.in'], 'iim'),
  ('IIM Indore', 'IIMI', ARRAY['iimidr.ac.in'], 'iim'),
  ('IIM Kozhikode', 'IIMK', ARRAY['iimk.ac.in'], 'iim'),
  ('BITS Pilani', 'BITS', ARRAY['pilani.bits-pilani.ac.in', 'goa.bits-pilani.ac.in', 'hyderabad.bits-pilani.ac.in', 'bits-pilani.ac.in'], 'bits'),
  ('NIT Trichy', 'NITT', ARRAY['nitt.edu'], 'nit'),
  ('NIT Warangal', 'NITW', ARRAY['nitw.ac.in'], 'nit'),
  ('NIT Surathkal', 'NITK', ARRAY['nitk.edu.in'], 'nit'),
  ('NIT Calicut', 'NITC', ARRAY['nitc.ac.in'], 'nit'),
  ('IIIT Hyderabad', 'IIITH', ARRAY['iiit.ac.in'], 'iiit'),
  ('IIIT Delhi', 'IIITD', ARRAY['iiitd.ac.in'], 'iiit'),
  ('IIIT Bangalore', 'IIITB', ARRAY['iiitb.ac.in'], 'iiit'),
  ('ISB Hyderabad', 'ISB', ARRAY['isb.edu'], 'other'),
  ('Delhi University', 'DU', ARRAY['du.ac.in'], 'university'),
  ('DTU Delhi', 'DTU', ARRAY['dtu.ac.in'], 'university'),
  ('NSUT Delhi', 'NSUT', ARRAY['nsut.ac.in', 'nsit.ac.in'], 'university')
ON CONFLICT (short_code) DO NOTHING;
