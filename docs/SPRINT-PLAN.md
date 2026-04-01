# Deelmap — Full Sprint Implementation Plan

> All UI references from `/Users/yousafzahid/Downloads/UI 8/`

---

## Overview — What We're Building

| # | Feature | Portals Affected |
|---|---------|-----------------|
| 1 | Marketplace (Buy) page redesign | Buyer portal |
| 2 | Deal Detail (Overview) page redesign | Buyer portal |
| 3 | Make an Offer — full end-to-end flow | Buyer portal + Seller portal + DB |
| 4 | Seller notifications — bell + dropdown | Seller portal + DB |
| 5 | Sell page redesign | Buyer portal |
| 6 | Finance page redesign | Buyer portal |

---

## Database — Do These First in Supabase

### `offers` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| conversation_id | uuid | FK → conversations.id |
| property_id | text | |
| buyer_uuid | uuid | FK → users.id |
| seller_id | uuid | FK → seller_applications.id |
| amount | numeric | Offer price |
| closing_timeline | text | "30 days" / "45 days" / "60 days" / "As-is" |
| financing_type | text | "Cash" / "Loan" |
| earnest_money | numeric | nullable |
| inspection_period | text | nullable — "5 days" / "10 days" / "15 days" / "Waived" |
| notes | text | nullable |
| status | text | pending / accepted / rejected / countered / expired |
| parent_offer_id | uuid | nullable — counter links back to original |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

### `notifications` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| recipient_id | uuid | seller or buyer user id |
| recipient_type | text | "seller" / "buyer" |
| type | text | new_message / new_offer / offer_accepted / offer_rejected / counter_received / counter_accepted / counter_rejected |
| title | text | Short heading |
| body | text | One-line description |
| is_read | boolean | default false |
| related_conversation_id | uuid | nullable |
| related_offer_id | uuid | nullable |
| created_at | timestamptz | now() |

---

## Feature 1 — Marketplace (Buy) Page Redesign

**File:** `deelmap-buyer/app/marketplace/page.js` (or wherever Buy page lives)

**Design:** `Buy Page.png`

### Layout
- Split: left panel (list) + right panel (map), map is sticky full-height
- Left panel scrollable

### Top Section
- Search bar full width: "Search markets, cities, or ZIP codes" with red magnifying glass button
- Filter row: `Property Types ▼` `Price ▼` `Beds/Baths ▼` `All Filters ⚙`
- Heading: "Investment Properties" bold
- Sub: "2,148 opportunities available" muted
- Sort: "Sort: Highest ROI ▼" dropdown right-aligned

### Property Card (left list)
Each card:
- Image left (square ~120px), content right
- ROI badge top-left on image: `+84% ROI` — red pill `bg-[#D03839] text-white text-[11px] font-bold`
- Tag top-right on image: "Quick Sale" (amber) / "New Deal" (green) — small pill
- Share + Heart icons (top-right of card, outside image)
- Location: pin icon + city, state — `text-[12px] text-[#737370]`
- Title: property name bold `text-[16px]`
- Specs: sqft | beds | baths — muted small
- Price: `text-[22px] font-bold text-[#1A1816]` + ARV muted right-aligned
- Spread: `+$X spread potential` in green small text
- "Invest Now" button: full-width, dark/black bg, white text

### Map (right panel)
- Google Maps embed, full height sticky
- Red map pins for each property
- On pin hover/click — highlight matching card

---

## Feature 2 — Deal Detail (Overview) Page Redesign

**File:** `deelmap-buyer/app/[slug]/page.js` (or `PropertyDetail.js`)

**Design:** `Overview.png`

### Layout
Two-column: main content left (wide), sticky right sidebar

### Top
- "← Back to listings" link
- Share + Favourite buttons top-right

### Hero Images
- Mosaic grid: 1 large image left + 2 stacked right (total 3 images shown)
- "View all photos" button bottom-right overlay

### Right Sidebar (sticky)
- Price: `$165,000` large bold
- ARV: `ARV $315k` muted
- "Message Seller" button — dark/black, full width
- "Make Offer" button — red `#D03839`, full width (NEW — opens offer wizard)
- Map embed showing property pin

