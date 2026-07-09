import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import sharp from 'sharp'
import { maybeProUsageNudge } from '@/lib/proUsageNudge'
import { enrollAutomation } from '@/lib/enrollAutomation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

// ─── Strip HTML tags ─────────────────────────────────────────────────────────

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ─── Groq helpers ────────────────────────────────────────────────────────────

async function groqChat(messages, model) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, max_tokens: 80, temperature: 0 }),
  })
  if (!res.ok) throw new Error(`Groq API error: ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content.trim()
}

async function checkText(rawText, address) {
  if (!rawText?.trim()) return { pass: true }

  const text = stripHtml(rawText)
  if (!text.trim()) return { pass: true }

  console.log(`[seller-moderation] checkText — stripped text: "${text.slice(0, 200)}"`)

  try {
    const addressContext = address ? `Property address: ${address}\n\n` : ''
    const reply = await groqChat([
      {
        role: 'system',
        content: `You are a content safety filter for a real estate marketplace. Your only job is to block genuinely harmful content. You must reply with ONLY "PASS" or "FAIL: <reason>" — nothing else.`,
      },
      {
        role: 'user',
        content: `Review this property listing description. Reply "PASS" if it is at least loosely about a property or real estate — even if the writing is informal, repetitive, vague, poorly written, or uses casual language. Most descriptions should PASS.\n\nOnly reply "FAIL: <reason>" if the description contains one of these serious issues:\n- Hate speech, slurs, or discriminatory language\n- Sexual or explicit content\n- Threats, violence, or illegal activity\n- Spam with no relation to a property (e.g. "buy my shoes", random keyboard mashing)\n- Severe personal attacks or profanity\n\nDo NOT fail for: informal language, repetition, vague descriptions, poor grammar, personal enthusiasm, or anything that is at least trying to describe a property.\n\n${addressContext}Description:\n${text.slice(0, 1200)}`,
      },
    ], 'llama-3.3-70b-versatile')
    console.log(`[seller-moderation] checkText — Groq reply: "${reply}"`)
    if (reply.toUpperCase().startsWith('PASS')) return { pass: true }
    return { pass: false, reason: reply.replace(/^FAIL:\s*/i, '').slice(0, 200) }
  } catch (err) {
    console.log(`[seller-moderation] checkText — Groq error: ${err.message}`)
    return { pass: true }
  }
}

async function checkDocument(url, type = 'document') {
  if (!url) return { pass: true }
  try {
    const parsed = new URL(url)
    const trustedDomains = ['supabase.co', 'supabase.com']
    const isTrusted = trustedDomains.some(d => parsed.hostname.includes(d))
    if (!isTrusted) {
      return { pass: false, reason: `${type} is hosted on an untrusted external domain (${parsed.hostname}). Please re-upload through DeelMap.` }
    }
    return { pass: true }
  } catch {
    return { pass: false, reason: `Invalid ${type} URL` }
  }
}

async function checkImage(url) {
  if (!url) return { pass: true }
  try {
    const imgRes = await fetch(url)
    if (!imgRes.ok) {
      console.error('[seller-moderation] Image fetch failed:', imgRes.status, url)
      return { pass: true }
    }
    const rawBuffer = Buffer.from(await imgRes.arrayBuffer())
    const resized = await sharp(rawBuffer)
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
    const base64 = resized.toString('base64')
    const dataUrl = `data:image/jpeg;base64,${base64}`

    let reply
    try {
      reply = await groqChat([{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: 'Is this image primarily a logo, company branding, watermark, or text graphic (not an actual photo of a building, property, or location)? Answer YES or NO only.' }
        ]
      }], 'meta-llama/llama-4-scout-17b-16e-instruct')
    } catch (apiErr) {
      console.error('[seller-moderation] Groq vision API error (failing open):', apiErr?.message)
      return { pass: true }
    }

    console.log(`[seller-moderation] Vision reply: "${reply}"`)
    if (reply.toUpperCase().startsWith('NO')) return { pass: true }
    return { pass: false, reason: 'Your primary photo appears to be a logo or graphic. Please use an actual photo of the property as your main photo.' }
  } catch (err) {
    console.error('[seller-moderation] checkImage unexpected error:', err?.message)
    return { pass: true }
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function moderateSellerProperty(propertyId) {
  try {
    const { data: property } = await supabase
      .from('properties')
      .select('id, slug, seo_title, address, city, state, zipcode, description, repairs, status, seller_id, inspection_report_url, contract_url, property_images(image_url, sort_order)')
      .eq('id', propertyId)
      .single()

    if (!property || property.status !== 'under_review') return

    const fullAddress = [property.address, property.city, property.state, property.zipcode].filter(Boolean).join(', ')

    console.log(`[seller-moderation] Starting review for property ${propertyId} — "${property.seo_title || fullAddress}"`)

    const failures = []

    // 1. Text checks
    console.log(`[seller-moderation] Checking description...`)
    const descResult = await checkText(property.description, fullAddress)
    console.log(`[seller-moderation] Description: ${descResult.pass ? 'PASS' : `FAIL — ${descResult.reason}`}`)
    if (!descResult.pass) failures.push(`Description: ${descResult.reason}`)

    console.log(`[seller-moderation] Checking repairs...`)
    const repairsResult = await checkText(property.repairs, fullAddress)
    console.log(`[seller-moderation] Repairs: ${repairsResult.pass ? 'PASS' : `FAIL — ${repairsResult.reason}`}`)
    if (!repairsResult.pass) failures.push(`Repairs: ${repairsResult.reason}`)

    // 2. Document URL checks
    if (property.inspection_report_url) {
      console.log(`[seller-moderation] Checking inspection report URL...`)
      const inspResult = await checkDocument(property.inspection_report_url, 'Inspection report')
      console.log(`[seller-moderation] Inspection report: ${inspResult.pass ? 'PASS' : `FAIL — ${inspResult.reason}`}`)
      if (!inspResult.pass) failures.push(`Inspection report: ${inspResult.reason}`)
    }
    if (property.contract_url) {
      console.log(`[seller-moderation] Checking contract URL...`)
      const contractResult = await checkDocument(property.contract_url, 'Contract')
      console.log(`[seller-moderation] Contract: ${contractResult.pass ? 'PASS' : `FAIL — ${contractResult.reason}`}`)
      if (!contractResult.pass) failures.push(`Contract: ${contractResult.reason}`)
    }

    // 3. Primary photo check — only verify the featured photo isn't a logo/graphic
    const images = (property.property_images || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    if (images.length > 0) {
      console.log(`[seller-moderation] Checking primary photo for logos/graphics...`)
      const imgResult = await checkImage(images[0].image_url)
      console.log(`[seller-moderation] Primary photo: ${imgResult.pass ? 'PASS' : `FAIL — ${imgResult.reason}`}`)
      if (!imgResult.pass) failures.push(imgResult.reason)
    }

    if (failures.length > 0) {
      const { data: claimed } = await supabase
        .from('properties')
        .update({ status: 'rejected', rejection_reason: failures.join('. ') })
        .eq('id', propertyId)
        .eq('status', 'under_review')
        .select('id')
        .maybeSingle()

      if (!claimed) return

      console.log(`[seller-moderation] Property ${propertyId} rejected:`, failures.join('; '))

      if (property.seller_id) {
        await supabase.from('notifications').insert({
          recipient_id: property.seller_id,
          recipient_type: 'seller',
          type: 'listing_rejected',
          title: 'Your listing needs updates',
          body: `"${property.seo_title || property.address}" was not approved. Please fix the issues and resubmit.`,
          is_read: false,
        })

        const { data: seller } = await supabase
          .from('seller_applications')
          .select('email, contact_person_name')
          .eq('id', property.seller_id)
          .single()

        if (seller?.email) {
          await sendRejectionEmail(seller, property, failures)
        }
      }
      return
    }

    // All checks passed
    const { data: claimed } = await supabase
      .from('properties')
      .update({ status: 'active', rejection_reason: null })
      .eq('id', propertyId)
      .eq('status', 'under_review')
      .select('id')
      .maybeSingle()

    if (!claimed) return

    console.log(`[seller-moderation] Property ${propertyId} approved and set to active`)

    // #5 Pro-plan usage nudge — the listing is now LIVE, so it counts toward the
    // seller's plan cap. This is the correct trigger point: publishing creates the
    // listing as 'under_review' first, so a nudge fired at publish time would miss
    // this slot. Count live listings now and email if the seller is at their cap.
    // Best-effort, deduped per threshold per period — never affects moderation.
    if (property.seller_id) {
      try {
        const { count: liveCount } = await supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', property.seller_id)
          .in('status', ['active', 'published'])
        await maybeProUsageNudge(supabase, property.seller_id, liveCount ?? 0)

        // Also enroll into the admin dynamic follow-up engine (#4 listing_went_live).
        // No-op until ADMIN_AUTOMATIONS_URL is configured — safe to ship pre-cutover.
        const sellerUrl = (process.env.NEXT_PUBLIC_SELLER_PORTAL_URL || 'https://sell.deelmap.com').replace(/\/+$/, '')
        const [{ data: sa }, { data: sp }] = await Promise.all([
          supabase.from('seller_applications').select('email').eq('id', property.seller_id).maybeSingle(),
          supabase.from('seller_plans').select('current_period_start').eq('seller_id', property.seller_id).maybeSingle(),
        ])
        if (sa?.email) await enrollAutomation('listing_went_live', property.seller_id, {
          seller_id: property.seller_id, email: sa.email,
          period: (sp?.current_period_start || '').slice(0, 10),
          upgrade_url: `${sellerUrl}/plans/upgrade/enterprise`,
        })
      } catch (e) {
        console.error('[seller-moderation] pro-usage nudge error:', e?.message)
      }
    }

    // Alert buyers whose buy box matches this newly-live listing.
    // Non-blocking: never let an alert failure affect the publish/moderation flow.
    try {
      const buyerAppUrl = (process.env.NEXT_PUBLIC_BUYER_APP_URL || 'https://deelmap.com').replace(/\/$/, '')
      fetch(`${buyerAppUrl}/api/buyer/notify-buy-box`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'manual', id: propertyId }),
      }).catch((e) => console.error('[seller-moderation] notify-buy-box failed:', e))
    } catch (e) {
      console.error('[seller-moderation] notify-buy-box error:', e)
    }

    if (property.seller_id) {
      await supabase.from('notifications').insert({
        recipient_id: property.seller_id,
        recipient_type: 'seller',
        type: 'listing_approved',
        title: 'Your listing is live!',
        body: `"${property.seo_title || property.address}" has been approved and is now live on the marketplace.`,
        is_read: false,
      })

      const { data: seller } = await supabase
        .from('seller_applications')
        .select('email, contact_person_name')
        .eq('id', property.seller_id)
        .single()

      if (seller?.email) {
        await sendApprovalEmail(seller, property)
      }
    }
  } catch (err) {
    console.error('[seller-moderation] Unexpected error for property', propertyId, err)
  }
}

// ─── Emails ──────────────────────────────────────────────────────────────────

async function sendRejectionEmail(seller, property, failures) {
  try {
    const name = seller.contact_person_name || 'there'
    const title = property.seo_title || property.address || 'Your listing'
    const fullAddress = [property.address, property.city, property.state, property.zipcode].filter(Boolean).join(', ')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sell.deelmap.com'
    const dashboardUrl = `${baseUrl}/properties`

    const sortedImages = (property.property_images || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const featuredImage = sortedImages[0]?.image_url || null

    const issuesList = failures.map(f => `<li style="margin-bottom:6px;font-size:13px;color:#737370;line-height:1.5">${f}</li>`).join('')
    const issuesText = failures.map((f, i) => `${i + 1}. ${f}`).join('\n')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr><td style="background:#ffffff;padding:12px 40px;text-align:center;border-bottom:2px solid #D03839">
        <img src="https://deelmap.com/deelmap.png" alt="DeelMap" height="72" style="display:inline-block;height:72px;width:auto;border:0" />
      </td></tr>
      <tr><td style="padding:36px 40px 32px;background:#ffffff">
        <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${name},</p>
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Your listing needs some updates</h1>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#737370">We reviewed your listing but couldn't approve it yet. Please fix the issues below and resubmit.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
          <tr><td style="background:#FAFAF8;border:1px solid #E8E8E4;border-radius:4px;overflow:hidden">
            ${featuredImage ? `<img src="${featuredImage}" alt="Property photo" width="600" style="display:block;width:100%;max-height:220px;object-fit:cover;border-bottom:1px solid #E8E8E4" />` : ''}
            <div style="padding:16px 20px">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:1.1px;text-transform:uppercase;color:#A8A8A4">Your listing</p>
              <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1A1816;line-height:1.3">${title}</p>
              ${fullAddress ? `<p style="margin:0;font-size:13px;color:#737370">${fullAddress}</p>` : ''}
            </div>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
          <tr><td style="background:#FEF3F2;border:1px solid #FECDCA;border-radius:4px;padding:16px 20px">
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#B42318">Issues to fix</p>
            <ul style="margin:0;padding-left:18px">${issuesList}</ul>
          </td></tr>
        </table>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="background:#D03839;border-radius:4px">
            <a href="${dashboardUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.1px">Update your listing &rarr;</a>
          </td></tr>
        </table>
        <p style="margin:28px 0 0;font-size:12px;color:#A8A8A4;line-height:1.6">Once you've made the updates, resubmit your listing for review from your <a href="${dashboardUrl}" style="color:#D03839;text-decoration:none">dashboard</a>.</p>
      </td></tr>
      <tr><td style="background:#ffffff;border-top:1px solid #E8E8E4;padding:20px 40px;text-align:center">
        <p style="margin:0 0 4px;font-size:12px;color:#A8A8A4">Questions? <a href="https://sell.deelmap.com/support" style="color:#737370;text-decoration:underline">Reach us through our Contact Us page</a></p>
        <p style="margin:0;font-size:12px;color:#A8A8A4">© 2026 DeelMap. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

    await resend.emails.send({
      from: 'DeelMap <notifications@deelmap.com>',
      to: [seller.email],
      subject: 'Your DeelMap listing needs updates',
      html,
      text: `Hi ${name},\n\nYour listing "${title}" needs updates:\n\n${issuesText}\n\nUpdate it at: ${dashboardUrl}\n\nThanks,\nThe DeelMap Team`,
    })
    console.log(`[seller-moderation] Rejection email sent to ${seller.email}`)
  } catch (err) {
    console.error('[seller-moderation] Failed to send rejection email:', err)
  }
}

async function sendApprovalEmail(seller, property) {
  try {
    const name = seller.contact_person_name || 'there'
    const title = property.seo_title || property.address || 'Your listing'
    const fullAddress = [property.address, property.city, property.state, property.zipcode].filter(Boolean).join(', ')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sell.deelmap.com'
    const buyerBaseUrl = process.env.NEXT_PUBLIC_BUYER_APP_URL || 'https://deelmap.com'
    const listingUrl = `${buyerBaseUrl}/${property.slug || property.id}`

    const sortedImages = (property.property_images || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const featuredImage = sortedImages[0]?.image_url || null

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr><td style="background:#ffffff;padding:12px 40px;text-align:center;border-bottom:2px solid #D03839">
        <img src="https://deelmap.com/deelmap.png" alt="DeelMap" height="72" style="display:inline-block;height:72px;width:auto;border:0" />
      </td></tr>
      <tr><td style="padding:36px 40px 32px;background:#ffffff">
        <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${name},</p>
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Your listing is now live</h1>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#737370">Great news — your listing has passed our review and is now live on the DeelMap marketplace. Verified buyers can find and contact you about it.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
          <tr><td style="background:#FAFAF8;border:1px solid #E8E8E4;border-radius:4px;overflow:hidden">
            ${featuredImage ? `<img src="${featuredImage}" alt="Property photo" width="600" style="display:block;width:100%;max-height:220px;object-fit:cover;border-bottom:1px solid #E8E8E4" />` : ''}
            <div style="padding:16px 20px">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:1.1px;text-transform:uppercase;color:#A8A8A4">Your listing</p>
              <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1A1816;line-height:1.3">${title}</p>
              ${fullAddress ? `<p style="margin:0;font-size:13px;color:#737370">${fullAddress}</p>` : ''}
            </div>
          </td></tr>
        </table>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:28px">
          <tr><td style="background:#E4F5EC;border:1px solid #9FDBB8;border-radius:4px;padding:10px 16px">
            <p style="margin:0;font-size:13px;font-weight:600;color:#0F6E56">&#10003;&nbsp; Active — visible to all buyers on DeelMap</p>
          </td></tr>
        </table>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="background:#D03839;border-radius:4px">
            <a href="${listingUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.1px">View your listing &rarr;</a>
          </td></tr>
        </table>
        <p style="margin:28px 0 0;font-size:12px;color:#A8A8A4;line-height:1.6">You'll be notified when buyers reach out. Manage your listings any time from your <a href="${baseUrl}/properties" style="color:#D03839;text-decoration:none">dashboard</a>.</p>
      </td></tr>
      <tr><td style="background:#ffffff;border-top:1px solid #E8E8E4;padding:20px 40px;text-align:center">
        <p style="margin:0 0 4px;font-size:12px;color:#A8A8A4">Questions? <a href="https://sell.deelmap.com/support" style="color:#737370;text-decoration:underline">Reach us through our Contact Us page</a></p>
        <p style="margin:0;font-size:12px;color:#A8A8A4">© 2026 DeelMap. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

    await resend.emails.send({
      from: 'DeelMap <notifications@deelmap.com>',
      to: [seller.email],
      subject: 'Your listing is live on DeelMap',
      html,
      text: `Hi ${name},\n\nYour listing "${title}" is now live on DeelMap.\n\nView it at: ${listingUrl}\n\nThanks,\nThe DeelMap Team`,
    })
    console.log(`[seller-moderation] Approval email sent to ${seller.email}`)
  } catch (err) {
    console.error('[seller-moderation] Failed to send approval email:', err)
  }
}
