import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getCallerAccess, requirePermission } from '@/lib/workspace';
import { maybeProUsageNudge } from '@/lib/proUsageNudge';

// Single shared DB. Service role so we can mutate listings + counter + notify buyers
// across users (RLS would block these cross-user reads/writes).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getSellerId(request) {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

function formatCurrency(amount) {
  if (!amount) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

// A listing is "counted" (consumes a slot of listings_used_this_period) exactly when
// it is live/visible to buyers — status active or published.
function isCounted(statusRaw) {
  const s = (statusRaw || '').toLowerCase();
  return s === 'active' || s === 'published';
}

// ── Per-action transition rules ──────────────────────────────────────────────
// Each entry describes the target state + which current states it's valid from,
// plus the counter delta direction. Counter only ever changes when a listing
// CROSSES the active/inactive boundary (computed from before/after isCounted).
//
// status axis:          active | inactive | archived | draft | under_review | rejected | published
// property_status axis: available | sold | unavailable | pending | under_contract
//
// Manual listings live in `properties` (status + property_status).
// Scraped (DeelScout) listings live in `wholesale_deals` (status only; no property_status column).
const ACTIONS = {
  activate: {
    permission: 'listings_update',
    // Make visible to buyers. Valid from a non-live, non-archived, postable state.
    validFrom: (l) => ['inactive', 'active', 'published', ''].includes((l.status || '').toLowerCase())
      && (l.status || '').toLowerCase() !== 'archived',
    next: { status: 'active', property_status: 'available' },
    reject: (l) => {
      const s = (l.status || '').toLowerCase();
      if (s === 'archived') return 'Restore from Trash before activating';
      if (s === 'draft') return 'Finish the draft before activating';
      if (s === 'under_review') return 'Listing is under review';
      if (s === 'rejected') return 'Fix the listing before activating';
      return null;
    },
  },
  deactivate: {
    permission: 'listings_update',
    // Hide from buyers (pause). Valid only from a live state.
    validFrom: (l) => isCounted(l.status),
    next: { status: 'inactive', property_status: 'unavailable' },
    reject: () => 'Only an active listing can be paused',
  },
  mark_sold: {
    permission: 'listings_update',
    // Set sold. Keep current status (matches today's quick mark-sold which only
    // sets property_status='sold'); a live listing therefore gets DECREMENTED
    // because property_status sold removes it from buyer availability.
    validFrom: (l) => (l.property_status || 'available').toLowerCase() !== 'sold'
      && (l.status || '').toLowerCase() !== 'archived',
    // status preserved (set below); property_status -> sold. Counter handled specially.
    next: { property_status: 'sold' },
    soldDecrement: true,
    reject: (l) => {
      if ((l.property_status || '').toLowerCase() === 'sold') return 'Already marked sold';
      if ((l.status || '').toLowerCase() === 'archived') return 'Listing is in Trash';
      return null;
    },
  },
  mark_available: {
    permission: 'listings_update',
    // Un-sell: bring a sold listing back to active/available.
    validFrom: (l) => (l.property_status || '').toLowerCase() === 'sold'
      && (l.status || '').toLowerCase() !== 'archived',
    next: { status: 'active', property_status: 'available' },
    reject: (l) => {
      if ((l.property_status || '').toLowerCase() !== 'sold') return 'Listing is not sold';
      if ((l.status || '').toLowerCase() === 'archived') return 'Restore from Trash first';
      return null;
    },
  },
  archive: {
    permission: 'listings_delete',
    // Move to Trash.
    validFrom: (l) => (l.status || '').toLowerCase() !== 'archived',
    next: { status: 'archived', property_status: 'unavailable' },
    reject: () => 'Already in Trash',
  },
  restore: {
    permission: 'listings_delete',
    // Restore from Trash. Unified behavior: BOTH manual and scraped restore to
    // inactive (nothing silently goes live). No counter change (not active yet).
    validFrom: (l) => (l.status || '').toLowerCase() === 'archived',
    next: { status: 'inactive', property_status: 'unavailable' },
    reject: () => 'Listing is not in Trash',
  },
  delete: {
    permission: 'listings_delete',
    hardDelete: true,
    validFrom: () => true,
  },
};

/**
 * Apply a single net delta to seller_plans.listings_used_this_period for the
 * effective owner, safely: re-read the current value immediately before writing,
 * clamp at 0. Returns { ok, error }.
 *
 * The whole batch computes ONE net delta and calls this once → no drift, no
 * double counting. If this fails, listing state changes still stand (caller
 * surfaces the warning).
 */
async function applyCounterDelta(effectiveSellerId, netDelta) {
  if (!netDelta) return { ok: true };
  try {
    const { data: planRow, error: readErr } = await supabase
      .from('seller_plans')
      .select('id, listings_used_this_period')
      .eq('seller_id', effectiveSellerId)
      .maybeSingle();
    if (readErr) return { ok: false, error: readErr.message };
    if (!planRow) return { ok: false, error: 'No plan row' };

    const current = planRow.listings_used_this_period ?? 0;
    const next = Math.max(0, current + netDelta); // clamp at 0, never negative

    const { error: writeErr } = await supabase
      .from('seller_plans')
      .update({ listings_used_this_period: next })
      .eq('id', planRow.id);
    if (writeErr) return { ok: false, error: writeErr.message };
    return { ok: true, from: current, to: next };
  } catch (err) {
    return { ok: false, error: err?.message || 'Counter update failed' };
  }
}

// ── Buyer notification on mark_sold ──────────────────────────────────────────
function buildSoldEmailHtml(addressText, sellerName) {
  const sellerBase = (process.env.NEXT_PUBLIC_SELLER_PORTAL_URL || 'https://sell.deelmap.com').replace(/\/$/, '');
  const buyerBase = (process.env.NEXT_PUBLIC_DEELMAP_VIEW_BASE_URL || 'https://deelmap.com').replace(/\/$/, '');
  const safeAddr = String(addressText || 'a property you were interested in').replace(/</g, '&lt;');
  const safeSeller = String(sellerName || 'The seller').replace(/</g, '&lt;');
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr>
        <td style="background:#ffffff;padding:12px 40px;text-align:center;border-bottom:2px solid #D03839">
          <img src="https://deelmap.com/deelmap.png" alt="DeelMap" height="72" style="display:inline-block;height:72px;width:auto;border:0" />
        </td>
      </tr>
      <tr>
        <td style="padding:36px 40px 32px;background:#ffffff">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">This listing is no longer available</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#444">${safeSeller} has marked <strong style="color:#1A1816">${safeAddr}</strong> as sold, so it's no longer available on DeelMap. Thanks for your interest — plenty of other deals are waiting for you.</p>
          <table cellpadding="0" cellspacing="0" style="margin-top:8px">
            <tr><td style="background:#D03839;border-radius:4px">
              <a href="${buyerBase}/marketplace" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">Browse more deals</a>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;border-top:1px solid #E8E8E4;padding:20px 40px;text-align:center">
          <p style="margin:0 0 4px;font-size:12px;color:#A8A8A4">Questions? <a href="https://deelmap.com/contact" style="color:#737370;text-decoration:underline">Reach us through our contact page</a></p>
          <p style="margin:0;font-size:12px;color:#A8A8A4">© 2026 DeelMap. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </td></tr></table>
</body></html>`;
}

async function sendSoldEmail(buyerEmail, addressText, sellerName) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !buyerEmail) return;
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'DeelMap <notifications@deelmap.com>',
      to: buyerEmail,
      subject: 'A listing you were interested in is no longer available - DeelMap',
      html: buildSoldEmailHtml(addressText, sellerName),
    });
  } catch (err) {
    console.error('[listings/actions] sold email error:', err?.message);
  }
}

/**
 * Notify every buyer with an ACTIVE offer or an OPEN conversation on a sold
 * property. In-app notification row + email (same pattern as seller/offers and
 * seller/chat). Idempotent-ish: one notification per distinct buyer, and skip
 * buyers who already have a recent listing_sold notification for this property.
 * Failures here never fail the sold action.
 */
async function notifyBuyersOfSale(propertyId, effectiveSellerId, addressText) {
  try {
    const pid = String(propertyId);

    // Buyers with an active (pending/countered) offer on this property.
    const { data: offers } = await supabase
      .from('offers')
      .select('buyer_id')
      .eq('property_id', pid)
      .in('status', ['pending', 'countered']);

    // Buyers with an open (active) conversation on this property.
    const { data: convs } = await supabase
      .from('conversations')
      .select('buyer_uuid')
      .eq('property_id', pid)
      .eq('is_active', true);

    const buyerIds = new Set();
    for (const o of offers || []) if (o.buyer_id) buyerIds.add(String(o.buyer_id));
    for (const c of convs || []) if (c.buyer_uuid) buyerIds.add(String(c.buyer_uuid));
    if (buyerIds.size === 0) return;

    // Seller name for the message.
    let sellerName = 'The seller';
    const { data: sellerApp } = await supabase
      .from('seller_applications')
      .select('contact_person_name, business_name')
      .eq('id', effectiveSellerId)
      .maybeSingle();
    if (sellerApp) {
      sellerName = (sellerApp.contact_person_name || '').trim()
        || (sellerApp.business_name || '').trim() || sellerName;
    }

    // Dedupe against buyers already notified for this property's sale.
    const ids = [...buyerIds];
    const { data: existing } = await supabase
      .from('notifications')
      .select('recipient_id')
      .eq('type', 'listing_sold')
      .eq('related_property_id', pid)
      .in('recipient_id', ids);
    const already = new Set((existing || []).map(r => String(r.recipient_id)));

    const title = 'A listing is no longer available';
    const body = `${sellerName} marked ${addressText || 'a property you were interested in'} as sold.`;

    await Promise.all(ids.map(async (buyerId) => {
      if (already.has(buyerId)) return;
      // In-app notification (buyer_id / buyer_uuid is the raw users.id uuid → recipient_id).
      await supabase.from('notifications').insert({
        recipient_id: buyerId,
        recipient_type: 'buyer',
        type: 'listing_sold',
        title,
        body,
        is_read: false,
        related_property_id: pid,
      });
      // Email (best-effort).
      const { data: u } = await supabase
        .from('users')
        .select('email')
        .eq('id', buyerId)
        .maybeSingle();
      if (u?.email) await sendSoldEmail(u.email, addressText, sellerName);
    }));
  } catch (err) {
    console.error('[listings/actions] notifyBuyersOfSale error:', err?.message);
  }
}

// Resolve a display address for the sold email (manual properties + scraped deals).
async function getListingAddress(listing) {
  if (listing._source === 'scraped') {
    return (listing.full_address || listing.display_address || '').trim()
      || [listing.address, listing.city, listing.state].filter(Boolean).join(', ') || null;
  }
  return (listing.address || listing.full_address || '').trim()
    || [listing.address, listing.city, listing.state].filter(Boolean).join(', ') || null;
}

export async function POST(request) {
  try {
    const rawSellerId = getSellerId(request);
    if (!rawSellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { action } = body || {};
    const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];

    const def = ACTIONS[action];
    if (!def) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    if (ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 });

    // Permission gate (owner always allowed; member needs the key).
    const access = await getCallerAccess(rawSellerId);
    if (!requirePermission(access, def.permission)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const effectiveSellerId = access.effectiveSellerId || rawSellerId;

    // Resolve the effective owner's temp_seller_id (ownership key for scraped deals).
    const { data: sellerRow } = await supabase
      .from('seller_applications')
      .select('temp_seller_id')
      .eq('id', effectiveSellerId)
      .maybeSingle();
    const tempSellerId = sellerRow?.temp_seller_id || null;

    // Load every requested listing scoped to the effective owner. A listing is
    // owned if it's in `properties` with seller_id = owner, OR in `wholesale_deals`
    // with temp_seller_id = owner's temp_seller_id. Anything not found / not owned
    // is reported as a failure and never touched.
    const idStrs = ids.map(String);

    const { data: manualRows } = await supabase
      .from('properties')
      .select('id, status, property_status, address, city, state, full_address')
      .in('id', idStrs)
      .eq('seller_id', effectiveSellerId);

    let scrapedRows = [];
    if (tempSellerId) {
      const { data } = await supabase
        .from('wholesale_deals')
        .select('id, status, full_address, display_address, address, city, state')
        .in('id', idStrs)
        .eq('temp_seller_id', tempSellerId);
      scrapedRows = data || [];
    }

    const ownedById = new Map();
    for (const r of manualRows || []) ownedById.set(String(r.id), { ...r, _source: 'manual' });
    for (const r of scrapedRows) {
      if (!ownedById.has(String(r.id))) {
        ownedById.set(String(r.id), { ...r, property_status: 'available', _source: 'scraped' });
      }
    }

    const results = [];
    let netDelta = 0;            // batch counter delta, applied once at the end
    const soldProperties = [];   // { propertyId, address } to notify after writes

    for (const id of idStrs) {
      const listing = ownedById.get(id);
      if (!listing) {
        results.push({ id, ok: false, error: 'Not found or not owned' });
        continue;
      }

      // Validate transition.
      if (!def.validFrom(listing)) {
        results.push({ id, ok: false, error: (def.reject && def.reject(listing)) || 'Invalid transition' });
        continue;
      }

      const isManual = listing._source === 'manual';
      const wasCounted = isCounted(listing.status);

      // ── delete ────────────────────────────────────────────────────────────
      if (def.hardDelete) {
        try {
          if (isManual) {
            await supabase.from('property_images').delete().eq('property_id', id);
            const { error } = await supabase
              .from('properties').delete().eq('id', id).eq('seller_id', effectiveSellerId);
            if (error) throw error;
          } else {
            await supabase.from('property_photos').delete().eq('deal_id', id);
            const { error } = await supabase
              .from('wholesale_deals').delete().eq('id', id).eq('temp_seller_id', tempSellerId);
            if (error) throw error;
          }
          if (wasCounted) netDelta -= 1; // a live listing freed a slot
          results.push({ id, ok: true, action });
        } catch (err) {
          results.push({ id, ok: false, error: err?.message || 'Delete failed' });
        }
        continue;
      }

      // ── status / property_status change ────────────────────────────────────
      // Build the update payload. Scraped deals have no property_status column.
      const update = {};
      if (action === 'mark_sold') {
        update.property_status = 'sold';
        // Preserve current status (today's quick mark-sold keeps status).
      } else {
        if (def.next.status !== undefined) update.status = def.next.status;
        if (isManual && def.next.property_status !== undefined) {
          update.property_status = def.next.property_status;
        }
      }
      if (!isManual) delete update.property_status; // wholesale_deals: status only

      // Compute resulting counted-state to derive the counter delta.
      const nextStatus = update.status !== undefined ? update.status : listing.status;
      let willBeCounted = isCounted(nextStatus);
      // mark_sold removes buyer availability even if status stays active.
      if (def.soldDecrement) willBeCounted = false;

      try {
        if (isManual) {
          const { error } = await supabase
            .from('properties').update(update).eq('id', id).eq('seller_id', effectiveSellerId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('wholesale_deals').update(update).eq('id', id).eq('temp_seller_id', tempSellerId);
          if (error) throw error;
        }

        if (wasCounted && !willBeCounted) netDelta -= 1;
        else if (!wasCounted && willBeCounted) netDelta += 1;

        if (action === 'mark_sold') {
          soldProperties.push({ propertyId: id, listing });
        }
        results.push({ id, ok: true, action, status: nextStatus });
      } catch (err) {
        results.push({ id, ok: false, error: err?.message || 'Update failed' });
      }
    }

    // Apply the single net counter delta (read-modify-write, clamped at 0).
    let counterWarning = null;
    const counterRes = await applyCounterDelta(effectiveSellerId, netDelta);
    if (!counterRes.ok) {
      counterWarning = `Listing counter not updated: ${counterRes.error}`;
      console.error('[listings/actions]', counterWarning);
    }

    // #5 — Pro plan usage nudge: a slot was just consumed (netDelta > 0). If the
    // seller is on Pro and at/near their cap, prompt an Enterprise upgrade.
    if (netDelta > 0 && counterRes.ok && typeof counterRes.to === 'number') {
      await maybeProUsageNudge(supabase, effectiveSellerId, counterRes.to);
    }

    // Notify buyers for each sold property (best-effort, after state is committed).
    for (const sp of soldProperties) {
      const address = await getListingAddress(sp.listing);
      await notifyBuyersOfSale(sp.propertyId, effectiveSellerId, address);
    }

    const anyOk = results.some(r => r.ok);
    return NextResponse.json({
      success: anyOk,
      action,
      results,
      counterDelta: netDelta,
      ...(counterWarning ? { counterWarning } : {}),
    });
  } catch (err) {
    console.error('[listings/actions] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
