-- ProxNet Carpool Schema

-- Add phone number to users
alter table users add column if not exists phone_number text;

-- Carpool Posts
create table if not exists carpool_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('giver', 'seeker')),
  status text not null default 'active' check (status in ('active', 'expired', 'matched')),
  start_lat numeric not null,
  start_lng numeric not null,
  dest_lat numeric not null,
  dest_lng numeric not null,
  date date not null,
  time_start time not null,
  time_end time not null,
  seats integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Carpool Threads
create table if not exists carpool_threads (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references carpool_posts(id) on delete cascade,
  responder_post_id uuid not null references carpool_posts(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'reveal_pending', 'revealed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Carpool Participants
create table if not exists carpool_participants (
  thread_id uuid not null references carpool_threads(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  alias text not null,
  reveal_agreed boolean not null default false,
  primary key (thread_id, user_id)
);

-- Carpool Messages
create table if not exists carpool_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references carpool_threads(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_carpool_posts_user on carpool_posts(user_id);
create index if not exists idx_carpool_posts_status on carpool_posts(status);
create index if not exists idx_carpool_posts_type on carpool_posts(type);
create index if not exists idx_carpool_threads_post on carpool_threads(post_id);
create index if not exists idx_carpool_threads_responder on carpool_threads(responder_post_id);
create index if not exists idx_carpool_messages_thread on carpool_messages(thread_id, created_at);

-- RLS
alter table carpool_posts enable row level security;
alter table carpool_threads enable row level security;
alter table carpool_participants enable row level security;
alter table carpool_messages enable row level security;

-- Deny direct anon access; server uses service role
create policy "deny_anon_posts" on carpool_posts for all to anon using (false);
create policy "deny_anon_threads" on carpool_threads for all to anon using (false);
create policy "deny_anon_participants" on carpool_participants for all to anon using (false);
create policy "deny_anon_messages" on carpool_messages for all to anon using (false);

-- Function for Haversine Distance Calculation
-- Returns distance in meters between two lat/lng points
create or replace function haversine_distance(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric
language plpgsql immutable
as $$
declare
  r numeric := 6371000; -- Earth radius in meters
  p numeric := pi() / 180;
  a numeric;
begin
  a := 0.5 - cos((lat2 - lat1) * p) / 2 +
       cos(lat1 * p) * cos(lat2 * p) *
       (1 - cos((lng2 - lng1) * p)) / 2;
  return 2 * r * asin(sqrt(a));
end;
$$;
