# Seller Portal — Improvements Log

A plain-English log of every change we shipped to the seller portal during the enterprise-grade rework. Each entry is written for anyone — not just developers — to understand what was different before, what we changed, and what the seller now sees.

---

## 2026-05-25 — Contracts: full wizard with every field collected

**What we updated:** the entire contracts feature.

**What changed:** before, the only way to send a contract was to fill in 4 fields on a tiny popup (buyer name, buyer email, free-text property address, template) and then jump to DocuSeal to actually fill in the contract — purchase price, EMD, closing date, addresses, due diligence period, etc. — manually. We replaced that with a real 5-step wizard.

**What it looks like now:**
- Step 1: pick which contract you want — Purchase Contract or Assignment of Contract (with friendly cards, not raw filenames).
- Step 2: pick a property from a dropdown of your own listings (auto-fills the address), or enter one manually.
- Step 3: enter the other party's name + email.
- Step 4: fill in the deal terms. **Every field that exists on the contract is now collected here** — sale price, earnest money, escrow holder, closing date, closing location, due diligence period, acceptance deadline, both addresses, tax ID, financing type. For Assignment, also: the original seller's name and the date you signed the original purchase contract.
- Step 5: review everything in one summary, hit Send.
- The contract opens in DocuSeal **already filled in** with everything from the wizard. The seller just signs and sends. The buyer gets an email with a link to sign on our website.

**Bonus: profile defaults.** Three fields you reuse every time — your address, your default title company, your default closing location — have a "Save as default" toggle. Click it once and they auto-fill on every future contract.

**Bonus: drafts.** If you bail halfway, your progress auto-saves every 2 seconds. Come back later, click "Resume" from the contracts list, pick up where you left off.

---

## 2026-05-25 — Listing edit page: auto-save instead of "Save Draft"

**What we updated:** the listing edit page (`/properties/edit/...`).

**What changed:** before, the page had two buttons at the top — Save Draft and Send for Review. Sellers had to scroll back up to save, and "Send for Review" exposed our internal moderation process. We replaced that with auto-save and a single Publish button at the bottom.

**What it looks like now:**
- The page auto-saves drafts every 2 seconds while you edit. You never lose work.
- A small status chip in the header and at the bottom shows you exactly what's happening: "Draft" / "Unsaved changes" / "Saving…" / "Saved just now" / "Couldn't save — we'll retry".
- One red **Publish** button at the bottom, edge-to-edge with the viewport.
- Renamed "Send for Review" → "Publish". The success message now says "Listing submitted — typically live within ~10 minutes once our review completes" instead of vague "shortly".

---

## 2026-05-25 — New listing wizard: same auto-save pattern

**What we updated:** the new-listing wizard (`/properties/new`).

**What changed:** before, the wizard had Save Draft at the top and a separate Continue button at the bottom — same scroll-up problem. Now it auto-saves like the edit page, so the seller can focus on filling out the form without thinking about it.

**What it looks like now:**
- Auto-save kicks in after the seller enters at least an address. From that point every change is saved to a draft within 2 seconds.
- The header shows the same status chip as the edit page.
- The step footer at the bottom now shows the status + Continue button (no more redundant Save Draft).

---

## 2026-05-25 — Listings table: real toggle, not a fake dropdown

**What we updated:** the status column on the listings table (`/properties`).

**What changed:** before, the "Active / Inactive" control on each listing row was styled like a dropdown with a chevron arrow — but it only had two options, so it was really a toggle pretending to be a dropdown. Sellers would hesitate, expecting more choices.

