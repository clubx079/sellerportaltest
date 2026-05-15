import { NextResponse } from 'next/server'

const DOCUSEAL_BASE = 'https://api.docuseal.com'

function headers() {
  return { 'X-Auth-Token': process.env.DOCUSEAL_API_KEY, 'Content-Type': 'application/json' }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const type = searchParams.get('type')

  try {
    if (type === 'templates') {
      const res = await fetch(`${DOCUSEAL_BASE}/templates?limit=50`, { headers: headers(), cache: 'no-store' })
      const json = await res.json()
      return NextResponse.json(json.data || [])
    }

    // 1. Get submission IDs belonging to this seller via application_key
    const subRes = await fetch(
      `${DOCUSEAL_BASE}/submitters?application_key=seller:${encodeURIComponent(email)}&limit=100`,
      { headers: headers(), cache: 'no-store' }
    )
    const subJson = await subRes.json()
    const sellerSubmissionIds = new Set((subJson.data || []).map(s => s.submission_id))

    if (sellerSubmissionIds.size === 0) return NextResponse.json([])

    // 2. Fetch all submissions and keep only ones belonging to this seller
    const allRes = await fetch(`${DOCUSEAL_BASE}/submissions?limit=100`, { headers: headers(), cache: 'no-store' })
    const allJson = await allRes.json()
    const submissions = (allJson.data || []).filter(s => sellerSubmissionIds.has(s.id))

    return NextResponse.json(submissions)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { buyerName, buyerEmail, property, sellerEmail, sellerName, templateId } = await request.json()

    if (!buyerEmail || !templateId || !sellerEmail) {
      return NextResponse.json({ error: 'buyerEmail, sellerEmail and templateId are required' }, { status: 400 })
    }

    const res = await fetch(`${DOCUSEAL_BASE}/submissions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        template_id: Number(templateId),
        name: property || '',
        submitters: [
          {
            role: 'Assignor',
            email: sellerEmail,
            name: sellerName || sellerEmail,
            send_email: false,
            application_key: `seller:${sellerEmail}`,
          },
          {
            role: 'Assignee',
            email: buyerEmail,
            name: buyerName || buyerEmail,
            send_email: false,
          },
        ],
      }),
    })

    const json = await res.json()
    if (!Array.isArray(json) || !json[0]) return NextResponse.json({ error: 'DocuSeal error' }, { status: 500 })

    const assignorSubmitter = json.find(s => s.role === 'Assignor') || json[0]
    return NextResponse.json({ submission_id: assignorSubmitter.submission_id, assignor_slug: assignorSubmitter.slug })
  } catch {
    return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 })
  }
}