### Property Info
- Title: "4BR Suburban Brick Estate" + "Active Deal" status badge (green)
- Quick stats bar: Purchase price / Down payment / Cashflow/mo
- Specs grid: Single Family | sqft | beds | baths | Finished Basement | Car Garage
- "Investment Opportunity" section — bullet points
- AI/Comments section — collapsible

### Similar Properties
- Horizontal scroll row of cards at bottom

---

## Feature 3 — Make an Offer (End-to-End)

### 3A. Offer Wizard — New Component
**File:** `deelmap-buyer/components/MakeOfferModal.js`

**Design:** `Cash Offer Page-2.png` through `Cash Offer Page-5.png` (same flow for Loan)

The wizard is a **modal overlay** (centered card, white, rounded, `max-w-[640px]`).

#### Step Progress Bar
Three steps connected by lines:
- Inactive: gray circle number + gray label
- Active: red filled circle + black label
- Complete: red filled circle + black label
- Line between steps turns red when step is completed

---

#### Step 1 — Offer (`Make Offer Page-1.png`, `Cash Offer Page-2.png`)

**Title:** "Make an offer"
**Subtitle:** "Submit your offer for your property"

**Property card** (inside modal):
- Thumbnail image left (80px square, rounded)
- Property name bold
- "Listed at $X" in red below name
- Border around card `border border-[#E8E8E4] rounded`

**Fields:**
1. **Offer Price** (required `*`)
   - Text input, prefix `$`, placeholder `$135,000`
2. **Closing Timeline** (dropdown)
   - Options: 30 days / 45 days / 60 days / As-is
3. **Financial Type** (radio — two full-width boxes)
   - Cash | Loan
   - Selected box: red border `border-[#D03839]`, red radio dot
   - Unselected: gray border

**Button:** "Continue" — full width, black bg, white text

---

#### Step 2 — Details (`Cash Offer Page-3.png`, `Loan Offer Page-3.png`)

**Title:** "Add deal details"
**Subtitle:** "Provide additional terms to strengthen your offer"

**Fields:**
1. **Earnest money** (required `*`)
   - Text input, prefix `$`, placeholder `$2,500`
2. **Inspection period** (dropdown)
   - Options: 5 days / 10 days / 15 days / Waived
3. **Additional notes** (textarea, optional)
   - Large textarea, placeholder text

**Buttons:** "← Back" (ghost) + "Continue" (black, wider)

> Note: Step 2 is identical for Cash and Loan

---

#### Step 3 — Review (`Cash Offer Page-4.png`, `Loan Offer Page-4.png`)

**Title:** "Review your offer"
**Subtitle:** "Confirm the details before submitting"

**Summary table** (rows with left label muted, right value bold):
| Label | Value |
|-------|-------|
| Property | [property name + city] |
| Offer price | `$135,000` in **red** |
| Closing timeline | 30 days |
| Financing | Cash / Loan |
| Earnest money | $2,500 |
| Inspection | 10 days |
| Notes | [notes text] |

**Warning banner** (amber bg `bg-[#FEF9EC]`, amber border, alert icon):
> "Once submitted, your offer will be visible to the seller immediately."

**Buttons:** "← Back" (ghost) + "Submit Offer" (black, wider)

---

#### Step 4 — Success (`Cash Offer Page-5.png`)

**Full replacement screen** (no step bar):
- Green checkmark circle icon (light green bg, dark green check)
- "Offer submitted successfully" bold heading
- "The seller will review your offer and respond soon. You'll be notified when there's an update." — muted body
- Two buttons side by side:
  - "← Browse deals" — ghost border button
  - "View Messages" — red `#D03839` bg, white text

---

### 3B. Entry Points

#### Entry Point A — Deal Detail Page
- "Make Offer" button in right sidebar
- If not logged in → show RegistrationModal
- If logged in but no conversation → create conversation via `/api/buyer/chat` first
- Then open `MakeOfferModal` with property data pre-filled

#### Entry Point B — Buyer Inbox Right Panel
- "Make Offer" button already exists in ChatWindow.js deal overview right panel
- Wire it to open same `MakeOfferModal`
- conversation_id already available from selected conversation

---

### 3C. API — Buyer Portal

