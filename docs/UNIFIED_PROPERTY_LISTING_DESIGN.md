# Unified Property Listing: Two Tables, One Shape

You have two sources of listings:

- **`properties`** – manually added by sellers (seller dashboard). Columns: `id`, `seller_id`, `address`, `slug`, `price`, `bedrooms`, `bathrooms`, `floor_area`, `property_type`, `property_status`, `status`, `property_images`, etc.
- **`wholesale_deals`** – scraped/imported. Columns: `id`, `temp_seller_id`, `full_address`, `address`, `city`, `state`, `zip_code`, `price`, `bedrooms`, `bathrooms`, `sqft`, `status`, `property_photos`, etc.

Both the **seller dashboard** (my listings, edit, delete, analytics) and the **buyer website** (marketplace, saved, detail page) need to work with “properties” without duplicating column logic and special cases everywhere.

---

## Recommended approach: **Unified API + canonical shape**

Keep both tables as they are, but introduce:

1. **One canonical “listing” shape** that both apps use in the UI.
2. **One place that does the merge and mapping** – a shared API that reads from both tables and returns an array of items in the canonical shape.

That way:

- Seller dashboard and buyer website **only** deal with the canonical shape (same field names, same structure).
- All “this column is in table A, that column is in table B” logic lives in **one** layer (the API or a shared normalizer used by that API).
- You can still add filters (e.g. by `seller_id` for seller, by `status`/visibility for buyer) in that same layer.

---

## 1. Canonical shape (one type for both apps)

Define a single structure that both tables are mapped into, e.g.:

```js
// Canonical listing – used in both seller dashboard and buyer website
{
  id: string | number,           // unique id (may prefix by source if needed, e.g. "manual-xxx" / "scraped-xxx")
  source: 'manual' | 'scraped', // which table it came from
  // Display
  address: string,              // primary display address (from address, full_address, or built)
  full_address: string,         // full line for detail/map
  city: string, state: string, zip_code: string,
  price: number,
  bedrooms: number, bathrooms: number,
  floor_area_sqft: number,      // from floor_area (manual) or sqft (scraped)
  property_type: string,
  status: string,               // active, archived, draft, etc.
  property_status: string,      // available, sold, etc. (manual); scraped may use status only
  // Optional
  slug: string | null,
  description: string | null,
  year_built: number | null,
  gross_yield: number | null,
  cap_rate: number | null,
  cash_on_cash: number | null,
  lat: number | null, lng: number | null,
  created_at: string,
  updated_at: string | null,
  // Relations
  images: Array<{ id, url, sort_order, is_featured? }>,  // from property_images or property_photos
  // Ownership (for seller dashboard only)
  seller_id: string | null,
  temp_seller_id: string | null,
}
```

- **Seller dashboard:** Uses `source`, `seller_id`, `temp_seller_id` for edit/delete/analytics (e.g. edit goes to `/properties/edit/:id` and API knows to hit `properties` vs `wholesale_deals` by `source` or id convention).
- **Buyer website:** Uses `id`, `address`, `price`, `images`, etc. for cards, map, and detail; can use `source` only if you need different behavior per source (e.g. different detail URL).

---

## 2. Where to put the “one place” that merges and maps

Two concrete options.

### Option A: Unified API in the buyer/marketplace app (recommended)

Add a **single API** that both apps can call:

- **Seller dashboard** (same DB or cross-DB):  
  `GET /api/deals?seller_id=xxx` or `GET /api/listings?seller_id=xxx`  
  → returns only that seller’s listings (from `properties` + `wholesale_deals`), normalized to the canonical shape.
- **Buyer website:**  
  `GET /api/deals` (or `?status=active` etc.)  
  → returns all public listings from both tables, same canonical shape.

Implementation:

- One route (e.g. `deelmap-buyer/app/api/deals/route.js` or a shared service) that:
  1. Fetches from `properties` (with optional `seller_id`) and from `wholesale_deals` (with optional `temp_seller_id` or public status).
  2. Maps each row to the canonical shape (same mapper for both tables).
  3. Merges, sorts, filters (e.g. by status), and returns JSON.

Then:

- **Seller dashboard** calls this API (or a mirror in its own backend that uses the same mapping logic) instead of doing two Supabase calls and merge in the client.
- **Buyer website** replaces direct `wholesale_deals` usage in `useProperties` (and saved-properties, etc.) with a call to this API.

Result: both apps only ever see the canonical shape; all column/table differences stay in the API.

### Option B: Shared normalizer in each app

If you prefer not to add a new API (or to keep Supabase calls in each app):

- Create a **shared module** (or copy the same functions into both repos) that:
  - Takes a row from `properties` → returns canonical shape.
  - Takes a row from `wholesale_deals` → returns canonical shape.
- **Seller dashboard:** Keeps current two fetches (properties + wholesale_deals), then runs both lists through these normalizers and merges.
- **Buyer website:** Adds a fetch from `properties` (public ones) in addition to `wholesale_deals`, runs both through the same normalizers, merges, and uses that in `useProperties` (and saved, detail, etc.).

So the “one place” is the shared normalizer; the “merge” still happens in each app, but the **shape** and **column mapping** are defined once.

---

## 3. Suggested next steps

1. **Define the canonical shape** in one place (TypeScript type or JSDoc + a small `normalizeManual(row)` / `normalizeScraped(row)` that returns that shape).
2. **Implement Option A (unified API):**
   - Add e.g. `GET /api/deals` (and optionally `?seller_id=...`) in the app that has access to both tables (marketplace DB).
   - In that route, query both `properties` and `wholesale_deals`, map each to the canonical shape, merge, filter, sort, return.
   - Update **seller dashboard** to call this API for the listing page instead of two Supabase calls + client-side merge.
   - Update **buyer** `useProperties` (and any other direct `wholesale_deals` / `properties` usage) to call this API and use the canonical shape only.
3. **Use `source` and `id`** in the UI: e.g. edit link uses `source` to choose `/properties/edit/[id]` and the edit page/API uses `source` to decide whether to update `properties` or `wholesale_deals` (you already do this in the seller dashboard; keep that pattern with the canonical shape).
4. **Favorites / saved:** Ensure `property_id` (or equivalent) in `user_favorites` can refer to either table (e.g. by storing `id` + `source`, or a single composite id). The unified API can return that same id so the buyer app doesn’t need to care which table it came from.

---

## 4. Summary

| Current | After |
|--------|--------|
| Seller: two Supabase calls + merge + normalizing in page | Seller: one API call (or one normalizer used for two fetches) → canonical list |
| Buyer: only `wholesale_deals`, different column names | Buyer: one API call → same canonical list (manual + scraped) |
| Two tables, two column sets, logic scattered | Two tables, one canonical shape, logic in one layer (API or shared normalizer) |

This keeps your two tables and their different columns/functionality, but makes the listing experience “one list, one shape” in both the seller dashboard and the buyer website, with a single place to refine and maintain the mapping.
