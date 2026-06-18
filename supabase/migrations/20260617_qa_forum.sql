alter table questions
add column if not exists type text not null default 'direct' check (type in ('direct', 'forum')),
add column if not exists likes_count integer not null default 0;

create table if not exists question_comments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  alias text not null,
  body text not null,
  parent_id uuid references question_comments(id) on delete cascade,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists question_likes (
  user_id uuid not null references users(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  comment_id uuid references question_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (question_id is not null and comment_id is null) or
    (question_id is null and comment_id is not null)
  ),
  unique nulls not distinct (user_id, question_id, comment_id)
);

alter table question_comments enable row level security;
alter table question_likes enable row level security;

create policy "deny_anon_comments" on question_comments for all to anon using (false);
create policy "deny_anon_likes" on question_likes for all to anon using (false);

create or replace function increment_question_likes(q_id uuid) returns void as $$ begin update questions set likes_count = likes_count + 1 where id = q_id; end; $$ language plpgsql;
create or replace function decrement_question_likes(q_id uuid) returns void as $$ begin update questions set likes_count = likes_count - 1 where id = q_id; end; $$ language plpgsql;
create or replace function increment_comment_likes(c_id uuid) returns void as $$ begin update question_comments set likes_count = likes_count + 1 where id = c_id; end; $$ language plpgsql;
create or replace function decrement_comment_likes(c_id uuid) returns void as $$ begin update question_comments set likes_count = likes_count - 1 where id = c_id; end; $$ language plpgsql;
