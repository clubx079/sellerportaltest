# Seller Portal — Full Audit & Action Tracker

**Date:** 2026-05-26
**Auditors:** 5 parallel Claude Code agents (Dashboard, Properties, Communications, Money, Account)
**Total findings:** 57

## Status Legend
- `[ ]` — Pending
- `[~]` — In progress
- `[x]` — Done (commit hash linked)
- `[!]` — Skipped / declined / deferred
- `[?]` — Needs discussion

---

## 🚨 Critical — Security & Show-stoppers

### C1. Passwords stored in plaintext
- **Severity:** 🚨 Security
- **File:** `app/api/auth/reset-password/route.js:55` + login flow
- **Problem:** Reset endpoint writes `password: String(newPassword)` directly to DB. No hashing.
- **Risk:** Database breach = every user's password compromised + cross-site credential reuse.
- **Fix:** bcrypt-hash before write; re-hash and compare on login. ~1 hour of work.
- **Status:** `[!]` Deferred per user — will address later
- **Decision date:** 2026-05-26

### C2. Accepting an offer doesn't create a contract
- **File:** `app/messages/page.js:965-971`
- **Problem:** Offer status updates to `accepted` but seller has no clear next step. Right panel just says "Coordinate with the buyer."
- **Fix:** On accept, INSERT a `contract_drafts` row pre-filled with `buyer_id`, `property_id`, `offer_price`; surface "Create Contract" CTA → `/contracts/new?from_offer=…`
- **Status:** `[!]` Deferred (Critical section)

### C3. Preview overlay blocks all clicks
- **File:** `app/properties/preview/[id]/page.js:338-339`
- **Problem:** A `z-[45]` div catches every click and shows a modal — sellers can't actually test the preview.
- **Fix:** Make banner passive (top strip only). Already partially fixed in commit `2966029` (trimmed copy), but the click-blocking behavior remains.
- **Status:** `[!]` Deferred (Critical section)

### C4. Counter-offer form invisible on mobile
- **File:** `app/messages/page.js:768-832`
- **Problem:** Right panel is `hidden xl:flex` — tablets/phones cannot counter at all.
- **Fix:** Convert to bottom-sheet modal triggered by "Counter Offer" button on `<xl` breakpoints.
- **Status:** `[!]` Deferred (Critical section)

### C5. "Promote Listing" CTA goes to /properties
- **File:** `app/dashboard/page.js:279`
- **Problem:** Label promises a feature that doesn't exist; routes to same place as "Edit Listings."
- **Fix:** Either build a promotion feature page or rename/remove the CTA.
- **Status:** `[!]` Deferred (Critical section)

---

## 🔴 High-Priority Bugs (current focus)

### H1. Rejection reasons parsed but never shown per-field ✅
- **File:** `app/properties/edit/[id]/page.js:38-56`
- **Problem:** `parseRejectionReasons()` splits per-field reasons but the UI shows one bulk text block. If photos fail moderation, seller doesn't know to fix Photos tab specifically.
- **Fix:** Render a red badge on each tab that has a rejection; show the per-field reason inline next to the affected field.
- **Decision:** Approved — proceed
- **Status:** `[x]` **Done** in commit `6f62989` — tab indicator bumped from 1.5px to 2px + ring + pulse animation. (Note: per-field rejection display was already implemented; the agent finding overstated the issue.)

### H2. Polling + Realtime running together
- **File:** `app/messages/page.js:138-155, 243-245, 269-305`
- **Problem:** Component sets up Supabase realtime AND a 10s `setInterval` poll AND a 25s heartbeat. Realtime alone is sufficient (<500ms latency). The redundant poll causes lag when realtime delivers first (state churn).
- **Fix:** Remove the `setInterval` poll; keep realtime + a 60s heartbeat as fallback.
- **Decision:** `[?]` **Needs discussion** before implementing
- **Discussion notes:** User wants to evaluate first.
- **Decision:** Approved — remove poll, keep realtime + 60s fallback.
- **Status:** `[x]` **Done** in commit `04c5096` — poll 10s→60s + stopped clobbering active search filter.

