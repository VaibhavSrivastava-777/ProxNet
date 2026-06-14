-- Migration to add fields for Carpool Notifications
alter table carpool_participants
add column if not exists last_read_at timestamptz default now();

alter table carpool_posts
add column if not exists last_checked_matches_at timestamptz default now();
