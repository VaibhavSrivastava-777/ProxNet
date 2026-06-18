alter table job_posts
add column if not exists is_on_behalf boolean not null default false,
add column if not exists contact_number text;
