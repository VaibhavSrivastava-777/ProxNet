create table if not exists public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  body text not null,
  url text not null,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.in_app_notifications enable row level security;

create policy "Users can view their own notifications"
  on public.in_app_notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.in_app_notifications for update
  using (auth.uid() = user_id);
