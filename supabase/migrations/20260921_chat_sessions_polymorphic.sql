-- Migration: 20260921_chat_sessions_polymorphic.sql
-- Add polymorphic session classification and context tracking to chat_sessions
-- Prevents unexplained question_id = NULL rows and supports direct, referral, beacon, and AI sessions.

ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'direct';

ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS context_id uuid;

ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Performance indexes for polymorphic session querying
CREATE INDEX IF NOT EXISTS idx_chat_sessions_type ON chat_sessions(type);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_context_id ON chat_sessions(context_id);

-- Backfill: Tag historical AI chat sessions
UPDATE chat_sessions
SET type = 'ai'
WHERE question_id IS NULL
  AND id IN (
    SELECT cp.session_id
    FROM chat_participants cp
    JOIN users u ON cp.user_id = u.id
    WHERE u.email = 'ai@proxnet.in' OR cp.alias = 'ProxNet AI'
  );
