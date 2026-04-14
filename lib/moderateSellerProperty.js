import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

// ─── Static profanity filter ──────────────────────────────────────────────────

// Includes root words — regex uses partial match so "fucking" matches "fuck" root
const PROFANITY_ROOTS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'damn', 'piss',
  'cock', 'dick', 'pussy', 'ass', 'whore', 'slut', 'nigger', 'nigga',
  'faggot', 'retard', 'motherfuck', 'bullshit', 'crap',
]

function staticProfanityCheck(text) {
  if (!text?.trim()) return { pass: true }
  const lower = text.toLowerCase()
  const found = PROFANITY_ROOTS.find(root => lower.includes(root))
  if (found) return { pass: false, reason: `Contains inappropriate language` }
  return { pass: true }
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

  // Strip HTML tags — TextEditor stores content as HTML
  const text = stripHtml(rawText)
  if (!text.trim()) return { pass: true }

  console.log(`[seller-moderation] checkText — stripped text: "${text.slice(0, 200)}"`)

  // Static check first — never depends on AI
  const staticResult = staticProfanityCheck(text)
  if (!staticResult.pass) {
    console.log(`[seller-moderation] checkText — STATIC FAIL: ${staticResult.reason}`)
    return staticResult
  }
  console.log(`[seller-moderation] checkText — static check passed, calling Groq...`)

  // AI check
  try {
    const addressContext = address ? `Property address: ${address}\n\n` : ''
    const reply = await groqChat([
      {
        role: 'system',
        content: `You are a strict content moderator for a real estate wholesale marketplace. Your job is to ensure listing descriptions are professional and genuinely about the property. You must reply with ONLY "PASS" or "FAIL: <reason>" — nothing else.`,
      },
      {
        role: 'user',
        content: `Review this listing description. Reply "PASS" ONLY if it reads like a professional property listing describing real estate details (condition, features, location, investment potential, repairs needed, etc.). Reply "FAIL: <reason>" for ANY of the following:\n- Negative rants or complaints about the property or anything else (e.g. "i hate this", "this is terrible", "worst property ever")\n- Offensive, aggressive, or hostile language\n- Random, vague, or nonsensical text\n- Personal opinions that are not relevant to a buyer\n- Anything that would embarrass a professional real estate marketplace\n\n${addressContext}Description:\n${text.slice(0, 1200)}`,
      },
    ], 'llama-3.3-70b-versatile')
    console.log(`[seller-moderation] checkText — Groq reply: "${reply}"`)
    if (reply.toUpperCase().startsWith('PASS')) return { pass: true }
    return { pass: false, reason: reply.replace(/^FAIL:\s*/i, '').slice(0, 200) }
  } catch (err) {
    console.log(`[seller-moderation] checkText — Groq error: ${err.message}`)
    // 401 = bad/missing API key — don't silently approve, reject for manual review
    if (err.message?.includes('401')) {
      return { pass: false, reason: 'Content moderation unavailable (configuration error). Please contact support.' }
    }
    // Transient errors (network, 429, 5xx) — pass through
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
      return { pass: false, reason: `${type} is hosted on an untrusted external domain (${parsed.hostname}). Please re-upload through Deelmap.` }
    }
    return { pass: true }
  } catch {
    return { pass: false, reason: `Invalid ${type} URL` }
  }
}

async function checkImage(url) {
  if (!url) return { pass: true }
  try {
    const reply = await groqChat([{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url } },
        { type: 'text', text: 'You are moderating a real estate marketplace. Is this image appropriate for a property listing? It should show property-related content (interior, exterior, yard, rooms, etc.). Reply with exactly "PASS" if appropriate, or "FAIL: <brief reason>" if it contains nudity, violence, graphic content, or is clearly not a property photo.' }
      ]
    }], 'llama-3.2-11b-vision-preview')
    if (reply.toUpperCase().startsWith('PASS')) return { pass: true }
    return { pass: false, reason: reply.replace(/^FAIL:\s*/i, '').slice(0, 200) }
  } catch {
    return { pass: true } // Don't block listing if vision check errors
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

    // 3. Image checks
    const images = (property.property_images || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    console.log(`[seller-moderation] Checking ${images.length} photo(s)...`)
    for (let i = 0; i < images.length; i++) {
      const imgResult = await checkImage(images[i].image_url)
      console.log(`[seller-moderation] Photo ${i + 1}/${images.length}: ${imgResult.pass ? 'PASS' : `FAIL — ${imgResult.reason}`}`)
      if (!imgResult.pass) failures.push(`Photo ${i + 1}: ${imgResult.reason}`)
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sellerportaldeelmap-production-bea8.up.railway.app'
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
        <img src="https://sellerportaldeelmap-production-bea8.up.railway.app/deelmap.png" alt="Deelmap" height="72" style="display:inline-block;height:72px;width:auto;border:0" />
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
        <p style="margin:0;font-size:12px;color:#A8A8A4">© 2026 Deelmap. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

    await resend.emails.send({
      from: 'Deelmap <noreply@deelmap.com>',
      to: [seller.email],
      subject: 'Your Deelmap listing needs updates',
      html,
      text: `Hi ${name},\n\nYour listing "${title}" needs updates:\n\n${issuesText}\n\nUpdate it at: ${dashboardUrl}\n\nThanks,\nThe Deelmap Team`,
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sellerportaldeelmap-production-bea8.up.railway.app'
    const buyerBaseUrl = process.env.NEXT_PUBLIC_BUYER_APP_URL || 'https://deelmap-production-e7c2.up.railway.app'
    const listingUrl = `${buyerBaseUrl}/${property.slug || property.id}`

    const sortedImages = (property.property_images || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const featuredImage = sortedImages[0]?.image_url || null

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr><td style="background:#ffffff;padding:12px 40px;text-align:center;border-bottom:2px solid #D03839">
        <img src="https://sellerportaldeelmap-production-bea8.up.railway.app/deelmap.png" alt="Deelmap" height="72" style="display:inline-block;height:72px;width:auto;border:0" />
      </td></tr>
      <tr><td style="padding:36px 40px 32px;background:#ffffff">
        <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${name},</p>
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Your listing is now live</h1>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#737370">Great news — your listing has passed our review and is now live on the Deelmap marketplace. Verified buyers can find and contact you about it.</p>
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
            <p style="margin:0;font-size:13px;font-weight:600;color:#0F6E56">&#10003;&nbsp; Active — visible to all buyers on Deelmap</p>
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
        <p style="margin:0;font-size:12px;color:#A8A8A4">© 2026 Deelmap. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

    await resend.emails.send({
      from: 'Deelmap <noreply@deelmap.com>',
      to: [seller.email],
      subject: 'Your listing is live on Deelmap',
      html,
      text: `Hi ${name},\n\nYour listing "${title}" is now live on Deelmap.\n\nView it at: ${listingUrl}\n\nThanks,\nThe Deelmap Team`,
    })
    console.log(`[seller-moderation] Approval email sent to ${seller.email}`)
  } catch (err) {
    console.error('[seller-moderation] Failed to send approval email:', err)
  }
}
