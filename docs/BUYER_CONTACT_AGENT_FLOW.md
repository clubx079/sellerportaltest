# Buyer “Contact Agent” flow – current behavior and gap

## What happens when the buyer clicks Contact Agent (Deelmap buyer website)

1. **Property detail** (`deelmap-buyer/components/property/PropertyDetail.js`):
   - “Send Message” links to:
   - **If logged in and property has a seller:**  
     `/buyer/inbox?seller_id=${property.temp_seller_id}&deal_id=${property.id}`
   - **If logged in but no seller:**  
     `/buyer/inbox`
   - **If not logged in:**  
     `/login`

2. **Buyer inbox** (`deelmap-buyer/app/buyer/inbox/page.js`):
   - Fetches conversations via:  
     `GET /api/buyer/chat?action=get_conversations`  
     (with `Authorization: Bearer <user.id>`).
   - Uses **only** the `conversation` URL param to auto-select a conversation (by conversation id).
   - **Does not read or use `seller_id` or `deal_id`** from the URL.

3. **Buyer chat API** (`deelmap-buyer/app/api/buyer/chat/route.js`):
   - **get_conversations:**  
     - Loads `financing_requests` for the current user (by `user_id` UUID).
     - Loads `conversations` where `financing_request_id` is in those requests.
     - Enriches with `lenders` and `financing_requests`.
   - So it **only returns lender conversations** (tied to financing requests).
   - There is **no** logic for:
     - `seller_id` or `deal_id` query params, or
     - Creating/finding a **seller–buyer** conversation.

So when a buyer clicks “Contact Agent”:

- They land on `/buyer/inbox?seller_id=...&deal_id=...`.
- The inbox still only shows **lender** conversations (from `financing_requests`).
- **No seller–buyer conversation is created or opened**; `seller_id` and `deal_id` are ignored.

---

## Why the seller dashboard errors (e.g. “buyer_uuid does not exist”)

The seller chat API was written to assume a **seller–buyer** model:

- `conversations.seller_id` (seller)
- `conversations.buyer_uuid` (buyer)

The current **marketplace DB** `conversations` table (used by the buyer app) is built for **lender** flows:

- `user_id` (buyer, numeric/hashed)
- `lender_id`
- `financing_request_id`

So:

- **No** `seller_id` or `buyer_uuid` (or equivalent) columns exist yet.
- Queries/inserts that use those columns fail (e.g. “column conversations.buyer_uuid does not exist”, “Could not find the 'buyer_uuid' column of 'conversations' in the schema cache”).

---

## Summary

| Side        | Contact Agent / messaging behavior |
|------------|------------------------------------|
| **Buyer**  | Link goes to inbox with `seller_id` and `deal_id`, but inbox and buyer chat API **only** handle lender conversations (financing_requests). Seller params are unused; no seller–buyer thread is created or shown. |
| **Seller** | Seller chat API expects `seller_id` and `buyer_uuid` on `conversations`. Those columns don’t exist in the current schema, so list/create conversation and related calls fail. |

So today, **buyers are not actually communicating with sellers** via Contact Agent: the URL is set up for it, but the backend and inbox never use it, and the DB has no seller–buyer conversation model yet.

---

## What’s needed to make buyer ↔ seller messaging work

1. **Schema (marketplace DB, `conversations` table)**  
   Add (or reuse) columns so seller–buyer threads are first-class, e.g.:
   - `seller_id` (uuid) – e.g. seller application or temp_seller id.
   - Buyer link: either `buyer_uuid` (uuid, from `users.id`) or keep using `user_id` (numeric) and add a way to map buyer UUID → that id for seller–buyer rows.

2. **Buyer chat API**  
   - In **get_conversations**: if `seller_id` and `deal_id` (or `buyer_id`) are present, find or create a **seller–buyer** conversation (using the new columns) and return it (and optionally set `openConversationId`).
   - Allow **get_messages** / **send_message** / **mark_as_read** for these conversations (authorize by buyer user and conversation’s seller_id/buyer link).

3. **Buyer inbox**  
   - Read `seller_id` and `deal_id` from the URL.
   - Call the buyer chat API with those params so it can return/create the seller conversation and auto-open it.

4. **Seller chat API**  
   - Keep using `seller_id` (and buyer id column) once they exist; no change to the intended behavior, only to the schema.

After the schema is in place and the buyer API + inbox use `seller_id`/`deal_id`, Contact Agent will create/open the same conversation the seller sees in their dashboard.
