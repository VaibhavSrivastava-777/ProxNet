-- Core event table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  
  -- Timing
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  
  -- Venue
  venue_name TEXT NOT NULL,
  venue_lat DOUBLE PRECISION NOT NULL,
  venue_lng DOUBLE PRECISION NOT NULL,
  
  -- Visibility & Scope
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_meters INT DEFAULT 2000,
  is_public BOOLEAN DEFAULT true,
  
  -- Recurring
  recurrence_rule TEXT,
  parent_event_id UUID REFERENCES events(id),
  
  -- Metadata
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RSVP tracking
CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'yes',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- @-mention invites
CREATE TABLE IF NOT EXISTS event_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  invited_phone TEXT,
  invited_email TEXT,
  invite_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, invited_user_id)
);

-- Comments on events
CREATE TABLE IF NOT EXISTS event_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Likes on events
CREATE TABLE IF NOT EXISTS event_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES event_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id, comment_id)
);

-- Notification schedule tracking
CREATE TABLE IF NOT EXISTS event_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id, notification_type)
);

-- Add RLS Policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_notifications_log ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and insert
CREATE POLICY "Allow authenticated read on events" ON events FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on events" ON events FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Allow creator update on events" ON events FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Allow creator delete on events" ON events FOR DELETE USING (auth.uid() = creator_id);

CREATE POLICY "Allow authenticated read on rsvps" ON event_rsvps FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on rsvps" ON event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow authenticated update on rsvps" ON event_rsvps FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated read on invites" ON event_invites FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on invites" ON event_invites FOR INSERT WITH CHECK (auth.uid() = invited_by);

CREATE POLICY "Allow authenticated read on comments" ON event_comments FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on comments" ON event_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated read on likes" ON event_likes FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on likes" ON event_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow authenticated delete on likes" ON event_likes FOR DELETE USING (auth.uid() = user_id);
