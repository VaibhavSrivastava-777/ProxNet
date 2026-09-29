-- Create user_streaks table for daily diligence streak tracking
CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  current_streak INT NOT NULL DEFAULT 1,
  longest_streak INT NOT NULL DEFAULT 1,
  last_checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_streak INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_user ON user_streaks(user_id);

-- Optional: Enable RLS and allow users to read their own streak
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_streaks' AND policyname = 'Users can view own streaks'
  ) THEN
    CREATE POLICY "Users can view own streaks" 
      ON user_streaks FOR SELECT 
      USING (true);
  END IF;
END $$;
