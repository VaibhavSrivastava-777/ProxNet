-- Create push_subscriptions table for Web Push
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- Enable RLS
alter table push_subscriptions enable row level security;

-- Deny direct anon access; server uses service role
create policy "deny_anon_push_subscriptions" on push_subscriptions for all to anon using (false);