### H3. Analytics permission check runs after API call
- **File:** `app/analytics/page.js:145-165`
- **Problem (clarified):** This is the `/analytics` page in the seller portal (the one with views/saves/offers charts). When a TEAM MEMBER (not the workspace owner) opens it, the component fetches analytics data first, then checks if they're allowed to see it. Result: brief "Access Denied" flash even when permission is granted, plus unnecessary API hit.
- **Fix:** Move the `/api/team/workspaces` permission fetch to the initial `useEffect`; gate the analytics API call on `analytics_view=true`.
- **Decision:** Approved.
- **Status:** `[x]` **Verified already-correct** (commit `04c5096` note) — fetch is gated on userId which is only set after the permission check passes. No premature fetch / Access-Denied flash. Agent finding was inaccurate, like H1.

### H4. Promo code applied but order summary doesn't recalc ✅
- **File:** `app/plans/upgrade/[planType]/page.js:358-397`
- **Problem:** Code accepts the promo and shows "applied at renewal" but the Subtotal/Total on the right doesn't change. Seller can't see what they're actually paying.
- **Fix:** Recalculate displayed total: `Subtotal − Promo = Total`.
- **Decision:** Approved — proceed
- **Status:** `[x]` **Done** in commit `6f62989` — subtotal/discount/total breakdown shown when promo applied; "applied at renewal" copy fixed.

### H5. No Stripe Customer Portal link
- **File:** `app/billing/page.js:275-303`
- **Problem:** Users can view invoices but can't update their card, change billing address, or cancel their subscription without contacting support.
- **Recommendation:** **YES, this IS the enterprise-product standard.** Notion, Linear, Vercel, GitHub, Slack — every modern SaaS uses Stripe's Customer Portal. It's a one-API-call setup; Stripe hosts the UI for card updates, invoice history, cancellation, and billing address. Eliminates 80% of billing support tickets. Without it, every "I need a new card on file" email lands in our inbox.
- **Fix:** Add `app/api/billing/portal/route.js` that calls `stripe.billingPortal.sessions.create({ customer, return_url })` and a button "Manage payment in Stripe →" that redirects.
- **Decision:** Approved BUT user wants it built NATIVELY (no redirect to Stripe hosted portal) — embedded Stripe Elements card form + our own cancel/invoice/address UI, backend does the Stripe work.
- **Status:** `[ ]` Pending — largest remaining build.

### H6. Paperclip button does nothing ✅
- **File:** `app/messages/page.js:740-742`
- **Decision:** Build attachments now.
- **Status:** `[x]` **Done** in commit `6d51f1a` — seller side: upload to Supabase storage + send + render (image preview / file card). Buyer side (`ChatWindow.js`) already had full attachment support, so the feature is complete end-to-end.
- **Original problem:** the paperclip button had no onClick handler.
- **Fix options:**
  - Option A: Implement file attachments — upload to Supabase storage, insert attachment URL into `messages` table, render as image preview / file card in chat.
  - Option B: Delete the button until attachments are built.
- **Recommendation:** Option B (delete) for now — proper attachments are a 2-day feature (storage, security scanning, preview UI), not worth blocking on. Add it back when we have time.
- **Decision:** `[?]` **Awaiting answer**

### H7. Block buyer = one-click, no confirmation, no email ✅
- **Status:** `[x]` **Done** in commit `04c5096` — confirmation modal added before block; no buyer email (per decision).
- **File:** `app/messages/page.js:1130`
- **Problem (clarified):** When viewing a conversation with a buyer in `/messages`, there's a "Block user" option (in a 3-dot menu or right-click). Clicking it instantly + permanently blocks that buyer from messaging — no confirmation dialog ("are you sure?"), and the buyer is never told they were blocked (they just see their messages stop being read).
- **Why it matters:**
  - Sellers can accidentally click — irreversible without DB access
  - The buyer keeps trying to message thinking they're being ignored — bad for both parties
