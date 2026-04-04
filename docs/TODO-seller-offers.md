# Seller Offers — Implementation Plan

## Database (Supabase) — Do This First Manually

Create `offers` table in Supabase dashboard:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | gen_random_uuid() |
| conversation_id | uuid | FK → conversations.id |
| property_id | text | |
| buyer_uuid | uuid | FK → users.id |
| seller_id | uuid | FK → seller_applications.id |
| amount | numeric | Offer price in dollars |
| closing_timeline | text | "30 days" / "45 days" / "60 days" / "As-is" |
| financing_type | text | "Cash" / "Loan" |
| notes | text | nullable |
| status | text | pending / accepted / rejected / countered / expired |
| parent_offer_id | uuid | nullable — links counter-offer back to original |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

---

## Implementation Order

### 1. Backend — `/api/buyer/offers` (Buyer Portal)
- `POST` — create offer (validates buyer owns the conversation)
- `GET` — fetch offer(s) for a conversation
- `PATCH` — buyer accepts a counter-offer

### 2. Backend — `/api/seller/offers` (Seller Portal)
- `GET` — fetch offer for a conversation
- `PATCH action=accept` — update status → accepted, email buyer
- `PATCH action=reject` — update status → rejected, email buyer
- `PATCH action=counter` — insert new offer row with parent_offer_id, update original to countered, email buyer

### 3. Buyer — "Make Offer" Entry Points

**A. Deal Detail Page (`/[slug]/page.js` → `PropertyDetail.js`)**
- Add "Make Offer" button in the action bar (alongside Contact Seller / Save)
- Clicking it checks if user is logged in (show RegistrationModal if not)
- If no conversation exists with this seller, create one first via `/api/buyer/chat`
- Then open the Offer Modal

**B. Buyer Inbox — Right Panel (`ChatWindow.js`)**
- Already has a "Make Offer" button in the deal overview right panel
- Wire it to open the same Offer Modal

### 4. Buyer — Offer Modal (new component: `MakeOfferModal.js`)
Fields:
- Offer amount ($ number input)
- Closing timeline (dropdown: 30 days / 45 days / 60 days / As-is)
- Financing type (dropdown: Cash / Loan)
- Notes to seller (textarea, optional)

On submit:
- POST to `/api/buyer/offers` → creates offer record
- Email notification sent to seller via Resend
- Modal closes with success state

### 5. Seller — Right Panel — Wire Up Existing UI (`messages/page.js`)
- On conversation select, fetch offer via `/api/seller/offers?conversation_id=...`
- Show real offer data: amount, terms, status badge
- **Accept** → confirmation modal → PATCH action=accept → show accepted state
- **Counter** → replace right panel with counter form
- **Reject** → confirmation modal → PATCH action=reject → show rejected state

### 6. Seller — Counter Offer Form (replaces right panel)
Fields:
- Counter price ($ input)
- Closing timeline (dropdown)
- Financing type (dropdown: Cash / Loan)
- Notes to buyer (textarea, optional)
- Cancel / Send Counter buttons

On send → PATCH action=counter → email buyer → show countered state in right panel

### 7. Seller — Confirmation Modals

**Accept modal:**
- "Accept this offer?" — shows amount + buyer name
- Warning: "This action cannot be undone"
- Note: "Both parties will be notified and next steps will begin automatically"

**Reject modal:**
- "Reject this offer?" — shows "This will decline [buyer]'s offer of $X"
- Note: "You can still continue the conversation after rejecting"
- Note: "Both parties will be notified"

### 8. Post-Action States (Right Panel)

- **Accepted**: Green badge "Offer accepted · [date]" + note to coordinate on contract signing
- **Rejected**: Red badge "Offer Rejected"
- **Countered**: Shows counter offer amount + "Counter sent" badge

### 9. Buyer — Counter-Offer Response (Buyer Inbox)
- When seller counters, buyer sees the new offer amount in inbox right panel
- "Accept Counter" button → PATCH to `/api/buyer/offers` → accepted

### 10. Offer Cards in Chat (Both Portals)
- Offer events shown inline in the chat thread sorted by `created_at`
- Card shows: amount, timeline, financing type, status badge
- Fetched from `offers` table alongside messages

### 11. Email Notifications (Resend — both portals reuse existing setup)
- Buyer submits offer → email seller
- Seller accepts → email buyer
- Seller rejects → email buyer
- Seller counters → email buyer

---

## Entry Points Summary

| Where | Who | Action |
|-------|-----|--------|
| `/[slug]` deal detail page | Buyer | "Make Offer" button in action bar |
| Buyer inbox right panel | Buyer | "Make Offer" button in deal overview |
| Seller messaging right panel | Seller | Accept / Counter / Reject |
| Buyer inbox right panel | Buyer | Accept counter-offer |

---

# Seller Notifications — Implementation Plan

## What Triggers a Notification (Seller Side)

| Event | Notification |
|-------|-------------|
| Buyer sends a message | "New message from [Buyer Name]" |
| Buyer submits an offer | "New offer received from [Buyer Name] — $X" |
| Buyer accepts your counter-offer | "[Buyer Name] accepted your counter-offer" |
| Buyer rejects your counter-offer | "[Buyer Name] declined your counter-offer" |

## Database (Supabase) — Create `notifications` Table

Unified table for both seller and buyer notifications.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | gen_random_uuid() |
| recipient_id | uuid | seller or buyer user id |
| recipient_type | text | "seller" / "buyer" |
| type | text | new_message / new_offer / offer_accepted / offer_rejected / counter_received / counter_accepted |
| title | text | Short heading shown in dropdown |
| body | text | One-line description |
| is_read | boolean | default false |
| related_conversation_id | uuid | nullable — links to conversation |
| related_offer_id | uuid | nullable — links to offer |
| created_at | timestamptz | now() |

## Implementation Order

### 1. Create notification rows at trigger points
- In `/api/buyer/chat` (when buyer sends message) → insert notification for seller
- In `/api/buyer/offers` (when offer submitted) → insert notification for seller
- In `/api/buyer/offers` (when buyer accepts counter) → insert notification for seller
- In `/api/seller/offers` (when seller counters/rejects) → insert notification for buyer (future)

### 2. `/api/seller/notifications` route
- `GET` — fetch all notifications for seller, ordered by `created_at DESC`
- `POST action=mark_read` — mark one notification as read
- `POST action=mark_all_read` — mark all as read

### 3. Bell Icon — Unread Count Badge
- Fetch unread count on page load (poll every 30s like messages)
- Red badge number on bell icon in dashboard header
- Replaces the current static red dot

### 4. Notification Dropdown Panel
- Opens on bell click
- Shows list of notifications: icon + title + body + time ago
- Unread = highlighted background (`#FAFAF8`) + red left border
- Read = plain white
- Click → navigates to relevant conversation/offer + marks as read
- "Mark all as read" button at top right of panel
- Closes on outside click

## UI Only — No Separate Page Needed
Just the dropdown panel off the bell icon. Keep it simple.