**File:** `deelmap-buyer/app/api/buyer/offers/route.js`

```
POST /api/buyer/offers
Body: { conversation_id, property_id, buyer_uuid, seller_id, amount, closing_timeline,
        financing_type, earnest_money, inspection_period, notes }
- Validates buyer owns the conversation
- Inserts into offers table (status = pending)
- Inserts notification row for seller (type = new_offer)
- Sends email to seller via Resend
- Returns: created offer

GET /api/buyer/offers?conversation_id=...
- Returns offer(s) for the conversation

PATCH /api/buyer/offers
Body: { offer_id, action: "accept_counter" }
- Sets offer status = accepted
- Inserts notification for seller (type = counter_accepted)
- Sends email to seller
```

---

### 3D. API — Seller Portal

**File:** `sellerportaldeelmap/app/api/seller/offers/route.js`

```
GET /api/seller/offers?conversation_id=...
- Returns latest offer for the conversation

PATCH /api/seller/offers
Body: { offer_id, action: "accept" | "reject" | "counter", counter_data?: {...} }

action=accept:
- Sets status = accepted
- Sends email to buyer

action=reject:
- Sets status = rejected
- Sends email to buyer

action=counter:
- Sets original offer status = countered
- Inserts NEW offer row with parent_offer_id = original id
- Sends email to buyer
```

---

### 3E. Seller Messages Right Panel — Wire Up

**File:** `sellerportaldeelmap/app/messages/page.js`

**Design:** `Seller's Message Page.png` through `Seller's Reject Message Page-3.png`

#### Right Panel — "Offer Details" section
When a conversation is selected, fetch offer via `GET /api/seller/offers?conversation_id=...`

**Right panel layout** (when offer exists):
- Header: "Offer Details", "Buyer & Offer" subtitle
- Buyer info: avatar initials + name + email
- **OFFER DETAILS section:**
  - Amount: `$135,000` large bold
  - Status badge: "Negotiating" (amber) / "Accepted" (green) / "Rejected" (red) / "Counter Offer" (blue/gray)
  - Terms row: Closing timeline value | Financing type value
  - Waived: inspection status
  - Date
- **BUYER CREDIBILITY section:**
  - Count + percentage (from user profile)
- **Action buttons** (3 stacked, shown when status = pending/negotiating):
  - "Accept Offer" — dark/black full-width
  - "Counter Offer" — ghost border full-width
  - "Reject Offer" — ghost border full-width

#### Accept Modal (`Seller's Message Page-2.png`)
- Overlay modal, green checkmark icon
- Title: "Accept this offer?"
- Body: "You're about to accept $[amount] from [Buyer Name]. This action cannot be undone."
- Warning row (amber): "Both parties will be notified and next steps will begin automatically"
- Buttons: Cancel (ghost) + "Accept Offer" (red `#D03839`)

#### Counter Offer — Right Panel Replaced (`Seller's Message CO Page.png`)
- Panel title: "Send counter offer"
- Fields:
  1. Counter price ($ input, pre-filled with original amount)
  2. Closing Timeline (dropdown, same options)
  3. Financing type (Cash | Loan radio boxes)
  4. Notes to Buyer (textarea, placeholder: "e.g. Price reflects recent comparable...")
- Warning (amber): "The buyer will be notified immediately and can accept, counter, or decline your offer"
- "Send counter" button — red `#D03839`, full width

#### After Counter (`Seller's Message CO Page -2.png`)
- Right panel shows counter offer amount + "Counter Offer" badge
- Chat inline: counter offer card shown in thread
- Action buttons remain (seller can still act on original)

#### Reject Modal (`Seller's Reject Message Page-2.png`)
- Title: "Reject this offer?"
- Body: "This action will decline the buyer's offer of $[amount] from [Buyer Name]. You can still continue the conversation after rejecting."
- Warning (amber): "Both parties will be notified and next steps will begin automatically"
- Buttons: Cancel + "Reject Offer" (red)

#### After Rejection (`Seller's Reject Message Page-3.png`)
- Right panel: "Offer Rejected" status badge in red
- Chat inline: "Offer Rejected" shown in thread
- Header badge: "Offer Rejected" red pill at top of chat

---

