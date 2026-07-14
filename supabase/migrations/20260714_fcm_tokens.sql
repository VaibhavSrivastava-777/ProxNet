-- Create fcm_tokens table to support Firebase Cloud Messaging
create table if not exists fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null,
  platform text default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

-- Enable RLS
alter table fcm_tokens enable row level security;

-- Deny direct anon access; server uses service role
create policy "deny_anon_fcm_tokens" on fcm_tokens for all to anon using (false);
