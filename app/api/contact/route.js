import { NextResponse } from 'next/server'

// Seller help/support submissions are recorded on the shared Monday board
// "Deelmap Contact & Support" (same board as the buyer website). Server-side only.
const MONDAY_API_URL = 'https://api.monday.com/v2'
const BOARD_ID = '18415712401'
const COL = {
  email:   'email_mm3xn91w',
  subject: 'text_mm3xvsgr',
  message: 'long_text_mm3x43s0',
  source:  'color_mm3xenj9',
  status:  'color_mm3x7w8f',
  date:    'date_mm3xegaz',
}

export async function POST(request) {
  const token = process.env.MONDAY_API_KEY
  if (!token) {
    return NextResponse.json({ error: 'Support form is not configured.' }, { status: 500 })
  }
  try {
    const { name, email, message, subject } = await request.json()
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Name, email and message are required' }, { status: 400 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const columnValues = {
      [COL.email]:   { email, text: email },
      [COL.subject]: subject || '',
      [COL.message]: message,
      [COL.source]:  { label: 'Seller Portal' },
      [COL.status]:  { label: 'New' },
      [COL.date]:    { date: today },
    }

    const query = `mutation ($bid: ID!, $name: String!, $cols: JSON!) {
      create_item(board_id: $bid, item_name: $name, column_values: $cols, create_labels_if_missing: true) { id }
    }`
    const res = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2023-10' },
      body: JSON.stringify({ query, variables: { bid: BOARD_ID, name: name.trim(), cols: JSON.stringify(columnValues) } }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.errors) {
      console.error('Support Monday error:', json?.errors || res.status)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Support submit error:', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
