-- Migration to add chat_id and other missing columns to chat_messages table
-- Run this in your Supabase SQL Editor

-- Add chat_id column
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES chats(id) ON DELETE CASCADE;

-- Add role column for message type
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('user', 'assistant'));

-- Add content column as the main message content
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content TEXT;

-- Add response metadata columns
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS response_type TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

-- Update existing records to have role based on whether they have user_message or ai_response
UPDATE chat_messages SET role = 'user' WHERE user_message IS NOT NULL AND ai_response IS NULL;
UPDATE chat_messages SET role = 'assistant' WHERE ai_response IS NOT NULL AND user_message IS NULL;

-- Set content to user_message for user messages, ai_response for assistant messages
UPDATE chat_messages SET content = COALESCE(user_message, ai_response) WHERE content IS NULL;

-- Create index for the new chat_id column
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);

-- Update the policies if needed (they should already allow all access)