- **Fix:** Add a confirmation modal before blocking. Optionally send a polite email to the buyer ("Your conversation with [Seller] has been closed.").
- **Decision:** `[?]` **Awaiting answer**

### H8. Status flow opaque ("Under Review" with no explanation)
- **Files:** `app/properties/new/page.js:585`, `app/properties/page.js`
- **Investigated:** Looked at `lib/moderateSellerProperty.js`. Moderation **is automatic** — fires immediately on publish via `setTimeout(0)`, uses Groq AI to check title/description, then either:
  - Approves → sets `status='active'` (live on marketplace)
  - Rejects → keeps `under_review` + records `rejection_reason`
- **In practice:** ~5-15 seconds, not 10 minutes. Almost all listings pass.
- **Problem:** Seller sees "Under Review" badge for those 5-15 seconds and has no idea if it'll be live in a moment or stuck in queue for hours.
- **Fix:** Add a toast on publish — "Submitted for review — usually takes 5-10 seconds" — and either auto-refresh the listing status, or poll for status change for 60 seconds so the badge flips to "Active" without manual refresh.
- **Decision:** Approved (based on user's "if not then okay yes lets do it")
- **Status:** `[x]` **Done** in commit `6f62989` — accurate publish message + 5s polling on /properties to auto-update under_review listings.

### H9. No "Mark as Sold" action ✅
- **File:** `app/properties/page.js`
- **Problem:** `property_status` enum supports `sold`, but there's no UI shortcut to set it. Seller must open edit page, find the dropdown, change it.
- **Fix:** Add a row-level "Mark as Sold" button (or 3-dot menu item) on `/properties` that sets `property_status='sold'` + optionally archives the listing. Confirmation dialog before commit.
- **Decision:** Approved — proceed
- **Status:** `[x]` **Done** in commit `6f62989` — "Mark as Sold" button + confirmation modal added to row actions.

### H10. Email-change disabled with confusing UX
- **File:** `app/settings/page.js:253-260`
- **Question:** Should we even let sellers change their email?
- **Recommendation:** **Yes, but with verification.** Industry standard (Stripe, Linear, Notion, Vercel all allow it). The pattern:
  1. Seller types new email + current password
  2. Send confirmation link to BOTH addresses (old + new)
  3. Both must be confirmed within 24h to complete the change
  4. Old address gets a "wasn't you? Revert" link valid for 7 days
- **Alternative:** Lock it to support contact only — simpler, but creates a support ticket every time. Most companies have moved away from this.
- **Decision:** Approved — allow with verification.
- **Status:** `[x]` **Done** in commit `20c9cdf` — new email + password → OTP to new email → update + heads-up to old email.

---

## 🟠 UX Issues (planned, not yet sequenced)

### U1. Counter-offer modal doesn't show what buyer will see
- **File:** `app/messages/page.js:475-535`
- **Problem:** Seller types a counter, hits "Send", but the preview modal only shows a recap of the form values — not the actual email the buyer will receive.
- **Fix:** Render the `buildEmailHtml` output from `/api/seller/offers` inside the modal so the seller sees the exact buyer-facing experience before confirming.

### U2. No toast after counter sent
- **File:** `app/messages/page.js:521-531`
- **Problem:** Modal closes, state resets, no feedback. Seller may wonder if it sent at all.
- **Fix:** 3-second success toast: "Counter offer sent to [Buyer]. They'll receive an email."

### U3. Buyer email + phone shown unmasked by default
- **File:** `app/messages/page.js:860-871, 1021-1032`
- **Problem:** Buyer's full contact info is visible in the chat right panel with no toggle. Screen-sharing or shoulder-surfing risk.
- **Fix:** Gate behind "Show contact info" toggle (default hidden); mask phone to last 4.

### U4. No onboarding for new sellers
- **File:** Dashboard
- **Problem:** Brand-new seller (0 listings, 0 offers) sees "Welcome Back" + empty cards. No guided next steps.
- **Fix:** Show a collapsible "Getting Started" checklist above KPI cards when `activeProperties === 0`: verify account → add first listing → set pricing → enable messages.

### U5. No aggregate unread badge on Messages nav
- **File:** Sidebar (`components/layout/DashboardLayout.js`) — already shows numeric badges for some items
- **Problem:** Individual conversations show red dot, but the Messages sidebar link doesn't sum them. Easy to miss.
- **Fix:** Already fetching counts elsewhere — just sum `conversations.unread` and show as a small badge.

### U6. Mobile chat header doesn't show property address
- **File:** `app/messages/page.js:627-646`
- **Problem:** Chat header shows buyer name only. Seller has to click a button to see which property the conversation is about.
- **Fix:** Add a one-line subtitle below buyer name with the property address.

### U7. Empty analytics state has no CTA
- **File:** `app/analytics/page.js:504-508`
- **Problem:** "No activity yet" — but no nudge toward what to do.
- **Fix:** Add CTA: "Share your listing link" with a copy button.

### U8. Add-on expiry not surfaced
- **File:** Property cards
- **Problem:** When a Boost / Highlight / Homepage add-on is active, there's no countdown or renewal CTA. Sellers let valuable add-ons silently expire.
- **Fix:** Show "Expires in X days" badge + "Renew" link on each active add-on.

### U9. "Current plan" badge wrong on billing-cycle toggle
- **File:** `app/plans/page.js:405-430`
- **Problem:** User on Annual Pro, toggles to Monthly view → Monthly Pro card shows "Your plan · annual" (confusing).
- **Fix:** Compare actual `plan.billing_cycle` not `viewAnnual`.

### U10. Trial messaging confusing on upgrade
- **File:** `app/plans/upgrade/[planType]/page.js:194-196`
- **Problem:** "You'll be billed starting [date]" during trial — user might think trial is canceled.
- **Fix:** Reword: "Your trial period continues. Billing begins on [date] at the new plan rate."

### U11. No verified-email gate on signup
- **File:** Auth flow
- **Problem:** Users can sign up and use the app without verifying their email. Email-based recovery + abuse risk.
- **Decision needed:** Make email verification optional (with nag banner) or required (block until verified)?

### U12. 2FA tab exists but only shows password change
- **File:** `app/settings/page.js` Security tab
- **Problem:** Section header promises 2FA, content is just password change.
- **Fix:** Either build TOTP/SMS 2FA or remove the empty section.

### U13. No account deletion / data export
- **File:** Settings — Danger Zone missing
- **Problem:** GDPR compliance issue + sellers have no clean off-ramp.
- **Fix:** Add Danger Zone with "Export my data" (JSON dump) and "Delete account" (confirmation requires password re-entry).

### U14. No notification preferences
- **File:** Settings — Notifications tab missing
- **Problem:** All-or-nothing email notifications. Seller can't disable marketing while keeping transactional.
- **Fix:** Add Notifications tab: email toggles for digests, offers, messages, account, marketing.

### U15. Referral code requires manual click to generate
- **File:** `app/referral/page.js:203-221`
- **Problem:** First-time visitor sees empty state + "Generate code" button. One unnecessary click.
- **Fix:** Auto-generate on first page load if none exists.

### U16. Phone number always read-only with no reason
- **File:** `app/settings/page.js:257-260`
- **Problem:** Caption says "Phone cannot be changed" but doesn't explain when/how. Confusing for users who actually need to change it.
- **Fix:** Either enable editing (with verification) or add a tooltip explaining why.

### U17. Activity timeline loads ALL activities at once
- **File:** `app/settings/page.js:489-516`
- **Problem:** Query has no limit. Users with 1000+ properties will lag.
- **Fix:** Add `.limit(20)` + "Load more" button.

### U18. Team permission display inconsistent
- **File:** `app/team/page.js:537-555`
- **Problem:** Owner shows "Full Access"; members show "5/12 access". Different formats for the same concept.
- **Fix:** Pick one format (recommend role badge: "Owner" / "Admin" / "Member" / "Viewer") and use everywhere.

---

## 🟡 Polish (design-system + minor)

### P1. Non-design-system blue (`#4A90E2`) + purple (`#7C3AED`) on dashboard
- **File:** `app/dashboard/page.js:260, 277, 279, 439`
- **Fix:** Replace with approved tokens (`#B5620A` warning or `#D03839` primary).

### P2. Inputs at 40px instead of 56px
- **File:** `app/properties/new/page.js` multiple lines
- **Fix:** Replace all `h-[40px]` with `h-14` on form inputs and primary buttons.

### P3. Currency formatting inconsistent
- **Files:** `plans/upgrade/`, `billing/`, `analytics/`
- **Problem:** Some pages use `toLocaleString()`, others use `.toFixed(2)`. Result: "$2,868" on one page, "$948.00" on another.
- **Fix:** Single utility `formatCurrency(amount, { showCents: false })` in `lib/format.js`, used everywhere.

### P4. Required-field asterisks aren't red
- **File:** `app/properties/new/page.js`
- **Fix:** Wrap each `*` in `<span className="text-[#D03839]">*</span>`.

### P5. DeleteConfirmModal uses gray instead of brand tokens
- **File:** `components/properties/DeleteConfirmModal.js`
- **Fix:** Replace `gray-50/200/700` with `#FAFAF8`/`#E8E8E4`/`#444441`.

### P6. Login form uses non-system gray border
- **File:** `app/login/page.js:197, 216`
- **Fix:** Change `border-[#D4D4CF]` to `border-[#E8E8E4]`.

### P7. Global font is Open Sans, design system says DM Sans
- **File:** `app/globals.css:19`
- **Fix:** Set `font-family: var(--font-dm-sans), …` to make DM Sans the global default.

### P8. "Sold" badge uses undefined blue
- **File:** `app/dashboard/page.js:437-439`
- **Fix:** Use `bg-[#fde4e3] text-[#D03839]` (or define a `sold` semantic color).

### P9. Avatar bg colors not in token list
- **File:** `app/dashboard/page.js:17-23`
- **Fix:** Use only the 20 official surface tokens.

### P10. Status badge radius inconsistent (pill vs square)
- **Files:** Multiple pages
- **Fix:** Pick one — design system says `rounded-full` for pills (avatars/counts), `rounded` (4px) for status indicators.

### P11. "Welcome Back" heading uses non-system size/weight
- **File:** `app/dashboard/page.js:288`
- **Fix:** 28px Bold (type/h3) or 20px Medium (type/body-lg).

### P12. "Financing" vs "Financing type" label drift
- **Files:** `messages/page.js:497, 798`, `offers/page.js:162`
- **Fix:** Standardize to "Financing type".

### P13. Tab completion lacks checkmark icon
- **File:** `app/properties/new/page.js:1050-1088`
- **Fix:** Add `<Check />` icon to completed tabs per design system "complete" state.

### P14. Modal backdrop blur not documented
- **File:** `app/team/page.js:271`
- **Fix:** Document the backdrop spec (`bg-black/30 backdrop-blur-sm`) in design system, or remove the blur for consistency.

---

## ✅ Confirmed Working (no action needed)

- Sidebar navigation correctness — every link resolves to a real page
- Notification dropdown — mark-as-read + real-time badges
- Mobile sidebar overlay
- Dashboard KPI cards — pull real data from Supabase
- Conversation realtime updates via Supabase
- Stripe integration — subscriptions, invoices, add-ons
- Auto-save on property edit
- Empty states on every major page (though some need better CTAs)

---

## Sprint Plan (rough)

### Sprint 1 — Current focus (this week)
H1, H4, H8, H9 + answers needed on H2, H3, H5, H6, H7, H10.

### Sprint 2 — UX polish
U1-U10 (counter-offer UX, masked PII, onboarding, status fixes).

### Sprint 3 — Account features
U11-U18 (verification, 2FA, account deletion, notification prefs).

### Sprint 4 — Design system pass
P1-P14 in one bundled PR.

### Sprint 5 — Critical (security)
C1-C5 once user is ready.
