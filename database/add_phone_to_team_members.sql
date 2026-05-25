-- ============================================================
-- Add `phone` column to `org_members` (the team-members table).
-- Run this in the Supabase SQL Editor (caoynokephxfyqofpufv)
-- BEFORE deploying the related code change.
--
-- Why: enterprise owners need to assign a contact phone to each
-- team member so listings can pick a team member from a dropdown
-- and auto-fill contact name + phone.
-- ============================================================

ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS phone TEXT;
