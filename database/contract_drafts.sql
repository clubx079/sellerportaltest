-- contract_drafts: persistent draft state for the multi-step contract wizard.
--
-- The wizard at /contracts/new auto-saves every 2 seconds. Drafts live entirely
-- in our DB until the seller hits "Send Contract" — at that point we POST to
-- DocuSeal and flip status='sent' + store the returned submission id.
--
-- IMPORTANT: run this migration manually against the Deelmap Supabase project
-- (https://caoynokephxfyqofpufv.supabase.co) BEFORE deploying. Railway does not
-- run SQL migrations automatically.

CREATE TABLE IF NOT EXISTS contract_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  template_id text NOT NULL,                       -- DocuSeal template id
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  buyer_name text,
  buyer_email text,
  field_values jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',            -- draft | sent
  docuseal_submission_id text,                     -- set when sent
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_drafts_seller ON contract_drafts(seller_id);
CREATE INDEX IF NOT EXISTS idx_contract_drafts_status ON contract_drafts(status);
