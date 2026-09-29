-- Profile Likes table for Tinder-style Network Discovery
-- Tracks likes and skips, enables mutual matching and notification triggers

CREATE TABLE IF NOT EXISTS public.profile_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'skip')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(liker_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_likes_liker ON public.profile_likes(liker_id);
CREATE INDEX IF NOT EXISTS idx_profile_likes_target ON public.profile_likes(target_id);
CREATE INDEX IF NOT EXISTS idx_profile_likes_mutual ON public.profile_likes(liker_id, target_id, action);

-- RLS Policies
ALTER TABLE public.profile_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on profile_likes"
  ON public.profile_likes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow users to read their own likes and targets"
  ON public.profile_likes FOR SELECT
  TO authenticated
  USING (auth.uid() = liker_id);

CREATE POLICY "Allow users to insert/update their own likes"
  ON public.profile_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = liker_id);

CREATE POLICY "Allow users to update their own likes"
  ON public.profile_likes FOR UPDATE
  TO authenticated
  USING (auth.uid() = liker_id)
  WITH CHECK (auth.uid() = liker_id);