### 3F. Email Notifications (Resend)

| Event | Recipient | Subject |
|-------|-----------|---------|
| Buyer submits offer | Seller | "New offer received from [Buyer] — $X" |
| Seller accepts | Buyer | "Your offer was accepted!" |
| Seller rejects | Buyer | "Update on your offer for [Property]" |
| Seller counters | Buyer | "[Seller] sent a counter offer of $X" |
| Buyer accepts counter | Seller | "[Buyer] accepted your counter offer" |

---

## Feature 4 — Notifications (Both Portals)

Shared `notifications` table with `recipient_type = "seller" | "buyer"`. Both portals get the same bell icon + dropdown UI.

### 4A. API Routes

**Seller Portal:** `sellerportaldeelmap/app/api/seller/notifications/route.js`
```
GET /api/seller/notifications?seller_id=...
- Fetches where recipient_id = seller_id AND recipient_type = "seller"
- Returns ordered by created_at DESC

POST /api/seller/notifications
Body: { action: "mark_read", notification_id }
Body: { action: "mark_all_read", seller_id }
```

**Buyer Portal:** `deelmap-buyer/app/api/buyer/notifications/route.js`
```
GET /api/buyer/notifications?buyer_id=...
- Fetches where recipient_id = buyer_id AND recipient_type = "buyer"
- Returns ordered by created_at DESC

POST /api/buyer/notifications
Body: { action: "mark_read", notification_id }
Body: { action: "mark_all_read", buyer_id }
```

### 4B. Bell Icon — Both Headers
- Seller portal header + Buyer portal navbar
- Fetch unread count on mount + poll every 30s
- Red badge number on bell icon: `bg-[#D03839] text-white text-[10px] rounded-full`
- Replaces any existing static notification indicator

### 4C. Notification Dropdown (same design, both portals)
Opens on bell click — anchored to bell icon:
- Header: "Notifications" + "Mark all as read" button (right)
- List of notifications (scroll if many):
  - Icon left (message icon / offer icon / check icon based on `type`)
  - Title bold `text-[13px]`
  - Body `text-[12px] text-[#737370]`
  - Time ago `text-[11px] text-[#737370]` right-aligned
  - Unread: `bg-[#FAFAF8]` bg + `border-l-2 border-[#D03839]` left accent
  - Read: plain white bg
- Click → navigate to relevant conversation + mark notification as read
- Closes on outside click

### 4D. Notification Insert Points

**Seller receives notifications (recipient_type = "seller"):**
| Trigger | type | title example |
|---------|------|---------------|
| Buyer sends a message | `new_message` | "New message from [Buyer]" |
| Buyer submits offer | `new_offer` | "New offer from [Buyer] — $X" |
| Buyer accepts counter | `counter_accepted` | "[Buyer] accepted your counter offer" |

**Buyer receives notifications (recipient_type = "buyer"):**
| Trigger | type | title example |
|---------|------|---------------|
| Seller accepts offer | `offer_accepted` | "Your offer was accepted!" |
| Seller rejects offer | `offer_rejected` | "Your offer was declined" |
| Seller sends counter | `counter_received` | "[Seller] sent a counter offer of $X" |

**Where to insert:**
- `new_message` — in `/api/buyer/chat` (or wherever buyer sends message)
- `new_offer` — in `/api/buyer/offers` POST
- `counter_accepted` — in `/api/buyer/offers` PATCH action=accept_counter
- `offer_accepted` — in `/api/seller/offers` PATCH action=accept
- `offer_rejected` — in `/api/seller/offers` PATCH action=reject
- `counter_received` — in `/api/seller/offers` PATCH action=counter

---

## Feature 5 — Sell Page Redesign (Buyer Portal)

**File:** `deelmap-buyer/app/sell/page.js`

**Design:** `Sell Page.png`

### Sections (top to bottom)

#### Hero
- Left: "Sell your property to **serious investors**" — "serious investors" in red `#D03839`
- Sub: tagline about fast cash offers
- Right: Login/signup box (card):
  - "Log in to continue" heading
  - Email input + "Sign In" red button
  - "Sign Up" link below

#### How It Works
- "Sell your property in a few simple steps"
- 3–4 numbered steps with icons + descriptions (horizontal on desktop)

