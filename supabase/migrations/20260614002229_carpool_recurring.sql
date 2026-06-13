-- Add recurring columns to carpool_posts
alter table carpool_posts
add column is_recurring boolean not null default false,
add column recurring_days integer[] default null;

-- Make date nullable since recurring posts won't have a specific date
alter table carpool_posts
alter column date drop not null;
