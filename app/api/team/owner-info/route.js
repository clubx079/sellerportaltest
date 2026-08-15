import { NextResponse } from 'next/server'
import { createClient } from '@airostack/client'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const sellerId = searchParams.get('sellerId')
  if (!sellerId) return NextResponse.json({ error: 'sellerId required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data } = await supabase
    .from('seller_applications')
    .select('email, first_name, last_name, full_name')
    .eq('id', sellerId)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const name = data.full_name || [data.first_name, data.last_name].filter(Boolean).join(' ') || data.email
  return NextResponse.json({ email: data.email, name })
}
