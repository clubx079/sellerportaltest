import { NextResponse } from 'next/server'

const DOCUSEAL_BASE = 'https://api.docuseal.com'

function docusealHeaders() {
  return { 'X-Auth-Token': process.env.DOCUSEAL_API_KEY, 'Content-Type': 'application/json' }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const type = searchParams.get('type')

  try {
    if (type === 'templates') {
      const res = await fetch(`${DOCUSEAL_BASE}/templates?limit=50`, {
        headers: docusealHeaders(),
        cache: 'no-store',
      })
      const json = await res.json()
      return NextResponse.json(json.data || [])
    }

    const url = new URL(`${DOCUSEAL_BASE}/submissions`)
    url.searchParams.set('limit', '100')

    const res = await fetch(url.toString(), {
      headers: docusealHeaders(),
      cache: 'no-store',
    })

    const json = await res.json()
    let submissions = json.data || []

    if (email) {
      submissions = submissions.filter(s =>
        s.metadata?.seller_email === email ||
        s.submitters?.some(sub => sub.email?.toLowerCase() === email.toLowerCase())
      )
    }

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
      headers: docusealHeaders(),
      body: JSON.stringify({
        template_id: templateId,
        submitters: [{ role: 'First Submitter', email: buyerEmail, name: buyerName || buyerEmail }],
        metadata: { seller_email: sellerEmail, property: property || '' },
      }),
    })

    const json = await res.json()
    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 })
  }
}
