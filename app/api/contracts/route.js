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
    const { buyerName, buyerEmail, property, sellerEmail, templateId } = await request.json()

    if (!buyerEmail || !templateId) {
      return NextResponse.json({ error: 'buyerEmail and templateId are required' }, { status: 400 })
    }

    const res = await fetch(`${DOCUSEAL_BASE}/submissions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        template_id: Number(templateId),
        name: property || '',
        submitters: [{
          role: 'First Submitter',
          email: buyerEmail,
          name: buyerName || buyerEmail,
          application_key: `seller:${sellerEmail}`,
        }],
      }),
    })

    const json = await res.json()
    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 })
  }
}
