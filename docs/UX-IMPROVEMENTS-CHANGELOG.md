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

**Verified end-to-end (2026-05-25):** Initial load shows `Draft` cleanly (no false unsaved state). User edits a price field → indicator goes `Unsaved changes` (amber) → `Saving…` → `Saved just now` (green ✓) within ~3 seconds. DB confirms `price` updated and `status` stayed `draft` — auto-save never silently publishes.

**Commit:** `ceb79c7` on `feature/inline-contracts`.

---

## 2026-05-25 — Auto-save + canonical action pattern (New Listing wizard)

**Files:** `app/properties/new/page.js`, `components/properties/SaveStatus.js` (new shared component)

**Summary**
Brought the new-listing wizard up to the same enterprise-grade pattern as the edit page. Manual Save Draft buttons are gone; auto-save handles drafts; SaveStatus indicator shows progress in the header and step footer. The Add-Ons / Publish step is unchanged — that's where the explicit publish + payment happens.

**Changes**
1. **Auto-save for drafts.** Every edit is debounced 2s and silently saved. After the first auto-save creates a new property row, the new id is captured in `currentDraftId` so subsequent saves UPDATE the same row instead of inserting more. Skipped on the Add-Ons tab (publish step) and requires at least a location.
2. **`SaveStatus` indicator** in the header (orientation) and the step footer (action context). Same five states as the edit page.
3. **Removed the top Save Draft button.** The header now shows just back arrow + "Post a Deal" title + status indicator.
4. **Removed the duplicate Save Draft button** I'd added to the step footer earlier in this session. The step footer is now just Back ↔ SaveStatus + Continue → — clean.
5. **Extracted `SaveStatus` into a shared component** at `components/properties/SaveStatus.js`. The edit page now imports the same component instead of defining its own inline copy. First step toward the shared primitives library.
6. **Refactored `handleSave`** to accept `{ silent, skipNavigation }` options. Silent mode forces `publishStatus='draft'`, relaxes validation, skips the success toast and the navigation to `/properties`. Same safety guarantees as the edit page (never silently publishes, never navigates).
7. **Renamed publish success message:** "Property submitted for review!..." → *"Listing published — it'll be live shortly."* for consistency with the edit page.

**Why**
Same logic as the edit page: long forms with manual save are a data-loss risk; auto-save eliminates it. Two redundant save buttons (top + bottom) create cognitive double-take. The wizard needs the same pattern so sellers don't have to learn two different conventions across edit and new flows.

**Verified end-to-end (2026-05-25):** Loaded `/properties/new?draft_id=<id>`. Initial: `Draft`. Edit price 95000 → 142000. Status transitions `Unsaved changes` → `Saving…` → `Saved just now` within ~3s. DB confirms `price=142000, status=draft`. Both indicators (header + step footer) stay in sync.

**Status:** Done.

---

## Pending / planned

The following improvements are planned next, derived from the meeting feedback (2026-05-22) and the UX audit (2026-05-25):

- ~~**Apply auto-save + sticky footer pattern to `/properties/new`**~~ Done 2026-05-25.
- **Extract shared component primitives** so the SaveStatus and StickyActionBar are reusable across the rest of the portal. SaveStatus done 2026-05-25 (`components/properties/SaveStatus.js`); StickyActionBar pending.
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
