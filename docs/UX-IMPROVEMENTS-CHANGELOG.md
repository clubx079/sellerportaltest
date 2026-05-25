# Seller Portal — UX Improvements Changelog

A running log of every UX/UI change made to the seller portal as part of the enterprise-grade rework. Each entry lists what changed, why, and the files touched.

---

## 2026-05-25 — Auto-save + canonical action footer (Edit Listing page)

**Files:** `app/properties/edit/[id]/page.js`

**Summary**
Replaced the dual top + bottom save/publish buttons on the listing edit page with an auto-save + single sticky "Publish" pattern. Sellers no longer hunt for a save button or fear losing work.

**Changes**
1. **Auto-save for drafts.** Edits to any field are debounced and silently saved after 2 seconds. Only runs while `status === 'draft'`. Never changes publication state, never navigates away.
2. **`SaveStatus` indicator.** A small status chip with five states, rendered in both the header (orientation) and the sticky footer (action context):
   - `Saved just now` / `Saved Xs ago` / `Saved Xm ago` (green, with checkmark)
   - `Saving…` (gray, with spinner)
   - `Unsaved changes` (amber dot)
   - `Couldn't save — we'll retry` (red, with alert icon)
   - `Changes will be reviewed when you publish` (for non-draft listings)
3. **Top header simplified.** Removed the two top buttons (Save Draft + Send for Review). Header is now just back arrow + listing title + status indicator. No competing CTAs.
4. **Single sticky footer.** One red **Publish** button on the right; the SaveStatus indicator on the left. Edge-to-edge with the viewport via `-mx-4 md:-mx-6` (cancels parent main's horizontal padding) and `-mb-4 md:-mb-6` (closes the bottom gap from parent main's bottom padding).
5. **Renamed "Send for Review" → "Publish".** Hides internal moderation mechanics from sellers; success toast updated to *"Listing published — it'll be live shortly."*
6. **Safety guarantees:**
   - Auto-save never publishes (always preserves current `status` field)
   - Auto-save never navigates away
   - Live / under-review / rejected listings don't auto-save (explicit Publish required so changes go through re-review on the seller's terms)
   - Publish button is disabled while auto-save is in flight (no race)
   - Auto-save errors show in the indicator, don't dump a scary toast on the page

**Why**
- Roland's explicit feedback: save button at the top forces a scroll-back; users naturally look at the bottom of a form for next-action.
- "Send for Review" exposed internal moderation mechanics. Sellers should think about publishing, not about being reviewed.
- Two redundant buttons (top + bottom) create cognitive double-take ("which one is the real one?").
- Long forms with manual save are a data-loss risk; auto-save eliminates it.

---

## 2026-05-25 — Save Draft added to new-listing step footer (Add Property wizard)

**Files:** `app/properties/new/page.js`

**Summary**
Added a "Save Draft" button to the step footer at the bottom of each tab in the new-listing wizard. The wizard's "Save Draft" was previously only at the top, requiring sellers to scroll back up.

**Changes**
- Added Save Draft button next to Continue → in the bottom step footer of every tab except Add-Ons (which already has its own publish action).
- Reuses the existing `handleSave('draft')` handler so behavior is identical to the top button.

**Why**
Same reasoning as the edit-page footer fix — bottom is where users look for next-action after editing.

**Status:** Will be superseded by the full auto-save pattern in the next pass.

---

## Pending / planned

The following improvements are planned next, derived from the meeting feedback (2026-05-22) and the UX audit (2026-05-25):

- **Apply auto-save + sticky footer pattern to `/properties/new`** (the new-listing wizard). Currently still uses the manual Save Draft at top + Continue navigation pattern.
- **Extract shared component primitives** so the SaveStatus and StickyActionBar are reusable across the rest of the portal.
- **Scope under-review trigger.** Currently any edit sends the entire listing back through moderation. Should only trigger for fields where bad content could appear (photos, description, free-text). Numeric/structured fields should save immediately without re-review.
- **Dispo rep dropdown** on the listing contact picker. Preload sellers' saved reps from their profile; user picks one and the phone auto-fills.
- **Rename contract templates** to plain user-friendly labels (e.g. "Assignment of Sale Contract", "Purchase Contract"); reorder so Purchase Contract appears first.
- **Multi-step contract creation flow** with inline preview before send. Replace the current manual multi-page entry with stepped prompts.
- **Preload property address dropdown** when creating a contract — auto-fill from the seller's listed properties.
- **Make rejection issues clickable** to scroll directly to the offending field in the edit form.
- **Auto-select featured image** on first publish to eliminate the extra modal step.
- **Warn before clearing custom contact info** when toggling to profile contact.
- **Clarify listing status selector vs activation toggle** on the properties table.
- **Counter-offer preview before send** in the messages page.
- **Replace generic "you'll be notified" success messages** with concrete timelines ("approval typically takes ~24 hours").

---

## Conventions used across this changelog

- Every entry has: date, files touched, summary, list of changes, why, and (optionally) status.
- Group multiple related edits under one entry rather than splitting per-file.
- When a pattern is established (e.g. SaveStatus indicator), reference it by name in subsequent entries instead of re-explaining.
- Keep entries human-readable — anyone joining the project should be able to read this top-to-bottom and understand the design direction.
