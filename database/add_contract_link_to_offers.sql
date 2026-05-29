-- ============================================================
-- Link offers → the contract created from them.
-- Run this in the Supabase SQL Editor (caoynokephxfyqofpufv)
-- BEFORE deploying the related code change.
--
-- When a seller accepts an offer and sends a contract from the inbox,
-- we now store the DocuSeal submission id on the offer so the chat/offers
-- UI can show "Contract sent — View contract" instead of prompting to
-- create one again. Purely additive — nothing else reads these columns.
-- ============================================================

alter table offers
  add column if not exists contract_submission_id text,
  add column if not exists contract_created_at    timestamptz;
