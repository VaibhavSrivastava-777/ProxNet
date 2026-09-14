-- Email notification delivery and rate-limiting audit log
CREATE TABLE IF NOT EXISTS email_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user rate-limit queries
CREATE INDEX IF NOT EXISTS idx_email_notifications_log_user ON email_notifications_log(user_id, sent_at);

-- Add RLS Policies
ALTER TABLE email_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on email_notifications_log"
  ON email_notifications_log FOR ALL
  USING (true);
