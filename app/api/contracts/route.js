import { NextResponse } from 'next/server'

const DOCUSEAL_BASE = 'https://api.docuseal.com'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  try {
    const url = new URL(`${DOCUSEAL_BASE}/submissions`)
    url.searchParams.set('limit', '50')
    if (email) url.searchParams.set('q', email)

    const res = await fetch(url.toString(), {
      headers: { 'X-Auth-Token': process.env.DOCUSEAL_API_KEY },
      cache: 'no-store',
    })

    const json = await res.json()
    let submissions = json.data || []

    if (email) {
      submissions = submissions.filter(s =>
        s.submitters?.some(sub => sub.email?.toLowerCase() === email.toLowerCase())
      )
    }

    return NextResponse.json(submissions)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
