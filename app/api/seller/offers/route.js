import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getSellerId(request) {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

// Convert buyer UUID back to numeric id for users table lookup.
// "00000000-0000-0000-0000-000000000063" → 99 (decimal)
function buyerUuidToNumericId(uuid) {
  if (!uuid) return uuid;
  const match = String(uuid).match(/00000000-0000-0000-0000-([0-9a-f]{12})$/i);
  if (match) return parseInt(match[1], 16);
  return uuid; // not our format — return as-is
}

// Convert numeric conversation id to stable UUID for offers table
function toUuid(id) {
  const hex = Number(id).toString(16).padStart(12, '0');
  return `00000000-0000-0000-0000-${hex}`;
}

function formatCurrency(amount) {
  if (!amount) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

async function sendEmailToBuyer(buyerEmail, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !buyerEmail) return;
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Deelmap <notifications@deelmap.com>',
      to: buyerEmail,
      subject,
      html,
    });
  } catch (err) {
    console.error('[seller/offers] Email error:', err?.message);
  }
}

function buildEmailHtml(logoUrl, title, titleColor, bodyHtml, ctaUrl, ctaLabel) {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#1A1816;color:#fff;padding:24px;text-align:center">
      <img src="${logoUrl}" alt="Deelmap" width="160" height="48" style="display:block;max-width:160px;height:auto;border:0;margin:0 auto" />
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 12px;font-size:18px;font-weight:600;color:${titleColor || '#1A1816'}">${title}</p>
      ${bodyHtml}
      <a href="${ctaUrl}" style="display:inline-block;background:#D03839;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px">${ctaLabel}</a>
    </div>
    <div style="padding:16px;text-align:center;font-size:12px;color:#888;border-top:1px solid #eee">Deelmap</div>
  </div>
</body></html>`;
}

// GET — fetch offers for seller
// ?conversation_id=X  → offers for that conversation
// (no param)          → all offers for this seller, enriched with property + buyer info
export async function GET(request) {
  try {
    const sellerId = getSellerId(request);
    if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id');

    // ── All offers for seller ──────────────────────────────────────────────
    if (!conversationId) {
      const { data: offers, error } = await supabase
        .from('offers')
        .select('*')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });

      if (error) return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 });

      const enriched = await Promise.all((offers || []).map(async (o) => {
        // Buyer name
        let buyer_name = 'Buyer';
        if (o.buyer_id) {
          const numericId = buyerUuidToNumericId(o.buyer_id);
          const { data: u } = await supabase.from('users').select('first_name, last_name, email').eq('id', numericId).maybeSingle();
          if (u) buyer_name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Buyer';
        }

        // Property details
        let property_address = null, property_thumbnail_url = null;
        let property_price = null, property_bedrooms = null, property_bathrooms = null, property_sqft = null;
        if (o.property_id) {
          const pid = String(o.property_id);
          const [wdRes, pRes] = await Promise.all([
            supabase.from('wholesale_deals').select('full_address, display_address, address, city, state, price, bedrooms, bathrooms, sqft').eq('id', pid).maybeSingle(),
            supabase.from('properties').select('address, city, state, price, bedrooms, bathrooms, floor_area').eq('id', pid).maybeSingle(),
          ]);
          const wd = wdRes.data;
          let p = pRes.data;
          if (pRes.error) {
            const { data: pMin } = await supabase.from('properties').select('address, city, state').eq('id', pid).maybeSingle();
            p = pMin;
          }
          if (wd) {
            property_address = (wd.full_address || wd.display_address || '').trim() || [wd.address, wd.city, wd.state].filter(Boolean).join(', ');
            property_price = wd.price ?? null;
            property_bedrooms = wd.bedrooms ?? null;
            property_bathrooms = wd.bathrooms ?? null;
            property_sqft = wd.sqft ?? null;
          }
          if (p) {
            if (!property_address) property_address = [p.address, p.city, p.state].filter(Boolean).join(', ');
            if (property_price == null) property_price = p.price ?? null;
            if (property_bedrooms == null) property_bedrooms = p.bedrooms ?? null;
            if (property_bathrooms == null) property_bathrooms = p.bathrooms ?? null;
            if (property_sqft == null) property_sqft = p.floor_area ?? null;
          }

          // Thumbnail
          const [feat, any, img] = await Promise.all([
            supabase.from('property_photos').select('photo_url').eq('deal_id', pid).eq('is_featured', true).limit(1).maybeSingle(),
            supabase.from('property_photos').select('photo_url').eq('deal_id', pid).order('display_order', { ascending: true }).limit(1).maybeSingle(),
            supabase.from('property_images').select('image_url').eq('property_id', pid).order('sort_order', { ascending: true }).limit(1).maybeSingle(),
          ]);
          property_thumbnail_url = feat.data?.photo_url || any.data?.photo_url || img.data?.image_url || null;
        }

        // Numeric conversation id for inbox link
        const conv_numeric = (() => {
          const match = String(o.conversation_id || '').match(/00000000-0000-0000-0000-([0-9a-f]{12})$/i);
          return match ? parseInt(match[1], 16) : null;
        })();

        return { ...o, buyer_name, property_address, property_price, property_bedrooms, property_bathrooms, property_sqft, property_thumbnail_url, conv_numeric };
      }));

      const pendingCount = enriched.filter(o => o.status === 'pending').length;
      return NextResponse.json({ offers: enriched, pendingCount });
    }

    // ── Single conversation offers ─────────────────────────────────────────
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, seller_id, buyer_uuid')
      .eq('id', conversationId)
      .maybeSingle();

    if (!conv || String(conv.seller_id) !== String(sellerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: offers, error } = await supabase
      .from('offers')
      .select('*')
      .eq('conversation_id', toUuid(conversationId))
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 });
    return NextResponse.json({ offers: offers || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — accept / reject / counter
export async function PATCH(request) {
  try {
    const sellerId = getSellerId(request);
    if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { offer_id, action, counter_data } = body;

    if (!offer_id || !action) {
      return NextResponse.json({ error: 'offer_id and action required' }, { status: 400 });
    }

    // Fetch offer and validate seller owns it
    const { data: offer, error: offerErr } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offer_id)
      .eq('seller_id', sellerId)
      .maybeSingle();

    if (offerErr || !offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });

    const buyerBase = (process.env.NEXT_PUBLIC_DEELMAP_VIEW_BASE_URL || 'https://deelmap-production-16a1.up.railway.app').replace(/\/$/, '');
    const sellerBase = (process.env.NEXT_PUBLIC_SELLER_PORTAL_URL || 'https://sellerportaldeelmap-production.up.railway.app').replace(/\/$/, '');
    const logoUrl = `${sellerBase}/deelmap.png`;
    const buyerInboxUrl = `${buyerBase}/buyer/inbox?conversation=${offer.conversation_id}`;

    // Lookup buyer email and seller name
    const [buyerRes, sellerRes] = await Promise.all([
      supabase.from('users').select('email, first_name, last_name').eq('id', buyerUuidToNumericId(offer.buyer_id)).maybeSingle(),
      supabase.from('seller_applications').select('contact_person_name, business_name').eq('id', sellerId).maybeSingle(),
    ]);
    const buyerEmail = buyerRes.data?.email;
    const buyerName = buyerRes.data ? `${buyerRes.data.first_name || ''} ${buyerRes.data.last_name || ''}`.trim() || buyerEmail : 'Buyer';
    const sellerName = sellerRes.data?.contact_person_name || sellerRes.data?.business_name || 'Seller';

    if (action === 'accept') {
      const { error } = await supabase
        .from('offers')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', offer_id);
      if (error) return NextResponse.json({ error: 'Failed to accept offer' }, { status: 500 });

      // Notification + email to buyer (non-blocking)
      Promise.all([
        supabase.from('notifications').insert({
          recipient_id: offer.buyer_id,
          recipient_type: 'buyer',
          type: 'offer_accepted',
          title: 'Your offer was accepted!',
          body: `${sellerName} accepted your offer of ${formatCurrency(offer.offer_price)}`,
          is_read: false,
          related_conversation_id: offer.conversation_id,
          related_offer_id: offer_id,
        }),
        buyerEmail && sendEmailToBuyer(
          buyerEmail,
          `Your offer of ${formatCurrency(offer.offer_price)} was accepted - Deelmap`,
          buildEmailHtml(
            logoUrl,
            'Your offer was accepted!',
            '#0F6E56',
            `<p style="font-size:14px;color:#444">${sellerName.replace(/</g, '&lt;')} accepted your offer of <strong>${formatCurrency(offer.offer_price)}</strong>. Next steps will begin shortly.</p>`,
            buyerInboxUrl,
            'View Conversation'
          )
        ),
      ]).catch(err => console.error('[seller/offers] accept async error:', err?.message));

      return NextResponse.json({ success: true, status: 'accepted' });
    }

    if (action === 'reject') {
      const { error } = await supabase
        .from('offers')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', offer_id);
      if (error) return NextResponse.json({ error: 'Failed to reject offer' }, { status: 500 });

      Promise.all([
        supabase.from('notifications').insert({
          recipient_id: offer.buyer_id,
          recipient_type: 'buyer',
          type: 'offer_rejected',
          title: 'Your offer was declined',
          body: `${sellerName} declined your offer of ${formatCurrency(offer.offer_price)}`,
          is_read: false,
          related_conversation_id: offer.conversation_id,
          related_offer_id: offer_id,
        }),
        buyerEmail && sendEmailToBuyer(
          buyerEmail,
          `Update on your offer for ${formatCurrency(offer.offer_price)} - Deelmap`,
          buildEmailHtml(
            logoUrl,
            'Your offer was declined',
            '#D03839',
            `<p style="font-size:14px;color:#444">${sellerName.replace(/</g, '&lt;')} declined your offer of <strong>${formatCurrency(offer.offer_price)}</strong>. You can still continue the conversation.</p>`,
            buyerInboxUrl,
            'View Conversation'
          )
        ),
      ]).catch(err => console.error('[seller/offers] reject async error:', err?.message));

      return NextResponse.json({ success: true, status: 'rejected' });
    }

    if (action === 'counter') {
      if (!counter_data?.amount) return NextResponse.json({ error: 'counter_data.amount required' }, { status: 400 });

      // Mark original offer as countered
      await supabase
        .from('offers')
        .update({ status: 'countered', updated_at: new Date().toISOString() })
        .eq('id', offer_id);

      // Insert counter offer row (seller sends, so swap buyer_id/seller_id roles but keep same structure)
      const { data: counterOffer, error: counterErr } = await supabase
        .from('offers')
        .insert({
          conversation_id: offer.conversation_id,
          property_id: offer.property_id,
          buyer_id: offer.buyer_id,
          seller_id: sellerId,
          offer_price: Number(counter_data.amount),
          closing_timeline: counter_data.closing_timeline || offer.closing_timeline,
          financing_type: counter_data.financing_type || offer.financing_type,
          earnest_money: counter_data.earnest_money ? Number(counter_data.earnest_money) : offer.earnest_money,
          inspection_period: counter_data.inspection_period || offer.inspection_period,
          notes: counter_data.notes || null,
          status: 'pending',
          parent_offer_id: offer_id,
        })
        .select()
        .single();

      if (counterErr) return NextResponse.json({ error: 'Failed to create counter offer' }, { status: 500 });

      const counterAmountStr = formatCurrency(counter_data.amount);

      Promise.all([
        supabase.from('notifications').insert({
          recipient_id: offer.buyer_id,
          recipient_type: 'buyer',
          type: 'counter_received',
          title: `${sellerName} sent a counter offer`,
          body: `${sellerName} countered with ${counterAmountStr}`,
          is_read: false,
          related_conversation_id: offer.conversation_id,
          related_offer_id: counterOffer.id,
        }),
        buyerEmail && sendEmailToBuyer(
          buyerEmail,
          `${sellerName} sent a counter offer of ${counterAmountStr} - Deelmap`,
          buildEmailHtml(
            logoUrl,
            `Counter offer received: ${counterAmountStr}`,
            '#1A1816',
            `<p style="font-size:14px;color:#444">${sellerName.replace(/</g, '&lt;')} sent a counter offer of <strong>${counterAmountStr}</strong>. Review and respond in your inbox.</p>`,
            buyerInboxUrl,
            'View Counter Offer'
          )
        ),
      ]).catch(err => console.error('[seller/offers] counter async error:', err?.message));

      return NextResponse.json({ success: true, status: 'countered', counterOffer });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[seller/offers] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
