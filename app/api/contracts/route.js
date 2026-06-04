import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getWorkspaceSellerId } from '@/lib/workspace'
import { mapFieldValues, decorateTemplates } from '@/lib/contract-templates'

const DOCUSEAL_BASE = 'https://api.docuseal.com'

function dsHeaders() {
  return { 'X-Auth-Token': process.env.DOCUSEAL_API_KEY, 'Content-Type': 'application/json' }
}

async function resolveEffectiveEmail(request, fallbackEmail) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return fallbackEmail
  const sellerId = auth.slice(7).trim()
  try {
    const { effectiveId } = await getWorkspaceSellerId(sellerId)
    if (effectiveId === sellerId) return fallbackEmail
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data } = await supabase.from('seller_applications').select('email').eq('id', effectiveId).maybeSingle()
    return data?.email || fallbackEmail
  } catch { return fallbackEmail }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const type = searchParams.get('type')

  try {
    if (type === 'templates') {
      const res = await fetch(`${DOCUSEAL_BASE}/templates?limit=50`, { headers: dsHeaders(), cache: 'no-store' })
      const json = await res.json()
      // Decorate with friendly labels + sortOrder from TEMPLATE_CONFIG so the
      // wizard can show "Purchase Contract" instead of "(A to B) Deelmap…".
      return NextResponse.json(decorateTemplates(json.data || []))
    }

    if (type === 'document') {
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const res = await fetch(`${DOCUSEAL_BASE}/submissions/${id}`, { headers: dsHeaders(), cache: 'no-store' })
      const json = await res.json()
      const url = json.documents?.[0]?.url || null
      return NextResponse.json({ url })
    }

    // Lightweight status check for a single submission — used by the inbox/offers
    // to decide whether a contract is still awaiting the buyer or fully signed
    // (and, when signed, where its PDF lives).
    if (type === 'status') {
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const res = await fetch(`${DOCUSEAL_BASE}/submissions/${id}`, { headers: dsHeaders(), cache: 'no-store' })
      const json = await res.json()
      return NextResponse.json({
        status: json.status || null,
        document_url: json.combined_document_url || json.documents?.[0]?.url || null,
      })
    }

    const effectiveEmail = await resolveEffectiveEmail(request, email)

    // Get submission IDs belonging to this seller via application_key
    const subRes = await fetch(
      `${DOCUSEAL_BASE}/submitters?application_key=seller:${encodeURIComponent(effectiveEmail)}&limit=100`,
      { headers: dsHeaders(), cache: 'no-store' }
    )
    const subJson = await subRes.json()
    const sellerSubmissionIds = new Set((subJson.data || []).map(s => s.submission_id))

    if (sellerSubmissionIds.size === 0) return NextResponse.json([])

    const allRes = await fetch(`${DOCUSEAL_BASE}/submissions?limit=100`, { headers: dsHeaders(), cache: 'no-store' })
    const allJson = await allRes.json()
    const submissions = (allJson.data || []).filter(s => sellerSubmissionIds.has(s.id) && !s.archived_at)

    return NextResponse.json(submissions)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(request) {
  try {
    const {
      contractRole,
      buyerName,
      buyerEmail,
      property,
      sellerEmail,
      sellerName,
      templateId,
      // Wizard additions:
      // - field_values: normalized wizard keys (property_address, purchase_price, …)
      //   mapped via TEMPLATE_CONFIG to the exact DocuSeal field names.
      // - draft_id: when present, the originating contract_drafts row is flipped
      //   to status='sent' + docuseal_submission_id after a successful send.
      field_values,
      draft_id,
      // When the contract is created from an accepted offer (inbox "Create
      // Contract"), link the resulting DocuSeal submission back to that offer.
      offer_id,
    } = await request.json()

    if (!buyerEmail || !templateId || !sellerEmail) {
      return NextResponse.json({ error: 'buyerEmail, sellerEmail and templateId are required' }, { status: 400 })
    }

    // The Seller is always First Party (signs first). The creator may be on
    // either side: creator=Seller signs inline now; creator=Buyer → the Seller
    // (counterparty) is emailed to sign first and the creator signs after.
    const creatorIsSeller = contractRole !== 'buyer'
    const creatorEmail = creatorIsSeller ? sellerEmail : buyerEmail

    // Use a placeholder email for the Assignee — their real email is stored in metadata.
    // The webhook will PATCH the Assignee with their real email after the Assignor signs,
    // ensuring the Assignee cannot sign until the Assignor completes.
    const assigneePlaceholder = `pending-${Date.now()}@noreply.deelmap.com`

    // Translate normalized wizard fields → DocuSeal field names defined on the template.
    // ctx provides derived values (today's date, the assignor's name from profile)
    // that the wizard doesn't collect explicitly but the contract template needs.
    const today = new Date()
    const ctx = {
      sellerName: sellerName || sellerEmail,
      sellerEmail,
      buyerName: buyerName || buyerEmail,
      buyerEmail,
      today,
      todayISO: today.toISOString().slice(0, 10),
    }
    // Step 2's "Buyer Full Name" lives at body.buyerName, not inside field_values.
    // Inject it here so it lands in the contract's buyer_name field (line 1).
    const enrichedFieldValues = {
      ...(field_values || {}),
      buyer_name: (field_values && field_values.buyer_name) || buyerName || '',
    }
    const mappedValues = mapFieldValues(templateId, enrichedFieldValues, ctx)
    const hasValues = !!mappedValues && Object.keys(mappedValues).length > 0

    const submitters = [
      {
        role: 'First Party',
        email: sellerEmail,
        name: sellerName || sellerEmail,
        // creator=Seller signs inline (no email); creator=Buyer → email the Seller to sign first.
        send_email: !creatorIsSeller,
        // Tag with the creator's email so the seller-portal list finds contracts
        // they created, regardless of which side they're on.
        application_key: `seller:${creatorEmail}`,
        metadata: {
          assigneeEmail: buyerEmail,
          assigneeName: buyerName || buyerEmail,
        },
        ...(hasValues ? { values: mappedValues } : {}),
      },
      {
        role: 'Second Party',
        email: assigneePlaceholder,
        name: buyerName || buyerEmail,
        send_email: false,
        ...(hasValues ? { values: mappedValues } : {}),
      },
    ]

    const res = await fetch(`${DOCUSEAL_BASE}/submissions`, {
      method: 'POST',
      headers: dsHeaders(),
      body: JSON.stringify({
        template_id: Number(templateId),
        name: property || '',
        submitters,
      }),
    })

    const json = await res.json()
    if (!Array.isArray(json) || !json[0]) return NextResponse.json({ error: 'DocuSeal error' }, { status: 500 })

    const assignorSubmitter = json.find(s => s.role === 'First Party') || json[0]

    // PATCH the First Party submitter to explicitly set metadata (POST body metadata is ignored by DocuSeal)
    await fetch(`${DOCUSEAL_BASE}/submitters/${assignorSubmitter.id}`, {
      method: 'PATCH',
      headers: dsHeaders(),
      body: JSON.stringify({
        metadata: {
          assigneeEmail: buyerEmail,
          assigneeName: buyerName || buyerEmail,
        },
      }),
    })

    // If this came from a wizard draft, mark the draft as sent so it disappears
    // from the seller's drafts list and we keep an audit trail to the submission.
    if (draft_id) {
      try {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
        await supabase
          .from('contract_drafts')
          .update({
            status: 'sent',
            docuseal_submission_id: String(assignorSubmitter.submission_id),
            updated_at: new Date().toISOString(),
          })
          .eq('id', draft_id)
      } catch (e) {
        // Non-fatal — the DocuSeal submission already exists.
        console.error('Failed to mark draft as sent:', e?.message)
      }
    }

    // Link the submission back to the originating offer so the inbox/offers UI
    // can show "Contract sent" instead of prompting to create one again.
    // Non-fatal: contract creation must succeed even if the column/row update fails.
    if (offer_id) {
      try {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
        await supabase
          .from('offers')
          .update({
            contract_submission_id: String(assignorSubmitter.submission_id),
            contract_created_at: new Date().toISOString(),
          })
          .eq('id', offer_id)
      } catch (e) {
        console.error('Failed to link contract to offer:', e?.message)
      }
    }

    return NextResponse.json({
      submission_id: assignorSubmitter.submission_id,
      assignor_slug: assignorSubmitter.slug,
      // Creator signs inline only when they're the Seller (First Party). When the
      // creator is the Buyer, no embed — the Seller is emailed to sign first.
      ...(creatorIsSeller
        ? { embed_src: assignorSubmitter.embed_src }
        : { firstSignerName: sellerName || sellerEmail }),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const res = await fetch(`${DOCUSEAL_BASE}/submissions/${id}`, { method: 'DELETE', headers: dsHeaders() })
    if (!res.ok) return NextResponse.json({ error: 'Failed to delete' }, { status: res.status })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
