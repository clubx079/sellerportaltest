# wholesale_deals → Edit UI Mapping

This document defines which `wholesale_deals` and `property_photos` columns are **property data** (shown and editable in the seller edit form) vs **source/metadata** (not shown to the seller).

---

## 1. UI fields → Manual columns → Wholesale deals columns (single reference table)

**Same edit layout and same fields for both manual and scraped.** Data is loaded from and saved to the correct table per type; scraped deals use the wholesale_deals columns that best match each UI field.

| # | Field shown in UI (edit form) | Manual: `properties` column(s) | Scraped: `wholesale_deals` column(s) |
|---|-------------------------------|-------------------------------|----------------------------------------|
| 1 | **Property Title** | `slug` (title derived via slugToTitle) | `slug` (or `full_address` / `display_address` if slug empty) |
| 2 | **Location** (single-line address) | `address` | `full_address` or `display_address` or `address` |
| 3 | **Price ($)** | `price` | `price` |
| 4 | **Property Type** | `property_type` | `property_type` |
| 5 | **Rooms/Units** | `bedrooms` | `bedrooms` (or `rooms` if needed) |
| 6 | **Bathrooms** | `bathrooms` | `bathrooms` |
| 7 | **Floor Area (sqft)** | `floor_area` | `sqft` |
| 8 | **Property Status** (Available / Pending / Sold / Under Contract) | `property_status` | *No column* — use default "available" or add column later |
| 9 | **Status** (Draft vs Publish) | `status` | `status` |
| 10 | **Latitude** | `latitude` | `latitude` |
| 11 | **Longitude** | `longitude` | `longitude` |
| 12 | **County** | `county` | `county` |
| 13 | **City** | `city` | `city` |
| 14 | **Zipcode** | `zipcode` | `zip_code` |
| 15 | **State** | `state` | `state` |
| 16 | **Property Description** (rich text) | `description` | `description` |
| 17 | **Repairs & Renovation** (rich text) | `repairs` | `features` (array → text) or `repair_cost` |
| 18 | **SEO Title** | `seo_title` | `seo_title` (add via migration; see `docs/wholesale_deals_seo_columns_migration.sql`) |
| 19 | **SEO Description** | `seo_description` | `seo_description` |
| 20 | **Social Title** | `social_title` | `social_title` |
| 21 | **Social Description** | `social_description` | `social_description` |
| 22 | **Social Image URL** | `social_image_url` | `social_image_url` |
| 23 | **Inspection Report** (file URL + storage key) | `inspection_report_url`, `inspection_report_key` | `inspection_report_url`, `inspection_report_key` |
| 24 | **Property Images** (gallery + featured) | `property_images` table: `image_url`, `image_key`, `sort_order` | `property_photos` table: `photo_url`, `display_order`, `is_featured` |

**Notes:**

- **Title:** Manual derives title from `slug`; on save we update `slug` from title. Scraped: use `slug` if present, else show `full_address` as title; on save update `slug` (and optionally `full_address`/`display_address`).
- **Location:** Google Places can overwrite address parts; both tables have city, state, zip (manual: `zipcode`, scraped: `zip_code`).
- **Status:** In wholesale_deals we use the existing **`status`** column for Draft vs Publish (e.g. `draft`, `active`, `archived`). "Property Status" (available/pending/sold) has no column in wholesale_deals yet.
- **Repairs:** Manual uses `repairs` (text). Scraped: `features` is an array — we can join to text for display and split back to array (or store as single string in one field) on save; `repair_cost` is numeric if we want to show it separately.
- **Images:** Manual uses `property_images` (property_id, image_url, image_key, sort_order). Scraped uses `property_photos` (deal_id, photo_url, display_order, is_featured). Same UI; different table and column names behind.

---

## 2. Edit form field → wholesale_deals / property_photos (detailed)

Same edit UI for manual and scraped. For **scraped** (wholesale_deals), use this mapping.

| Edit form field        | wholesale_deals column(s)     | property_photos | Notes |
|------------------------|------------------------------|-----------------|--------|
| **Property Title**     | `slug` (derive title via slugToTitle) or `full_address` / `display_address` | — | Prefer `slug` if set; else use full_address as display title. Save: update `slug` from title when saving. |
| **Location** (single line) | `full_address` or `display_address` or `address` | — | Google Places can overwrite address parts below. |
| **Address parts** (from Google Places) | `address`, `city`, `state`, `zip_code`, `county`, `latitude`, `longitude` | — | Form uses `zipcode`; DB has `zip_code`. |
| **Price ($)**          | `price`                      | — | |
| **Property Type**      | `property_type`              | — | |
| **Rooms/Units**        | `bedrooms` (or `rooms` if bedrooms empty) | — | |
| **Bathrooms**          | `bathrooms`                  | — | |
| **Floor Area (sqft)**  | `sqft`                       | — | Form label stays "Floor Area (sqft)". |
| **Property Status**    | *(see below)*                | — | **Gap:** `property_status` does not exist on wholesale_deals. Options: (A) Add column, or (B) Hide dropdown for scraped / use default "available". |
| **Status** (draft vs publish) | `status`                 | — | Values: `draft`, `active`, `incomplete`, `archived`. Edit form "Publish" → `active`, "Save Draft" → `draft`. |
| **Description**       | `description`                | — | |
| **Repairs & Renovation** | `features` (ARRAY → join as text for display), optionally `repair_cost` | — | Save: form value → `features` (e.g. split by newlines into array) or single text column if we add one. |
| **Inspection Report**  | `inspection_report_url`, `inspection_report_key` | — | Same as manual; show and edit for scraped too. |
| **Property Images**    | —                            | `deal_id`, `photo_url`, `display_order`, `is_featured` | Load: photo_url→imageUrl, display_order→sort_order, is_featured→isFeatured. Save: update/insert/delete by deal_id. |
| **SEO Title**          | `seo_title`                  | — | After migration: same as manual; seller can edit. |
| **SEO Description**   | `seo_description`           | — | Same as manual. |
| **Social Title**      | `social_title`              | — | Same as manual. |
| **Social Description**| `social_description`        | — | Same as manual. |
| **Social Image URL**  | `social_image_url`          | — | Same as manual. |