**What it looks like now:**
- A proper iOS-style toggle switch: green when active, gray when inactive, with a small label next to it.
- Click flips the state immediately. The subscription gate (can't activate without a paid plan) still applies — it just routes through a clearer control.

---

## 2026-05-25 — Contact Info: no more "Edit contact info" button

**What we updated:** the Contact Info section on both the edit and new-listing pages.

**What changed:** before, there was an "Edit contact info" button that toggled the fields between read-only (showing your profile defaults) and editable. Clicking the toggle erased anything you'd typed. We removed the toggle entirely.

**What it looks like now:**
- The Contact Name and Contact Phone fields are always editable.
- They're pre-filled with your saved profile contact, but you can change them per listing if you want.
- Helper text under the heading explains this so the seller knows what to expect.

---

## 2026-05-25 — Sticky save bar sits flush at the bottom

**What we updated:** the bottom action bar on the edit page.

**What changed:** the bar had a small gray gap between it and the bottom of the visible screen. We fixed the positioning so it sits exactly at the bottom edge.

**What it looks like now:** no gap. The action bar is glued to the bottom of the viewport while you scroll, no awkward strip of background showing below it.

---

## 2026-05-25 — Rejection messages are clickable

**What we updated:** the rejection banner on the edit page.

**What changed:** before, when a listing was rejected, the banner listed the issues as text. Sellers had to read each issue, find the matching tab and field on their own, then scroll to it. Now each issue is a clickable shortcut.

**What it looks like now:**
- Each rejection issue is a button. Click it → the page switches to the right tab and scrolls the offending field into view.
- The offending field briefly pulses with a red ring so the seller can see exactly which one was flagged.
- The banner copy now says "Click an issue to jump to it. Fix it and click Publish to send back for review."

---

## 2026-05-25 — Featured image picks itself automatically

**What we updated:** the publish flow when you have images but none marked as featured.

**What changed:** before, hitting Publish opened a modal asking the seller to pick which image to feature. Extra click, extra friction. Now it just uses the first uploaded image automatically.

**What it looks like now:**
- Click Publish, no modal interruption.
- The first uploaded image becomes the featured one.
- Seller can still re-pick from the gallery if they want a different one.

---

## 2026-05-25 — Concrete timelines instead of "soon"

**What we updated:** success messages across the listing flow.

**What changed:** before, when a listing was submitted, the message was "Listing published — it'll be live shortly." Vague. Sellers don't know what "shortly" means. We replaced it with a concrete timeline.

**What it looks like now:** "Listing submitted — typically live within ~10 minutes once our review completes. We'll email you if anything needs attention."

---

## 2026-05-25 — Counter-offers: review before send

**What we updated:** the counter-offer flow on the messages page.

**What changed:** before, the seller filled in a counter-offer (price, closing timeline, financing, notes) and hit Send — fired immediately to the buyer, no chance to double-check. Counter-offers are legally meaningful numbers, so we added a confirmation step.

**What it looks like now:**
- The "Send counter" button is now "Review & Send".
- Clicking it opens a clean preview modal showing the full counter-offer: price prominent, closing timeline, financing, notes, plus a reminder that the buyer gets notified immediately.
- Two buttons: Edit (goes back to the form) and Send counter offer (actually fires it).

---

## 2026-05-25 — Editing a live listing doesn't always trigger re-review

**What we updated:** what counts as "needs another moderation check".

**What changed:** before, any edit on a live listing — even a $5 price tweak — sent the whole listing back to under_review. The listing temporarily disappeared from buyer search while moderation re-ran. We narrowed the trigger to changes that actually affect what buyers see.

**What it looks like now:**
- If the seller only changes price, beds, baths, sqft, contact info, SEO fields, etc. — the listing stays live. Saving works immediately. Toast says "Listing updated — changes are live now."
- If the seller changes photos, description, repairs, inspection report, or contract upload — the listing goes back to re-review (those are the fields where bad content could appear).
- For listings still in draft or rejected, the first Publish always goes through review.

---

## 2026-05-25 — Team-member contact dropdown (enterprise sellers)

**What we updated:** the Contact Info section on listings, for enterprise sellers with team members.

**What changed:** before, enterprise sellers had to manually type a team member's name and phone every time they posted a listing. Now they pick from a dropdown.

**What it looks like now:**
- On the `/team` page, the owner can set a phone number for each team member (next to their email).
- On the listing edit and new pages, enterprise sellers see a "Pick a team member" dropdown above Contact Name + Phone.
- Picking a team member auto-fills both fields. Picking "Custom" lets them type manually.
- Non-enterprise sellers don't see the dropdown — they get the same always-editable inputs as before.

**Note:** the migration to add the phone column to the team_members table needs to be run in Supabase before this fully works. Until then, the dropdown shows but team members appear as "(no phone)".

---

## 2026-05-25 — Auction.com scraper: 0-30 day window (DeelScout)

**What we updated:** the auction.com scraper that powers the deals shown in the marketplace.

**What changed:** the scraper was filtering for auctions 7-30 days away. Any auction happening in the next 6 days was excluded. Roland called this out — buyers want to see imminent auctions too. Fixed to 0-30 days.

**What it looks like now:**
- The scraper now captures auctions happening today through 30 days out.
- Items with no auction date are excluded (they fail the basic "must have a date" rule).
- Auctions older than today are excluded.
- Verified end-to-end: a real run returned 1,296 properties with 102 in the previously-excluded 0-6 day window (1 "Auction Today", 17 "Auction Tomorrow", 84 in 1-6 days).

---

## Reusable building blocks added

While doing the above work we also extracted three small reusable components so the same patterns can be applied elsewhere in the portal without duplicating code:

- **SaveStatus** — the little status chip that shows Saved / Saving / Unsaved / Error.
- **StickyActionBar** — the bottom action footer that stays glued to the bottom of the screen.
- **ToggleSwitch** — the on/off switch used for the listing status.

These live in `components/properties/` and can be dropped into any future page that needs the same kind of UX. Once we have a fourth primitive they should move to a dedicated `components/ui/` folder.

---

## Things still planned / not done

- **Custom contract templates.** Sellers can't yet upload their own contract PDFs and label fields — they're limited to the two we set up (Purchase + Assignment). DocuSeal supports it; we deferred to V2.
- **More auction-window flexibility.** Right now we hard-code 0-30 days. If you ever want 0-60 or "today only", we'd add a filter control.
- **Multi-line additional terms on Assignment.** The Assignment template has six numbered "additional terms" slots. We split the wizard's textarea by newline and fill up to 6 lines. Long blocks get truncated — sellers should be aware.
- **Conventions update.** When we hit three reusable components (already there), we agreed to migrate them to `components/ui/`. Not yet done.

---

## What you (the team) need to do for everything to work end-to-end

Two one-time database migrations need to be run manually in Supabase (DDL can't be applied automatically via the API):

1. **`database/add_phone_to_team_members.sql`** — adds the phone column for team members. ✅ Already run.
2. **`database/contract_drafts.sql`** — creates the table that stores in-progress contract wizard drafts. ✅ Already run.

Both are pasted-into-SQL-editor-and-Run jobs.
