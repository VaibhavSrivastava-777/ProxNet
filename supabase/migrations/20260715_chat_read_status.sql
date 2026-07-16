-- Add read/unread status for chat messages
alter table chat_messages add column if not exists is_read boolean not null default false;