**Auth (not edited, but required for fetch/update):**  
- `temp_seller_id` – used to ensure the deal belongs to the logged-in seller (via seller_applications.temp_seller_id).  
- `id` – deal id for routing and for property_photos.deal_id.

---

## 3. wholesale_deals columns: property vs source/metadata

### 3a. Property data (expose in edit form where the form has a field)

Use these for loading and saving the edit form. Only these are written when the seller saves.

| Column | Use in edit form |
|--------|-------------------|
| id | Route / identity; do not edit. |
| address, city, state, zip_code, full_address, display_address | Location. |
| county, latitude, longitude | Location (e.g. from Google Places). |
| price, price_display | Price (form: price). |
| arv, repair_cost | Optional: show in "Repairs" area or separate field if desired. |
| bedrooms, bathrooms, sqft | Map to Rooms, Bathrooms, Floor Area. |
| rooms | Fallback for bedrooms if needed (e.g. commercial). |
| property_type | Property Type dropdown. |
| lot_size, year_built, garage | Optional extras if we add fields later. |
| mls_number, listing_url | Optional. |
| status | Draft vs Publish (draft / active). |
| description | Description rich text. |
| features | Repairs & Renovation (array → text for form). |
| agent_name, agent_phone, agent_email, company_name | Optional "Agent" section if we add it. |
| is_multi_unit, unit_count, unit_addresses | Optional. |
| cap_rate, noi, occupancy, zoning, tenants, lease_terms, parking | Optional commercial. |
| down_payment, financing_terms, monthly_payment | Optional financing. |
| building_count, property_category | Optional. |
| slug | Title derivation and save from form title. |
| inspection_report_url, inspection_report_key | Inspection report tab. |
| temp_seller_id | Auth only; never edited in form. |

**Missing for parity with manual:**  
- `property_status` (available / pending / sold / under_contract). Recommend adding to wholesale_deals or hiding that dropdown for scraped.

---

### 3b. Source / metadata (do NOT show or edit in seller edit form)

Do not display these in the edit UI and do not overwrite them on save (except where we explicitly choose to, e.g. updated_at).

| Column(s) | Reason |
|-----------|--------|
| ai_confidence, extraction_date | AI extraction metadata. |
| created_at, updated_at | System timestamps (updated_at can be set on save). |
| original_deal_id, is_duplicate, duplicate_detected_at, update_count | Duplicate handling. |
| address_verified_chatgpt, address_chatgpt_formatted, address_chatgpt_verified_at, address_chatgpt_response | ChatGPT address verification. |
| address_verified_google, address_google_place_id, address_google_formatted, address_google_lat, address_google_lng, address_google_verified_at, address_google_response | Google verification; keep as-is or leave to backend. |
| data_source_brokerage, mls_source_name, mls_last_updated_at | Source / MLS metadata. |
| creation_method, approved_by_user_id, approved_at | Workflow / approval. |
| source_type, source_id | Source (email, SMS, URL). |
| source, is_incomplete | Source and completeness flag. |
| valuation_date, rentcast_data, rentcast_fetched_at | External data. |
| All investment/tax/owner/rent columns (e.g. gross_yield, tax_assessments, last_sale_*, owner_*, rent_estimate, etc.) | Rich data; can be shown read-only later, but not in the current “property that can be updated” edit form. |

---

## 4. property_photos: what to read/write in edit

- **Load:** `photo_url` → form image URL, `display_order` → sort order, `is_featured` → featured flag.  
- **Save:** For the deal’s images, update/insert/delete rows with `deal_id = wholesale_deals.id`; only touch `photo_url`, `display_order`, `is_featured` (and optionally `photo_type` if we keep it).  
- **Do not expose or edit:** ai_description, vision_labels, vision_confidence, image_category, image_quality_score, original_url, optimized_url, is_optimized, created_at.

---

## 5. Summary for implementation

1. **Listing:** Show Edit for both manual and scraped; link to same `/properties/edit/[id]`.
2. **Edit page:** Detect source (manual vs scraped) by fetching `properties` by id + seller_id first; if not found, fetch `wholesale_deals` by id + temp_seller_id (from seller_applications).
3. **Load scraped:** Map wholesale_deals + property_photos into the same form shape as manual using the table in §1 (slug/full_address → title, zip_code → zipcode, sqft → floor_area, features → repairs, property_photos → images).
4. **Save scraped:** Update only the property columns listed in §2a; update property_photos by deal_id (photo_url, display_order, is_featured). Do not overwrite source/metadata columns in §2b.
5. **property_status:** Either add `property_status` to wholesale_deals or hide the Property Status dropdown for scraped and default to "available" where needed.
6. **SEO/Social:** Leave empty or hide for scraped unless we add those columns later.
