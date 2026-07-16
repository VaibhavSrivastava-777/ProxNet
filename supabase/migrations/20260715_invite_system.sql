-- Network Growth & Invite System
-- Adds invite tracking, points ledger, and user columns for the gamified invite system.

-- Each user gets a permanent invite code (generated at signup)
alter table users add column if not exists invite_code text unique;
alter table users add column if not exists invited_by uuid references users(id);
alter table users add column if not exists network_points integer not null default 0;

-- Track individual invite shares (for analytics: which channel, when)
create table if not exists invite_events (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references users(id) on delete cascade,
  channel text not null,
  invite_code text not null,
  clicked boolean not null default false,
  signed_up boolean not null default false,
  invitee_id uuid references users(id),
  created_at timestamptz not null default now()
);

-- Points ledger (every point transaction is logged for transparency)
create table if not exists network_points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  points integer not null,
  reason text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_invite_events_inviter on invite_events(inviter_id);
create index if not exists idx_invite_events_code on invite_events(invite_code);
create index if not exists idx_points_ledger_user on network_points_ledger(user_id);
