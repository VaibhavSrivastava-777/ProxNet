-- 1. Referral requests: a seeker asks one specific professional (giver) at a company.
--    Credit is charged only when the giver accepts (see lib/referrals.ts).
CREATE TABLE IF NOT EXISTS public.referral_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seeker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  giver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'declined', 'accepted', 'referral_posted', 'completed')),
  thread_id UUID REFERENCES public.job_threads(id) ON DELETE SET NULL,
  referral_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  posted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_referral_requests_seeker ON public.referral_requests(seeker_id);
CREATE INDEX IF NOT EXISTS idx_referral_requests_giver ON public.referral_requests(giver_id, status);

-- 2. Companies: optional logo per company. Companies without a row fall back to initials.
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT GENERATED ALWAYS AS (lower(btrim(name))) STORED UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Server-side access only (service role). Block anonymous clients.
ALTER TABLE public.referral_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 3. Starter credit: 1 credit, granted when the profile is complete.
--    The LinkedIn URL requirement is removed (LinkedIn sign-in no longer exists).
--    Existing users keep whatever they already have.
CREATE OR REPLACE FUNCTION grant_initial_credits()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.initial_credits_granted = false AND
       NEW.full_name IS NOT NULL AND NEW.full_name != '' AND
       NEW.email IS NOT NULL AND NEW.email != '' AND
       NEW.company IS NOT NULL AND NEW.company != '' AND
       NEW.job_title IS NOT NULL AND NEW.job_title != '' AND
       NEW.profile_photo_url IS NOT NULL AND NEW.profile_photo_url != '' AND
       NEW.home_lat IS NOT NULL AND NEW.home_lng IS NOT NULL THEN

       NEW.wallet = NEW.wallet + 1;
       NEW.initial_credits_granted = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
