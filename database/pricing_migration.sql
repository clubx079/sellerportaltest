-- ============================================================
-- DeelMap Pricing & Onboarding Migration
-- Run this in Supabase SQL Editor (caoynokephxfyqofpufv)
-- ============================================================

-- 1. Alter seller_applications — add onboarding columns
ALTER TABLE seller_applications
  ADD COLUMN IF NOT EXISTS stripe_customer_id   text,
  ADD COLUMN IF NOT EXISTS phone_verified        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step       int DEFAULT 1;
-- onboarding_step: 1=registered, 2=phone_verified, 3=plan_selected, 4=paid, 5=complete

-- 2. New table: seller_plans
CREATE TABLE IF NOT EXISTS seller_plans (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id                 uuid NOT NULL REFERENCES seller_applications(id) ON DELETE CASCADE,
  plan_type                 text NOT NULL CHECK (plan_type IN ('standard', 'pro', 'enterprise')),
  billing_cycle             text CHECK (billing_cycle IN ('monthly', 'annual', 'one_time')),
  status                    text NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
  stripe_customer_id        text,
  stripe_subscription_id    text,
  stripe_price_id           text,
  quantity                  int DEFAULT 1,
  trial_ends_at             timestamptz,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  listings_used_this_period int DEFAULT 0,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- 3. New table: listing_addons
CREATE TABLE IF NOT EXISTS listing_addons (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id               uuid NOT NULL,
  seller_id                 uuid NOT NULL,
  addon_type                text NOT NULL CHECK (addon_type IN ('highlight', 'homepage', 'boost', 'bundle')),
  stripe_payment_intent_id  text,
  amount_paid               int,
  days_purchased            int,
  starts_at                 timestamptz DEFAULT now(),
  ends_at                   timestamptz,
  status                    text DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  created_at                timestamptz DEFAULT now()
);

-- 4. Add listing enhancement columns to wholesale_deals
ALTER TABLE wholesale_deals
  ADD COLUMN IF NOT EXISTS is_highlighted           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS highlight_ends_at        timestamptz,
  ADD COLUMN IF NOT EXISTS is_homepage_featured     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS homepage_feature_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_boosted               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS boost_ends_at            timestamptz,
  ADD COLUMN IF NOT EXISTS search_priority          int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_plan_id           uuid REFERENCES seller_plans(id) ON DELETE SET NULL;

-- 5. Add listing enhancement columns to properties (buyer-posted listings)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS is_highlighted           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS highlight_ends_at        timestamptz,
  ADD COLUMN IF NOT EXISTS is_homepage_featured     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS homepage_feature_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_boosted               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS boost_ends_at            timestamptz,
  ADD COLUMN IF NOT EXISTS search_priority          int DEFAULT 0;

-- 6. Index for fast addon expiry queries
CREATE INDEX IF NOT EXISTS idx_listing_addons_ends_at ON listing_addons(ends_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_seller_plans_seller_id ON seller_plans(seller_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_deals_boosted ON wholesale_deals(is_boosted, search_priority);
