-- Fix chat_messages foreign key constraint and assign messages to chats
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the incorrect foreign key constraint
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_chat_id_fkey;

-- Step 2: Add the correct foreign key constraint
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_chat_id_fkey
FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;

-- Step 3: Assign all existing messages to appropriate chats based on creation time
-- Clear existing assignments first
UPDATE chat_messages SET chat_id = NULL WHERE chat_id IS NOT NULL;

-- Assign messages to chats based on time proximity (within 1 hour)
UPDATE chat_messages
SET chat_id = (
  SELECT c.id
  FROM chats c
  WHERE c.user_id::text = chat_messages.user_id
  AND c.created_at <= chat_messages.created_at
  AND c.created_at >= (chat_messages.created_at - INTERVAL '1 hour')
  ORDER BY c.created_at DESC
  LIMIT 1
)
WHERE chat_id IS NULL;

-- Step 4: Verify the fix
SELECT
  cm.id,
  cm.chat_id,
  c.title as chat_title,
  cm.user_message
FROM chat_messages cm
LEFT JOIN chats c ON cm.chat_id = c.id
LIMIT 5;