#### Value Props
- "Built to help you close deals faster"
- 4 feature cards in a grid with icons

#### Closed Deals Nearby
- Horizontal scroll of closed deal property cards (pulled from DB or static)
- Each card: image + address + sold price

#### FAQ Accordion
- "Everything you need to know"
- Expandable rows with common questions

#### Testimonials
- "What our sellers say about us"
- Cards with quote + seller name + avatar + star rating

#### CTA Banner
- "Find and close better real estate deals"
- "Start Finding Deals →" red button

#### Footer

---

## Feature 6 — Finance Page Redesign (Buyer Portal)

**File:** `deelmap-buyer/app/financing/page.js`

**Design:** `Finance Page.png`

### Sections (top to bottom)

#### Hero
- "Reliable financing for **every deal**" — "every deal" in red `#D03839`
- Subtitle: "Access flexible financing options tailored for real estate investors, with fast approvals, transparent terms, and support at every step."

#### Financing Application Form
Full-width centered card. Fields:

**Personal Information:**
- First name* + Last name* (2-col)
- Email address* + Phone number* (2-col)

**Property Information:**
- Type of Property* (dropdown)
- Transaction Type* (dropdown)
- Property Address* (full width)

**Loan Information:**
- Loan amount required* ($ input)
- Your credit score* (dropdown: range buckets)

**Additional:**
- Comments or questions (textarea)

**Submit:** "Submit Request →" full-width red button

#### Bottom CTA
- "Find and close better real estate deals" dark bg section
- "Start Finding Deals →" red button

#### Footer

> Note: Existing form logic (`handleSubmit`, Supabase insert) stays — only the visual layout changes to match design.

---

## Implementation Order (Recommended)

```
Phase 1 — Database (manual in Supabase)
  1. Create `offers` table
  2. Create `notifications` table

Phase 2 — Backend APIs
  3. /api/buyer/offers (POST, GET, PATCH)
  4. /api/seller/offers (GET, PATCH)
  5. /api/seller/notifications (GET, POST)
  6. Notification inserts in /api/buyer/chat

Phase 3 — Offer Wizard (Buyer)
  7. MakeOfferModal.js — 3-step wizard
  8. Wire into Deal Detail page sidebar button
  9. Wire into Buyer Inbox right panel button
  10. Success screen

Phase 4 — Seller Messages
  11. Fetch + display real offer in right panel
  12. Accept modal + action
  13. Counter form (right panel replacement) + action
  14. Reject modal + action
  15. Post-action states (badges in chat + right panel)

Phase 5 — Notifications
  16. Seller portal bell badge + dropdown
  17. Buyer portal bell badge + dropdown
  18. Insert notification rows at all trigger points
  19. Mark read / mark all read (both portals)

Phase 6 — Page Redesigns
  19. Marketplace (Buy) page
  20. Deal Detail (Overview) page
  21. Sell page
  22. Finance page
```

---

## Component File Map

| Component / File | Location | Purpose |
|-----------------|----------|---------|
| `MakeOfferModal.js` | `deelmap-buyer/components/` | 3-step offer wizard |
| `OfferCard.js` | `deelmap-buyer/components/` | Inline offer card in chat thread |
| `NotificationDropdown.js` | `sellerportaldeelmap/components/` | Bell dropdown (seller) |
| `NotificationDropdown.js` | `deelmap-buyer/components/` | Bell dropdown (buyer) |
| `/api/buyer/notifications/route.js` | `deelmap-buyer/app/api/` | Buyer notifications CRUD |
| `CounterOfferPanel.js` | `sellerportaldeelmap/components/` | Counter offer right panel |
| `AcceptOfferModal.js` | `sellerportaldeelmap/components/` | Confirm accept modal |
| `RejectOfferModal.js` | `sellerportaldeelmap/components/` | Confirm reject modal |
| `/api/buyer/offers/route.js` | `deelmap-buyer/app/api/` | Buyer offer CRUD |
| `/api/seller/offers/route.js` | `sellerportaldeelmap/app/api/` | Seller offer actions |
| `/api/seller/notifications/route.js` | `sellerportaldeelmap/app/api/` | Notifications CRUD |
