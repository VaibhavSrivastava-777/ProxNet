-- ProxNet initial schema

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  linkedin_sub text unique,
  linkedin_profile_url text,
  email text,
  full_name text not null default '',
  company text,
  job_title text,
  profile_photo_url text,
  source text not null default 'oauth' check (source in ('oauth', 'admin')),
  visibility jsonb not null default '{"showCompany":true,"showTitle":true,"showPhoto":false}'::jsonb,
  home_lat numeric,
  home_lng numeric,
  office_lat numeric,
  office_lng numeric,
  active_location text not null default 'home' check (active_location in ('home', 'office', 'current')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_current_locations (
  user_id uuid primary key references users(id) on delete cascade,
  lat numeric not null,
  lng numeric not null,
  updated_at timestamptz not null default now()
);

create table if not exists admin_credentials (
  id uuid primary key default gen_random_uuid(),
  su_id text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  asker_id uuid not null references users(id) on delete cascade,
  body text not null,
  company_filter text,
  title_filter text,
  center_lat numeric not null,
  center_lng numeric not null,
  radius_meters integer not null default 100,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists question_targets (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  professional_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'viewed', 'responded', 'declined')),
  unique (question_id, professional_id)
);

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists chat_participants (
  session_id uuid not null references chat_sessions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  alias text not null,
  primary key (session_id, user_id)
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_company on users(company);
create index if not exists idx_users_linkedin_sub on users(linkedin_sub);
create index if not exists idx_users_linkedin_profile_url on users(linkedin_profile_url);
create index if not exists idx_users_email on users(lower(email));
create index if not exists idx_question_targets_professional on question_targets(professional_id);
create index if not exists idx_chat_messages_session on chat_messages(session_id, created_at);

alter table users enable row level security;
alter table user_current_locations enable row level security;
alter table admin_credentials enable row level security;
alter table questions enable row level security;
alter table question_targets enable row level security;
alter table chat_sessions enable row level security;
alter table chat_participants enable row level security;
alter table chat_messages enable row level security;

-- Deny direct anon access; server uses service role
create policy "deny_anon_users" on users for all to anon using (false);
create policy "deny_anon_current_locations" on user_current_locations for all to anon using (false);
create policy "deny_anon_admin" on admin_credentials for all to anon using (false);
create policy "deny_anon_questions" on questions for all to anon using (false);
create policy "deny_anon_targets" on question_targets for all to anon using (false);
create policy "deny_anon_sessions" on chat_sessions for all to anon using (false);
create policy "deny_anon_participants" on chat_participants for all to anon using (false);
create policy "deny_anon_messages" on chat_messages for all to anon using (false);

-- Enable Realtime for chat_messages in Supabase Dashboard → Database → Replication
