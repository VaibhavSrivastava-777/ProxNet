-- Migration to add fields for Jobs Notifications
alter table job_participants
add column if not exists last_read_at timestamptz default now();

alter table job_posts
add column if not exists last_checked_matches_at timestamptz default now();
