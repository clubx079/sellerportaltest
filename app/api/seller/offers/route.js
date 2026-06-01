import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getWorkspaceSellerId } from '@/lib/workspace';

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

// Convert UUID back to numeric conversation id
function uuidToNumeric(uuid) {
  if (!uuid) return null;
  const match = String(uuid).match(/00000000-0000-0000-0000-([0-9a-f]{12})$/i);
  if (match) return parseInt(match[1], 16);
  return null;
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

function buildPropertyBlock({ address, price, bedrooms, bathrooms, sqft, thumbnail } = {}) {
  if (!address && !thumbnail) return '';
  const details = [
    bedrooms ? `${bedrooms} bd` : null,
    bathrooms ? `${bathrooms} ba` : null,
    sqft ? `${Number(sqft).toLocaleString()} sqft` : null,
  ].filter(Boolean).join(' · ');
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E8E4;border-radius:4px;overflow:hidden;margin-bottom:20px">
      ${thumbnail ? `<tr><td style="padding:0"><img src="${thumbnail}" alt="Property" style="width:100%;max-height:180px;object-fit:cover;display:block" /></td></tr>` : ''}
      <tr><td style="background:#FAFAF8;padding:12px 16px;border-top:1px solid #E8E8E4">
        <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#A8A8A4">Property</p>
      </td></tr>
      <tr><td style="padding:12px 16px">
        ${address ? `<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1A1816">${String(address).replace(/</g, '&lt;')}</p>` : ''}
        ${details ? `<p style="margin:0;font-size:13px;color:#737370">${details}</p>` : ''}
        ${price ? `<p style="margin:4px 0 0;font-size:13px;color:#737370">Asking: <strong style="color:#1A1816">${formatCurrency(price)}</strong></p>` : ''}
      </td></tr>
    </table>`;
}

function buildEmailHtml(logoUrl, title, titleColor, propertyBlock, bodyHtml, ctaUrl, ctaLabel) {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr>
        <td style="background:#ffffff;padding:12px 40px;text-align:center;border-bottom:2px solid #D03839">
          <img src="https://deelmap.com/deelmap.png" alt="Deelmap" height="72" style="display:inline-block;height:72px;width:auto;border:0" />
        </td>
      </tr>
      <tr>
        <td style="padding:36px 40px 32px;background:#ffffff">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${titleColor || '#1A1816'};letter-spacing:-0.4px;line-height:1.25">${title}</h1>
          ${propertyBlock}
          ${bodyHtml}
          <table cellpadding="0" cellspacing="0" style="margin-top:20px">
            <tr><td style="background:#D03839;border-radius:4px">
              <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">${ctaLabel}</a>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;border-top:1px solid #E8E8E4;padding:20px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#A8A8A4">© 2026 Deelmap. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// GET — fetch offers for seller
// ?conversation_id=X  → offers for that conversation
// (no param)          → all offers for this seller, enriched with property + buyer info
export async function GET(request) {
  try {
    const rawSellerId = getSellerId(request);
    if (!rawSellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { effectiveId: sellerId } = await getWorkspaceSellerId(rawSellerId);

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id');
    const offerId = searchParams.get('offer_id');

    // ── Single offer — enriched for the "Create Contract from offer" prefill ─
    if (offerId) {
      const { data: o, error } = await supabase
        .from('offers')
        .select('*')
        .eq('id', offerId)
        .eq('seller_id', sellerId)
        .maybeSingle();
      if (error || !o) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });

      let buyer_name = 'Buyer', buyer_email = '';
      if (o.buyer_id) {
        const { data: u } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', buyerUuidToNumericId(o.buyer_id))
          .maybeSingle();
        if (u) {
          buyer_name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Buyer';
          buyer_email = u.email || '';
        }
      }

      let property_address = null;
      if (o.property_id) {
        const pid = String(o.property_id);
        const [wdRes, pRes] = await Promise.all([
          supabase.from('wholesale_deals').select('full_address, display_address, address, city, state').eq('id', pid).maybeSingle(),
          supabase.from('properties').select('address, city, state').eq('id', pid).maybeSingle(),
        ]);
        const wd = wdRes.data, p = pRes.data;
        if (wd) property_address = (wd.full_address || wd.display_address || '').trim() || [wd.address, wd.city, wd.state].filter(Boolean).join(', ');
        if (!property_address && p) property_address = [p.address, p.city, p.state].filter(Boolean).join(', ');
      }

      return NextResponse.json({ offer: { ...o, buyer_name, buyer_email, property_address } });
    }

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
            supabase.from('properties').select('address, state, price, bedrooms, bathrooms, floor_area').eq('id', pid).maybeSingle(),
          ]);
          const wd = wdRes.data;
          const p = pRes.data;
          if (wd) {
            property_address = (wd.full_address || wd.display_address || '').trim() || [wd.address, wd.city, wd.state].filter(Boolean).join(', ');
            property_price = wd.price ?? null;
            property_bedrooms = wd.bedrooms ?? null;
            property_bathrooms = wd.bathrooms ?? null;
            property_sqft = wd.sqft ?? null;
          }
          if (p) {
            if (!property_address) property_address = [p.address, p.state].filter(Boolean).join(', ');
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
    const rawSellerId = getSellerId(request);
    if (!rawSellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { effectiveId: sellerId } = await getWorkspaceSellerId(rawSellerId);

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

    const buyerBase = (process.env.NEXT_PUBLIC_DEELMAP_VIEW_BASE_URL || 'https://deelmap.com').replace(/\/$/, '');
    const sellerBase = (process.env.NEXT_PUBLIC_SELLER_PORTAL_URL || 'https://sell.deelmap.com').replace(/\/$/, '');
    const logoUrl = `${sellerBase}/deelmap.png`;
    const buyerInboxUrl = `${buyerBase}/buyer/inbox?conversation=${offer.conversation_id}`;

    // Lookup buyer email, seller name, and property details
    const [buyerRes, sellerRes, propDetails] = await Promise.all([
      supabase.from('users').select('email, first_name, last_name').eq('id', buyerUuidToNumericId(offer.buyer_id)).maybeSingle(),
      supabase.from('seller_applications').select('contact_person_name, business_name').eq('id', sellerId).maybeSingle(),
      (async () => {
        if (!offer.property_id) return {};
        const pid = String(offer.property_id);
        const [wdRes, pRes] = await Promise.all([
          supabase.from('wholesale_deals').select('full_address, display_address, address, city, state, price, bedrooms, bathrooms, sqft').eq('id', pid).maybeSingle(),
          supabase.from('properties').select('address, state, price, bedrooms, bathrooms, floor_area').eq('id', pid).maybeSingle(),
        ]);
        const wd = wdRes.data; const p = pRes.data;
        let address = null, price = null, bedrooms = null, bathrooms = null, sqft = null;
        if (wd) {
          address = (wd.full_address || wd.display_address || '').trim() || [wd.address, wd.city, wd.state].filter(Boolean).join(', ') || null;
          price = wd.price ?? null; bedrooms = wd.bedrooms ?? null; bathrooms = wd.bathrooms ?? null; sqft = wd.sqft ?? null;
        }
        if (p) {
          if (!address) address = [p.address, p.state].filter(Boolean).join(', ') || null;
          if (price == null) price = p.price ?? null;
          if (bedrooms == null) bedrooms = p.bedrooms ?? null;
          if (bathrooms == null) bathrooms = p.bathrooms ?? null;
          if (sqft == null) sqft = p.floor_area ?? null;
        }
        const [feat, any, img] = await Promise.all([
          supabase.from('property_photos').select('photo_url').eq('deal_id', pid).eq('is_featured', true).limit(1).maybeSingle(),
          supabase.from('property_photos').select('photo_url').eq('deal_id', pid).order('display_order', { ascending: true }).limit(1).maybeSingle(),
          supabase.from('property_images').select('image_url').eq('property_id', pid).order('sort_order', { ascending: true }).limit(1).maybeSingle(),
        ]);
        const thumbnail = feat.data?.photo_url || any.data?.photo_url || img.data?.image_url || null;
        return { address, price, bedrooms, bathrooms, sqft, thumbnail };
      })(),
    ]);
    const buyerEmail = buyerRes.data?.email;
    const buyerName = buyerRes.data ? `${buyerRes.data.first_name || ''} ${buyerRes.data.last_name || ''}`.trim() || buyerEmail : 'Buyer';
    const sellerName = sellerRes.data?.contact_person_name || sellerRes.data?.business_name || 'Seller';
    const propertyBlock = buildPropertyBlock(propDetails);

    if (action === 'accept') {
      const { error } = await supabase
        .from('offers')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', offer_id);
      if (error) return NextResponse.json({ error: 'Failed to accept offer' }, { status: 500 });

      // Withdraw all other pending offers in the same conversation (deal is closed)
      await supabase
        .from('offers')
        .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
        .eq('conversation_id', offer.conversation_id)
        .eq('status', 'pending')
        .neq('id', offer_id);

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
        }),
        buyerEmail && sendEmailToBuyer(
          buyerEmail,
          `Your offer of ${formatCurrency(offer.offer_price)} was accepted - Deelmap`,
          buildEmailHtml(
            logoUrl,
            'Your offer was accepted!',
            '#0F6E56',
            propertyBlock,
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
        }),
        buyerEmail && sendEmailToBuyer(
          buyerEmail,
          `Update on your offer for ${formatCurrency(offer.offer_price)} - Deelmap`,
          buildEmailHtml(
            logoUrl,
            'Your offer was declined',
            '#D03839',
            propertyBlock,
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

      // Insert counter offer as a message so it appears in both seller and buyer chat (awaited so client re-fetch sees it)
      const convNumeric = uuidToNumeric(offer.conversation_id);
      if (convNumeric) {
        const counterTerms = [
          counter_data.closing_timeline || offer.closing_timeline,
          counter_data.financing_type || offer.financing_type,
        ].filter(Boolean).join(' · ');
        await supabase.from('messages').insert({
          conversation_id: convNumeric,
          sender_type: 'seller',
          sender_id: sellerId,
          message_text: `Counter offer: ${counterAmountStr}${counterTerms ? `\n${counterTerms}` : ''}`,
          has_attachment: false,
          is_read: false,
        });
        supabase.from('conversations').update({
          last_message_preview: `Counter offer: ${counterAmountStr}`,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', convNumeric).then(() => {}).catch(() => {});
      }

      Promise.all([
        supabase.from('notifications').insert({
          recipient_id: offer.buyer_id,
          recipient_type: 'buyer',
          type: 'counter_received',
          title: `${sellerName} sent a counter offer`,
          body: `${sellerName} countered with ${counterAmountStr}`,
          is_read: false,
          related_conversation_id: offer.conversation_id,
        }),
        buyerEmail && sendEmailToBuyer(
          buyerEmail,
          `${sellerName} sent a counter offer of ${counterAmountStr} - Deelmap`,
          buildEmailHtml(
            logoUrl,
            `Counter offer received: ${counterAmountStr}`,
            '#1A1816',
            propertyBlock,
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
