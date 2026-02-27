-- Migration: Add SEO & Social columns to wholesale_deals
-- Run this in the Marketplace DB (Supabase) so sellers can edit SEO for scraped deals in the seller dashboard.

-- SEO (meta title/description for search engines)
ALTER TABLE public.wholesale_deals
  ADD COLUMN IF NOT EXISTS seo_title text NULL,
  ADD COLUMN IF NOT EXISTS seo_description text NULL;

-- Social sharing (Open Graph / Twitter cards)
ALTER TABLE public.wholesale_deals
  ADD COLUMN IF NOT EXISTS social_title text NULL,
  ADD COLUMN IF NOT EXISTS social_description text NULL,
  ADD COLUMN IF NOT EXISTS social_image_url text NULL;

-- Optional: add comments for clarity
COMMENT ON COLUMN public.wholesale_deals.seo_title IS 'SEO meta title (e.g. for <title>, max ~60 chars)';
COMMENT ON COLUMN public.wholesale_deals.seo_description IS 'SEO meta description (e.g. for <meta name="description">, max ~160 chars)';
COMMENT ON COLUMN public.wholesale_deals.social_title IS 'Title for social share previews (Open Graph, Twitter)';
COMMENT ON COLUMN public.wholesale_deals.social_description IS 'Description for social share previews';
COMMENT ON COLUMN public.wholesale_deals.social_image_url IS 'Image URL for social share previews';
