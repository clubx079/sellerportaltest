-- Migration: Add seller–buyer support to existing conversations schema
-- Run this on the marketplace DB that already has conversations + messages.
-- Your schema already has seller_id; this adds buyer_uuid and makes user_id nullable
-- so seller-initiated conversations can be created before the buyer has opened the thread.

-- 1. Add buyer_uuid so we can find seller–buyer threads by buyer (UUID) from seller dashboard
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS buyer_uuid uuid NULL;

-- 2. Allow user_id to be NULL for seller-initiated threads (set when buyer first opens)
ALTER TABLE public.conversations
  ALTER COLUMN user_id DROP NOT NULL;

-- 3. Index for finding seller conversations by buyer
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_uuid ON public.conversations (buyer_uuid);

-- Optional: ensure messages.sender_id accepts text (UUID as string for seller)
-- Your schema already has sender_id text, so no change needed.
