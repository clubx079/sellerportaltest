import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// GET /api/contracts/drafts?seller_id=...
// Lists this seller's draft (status='draft') contracts, newest first.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('seller_id')
    if (!sellerId) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('contract_drafts')
      .select('id, template_id, property_id, buyer_name, buyer_email, field_values, status, created_at, updated_at')
      .eq('seller_id', sellerId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

// POST /api/contracts/drafts
// Insert a new draft row. Returns { id } for the wizard to track auto-save updates.
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      seller_id,
      template_id,
      property_id = null,
      buyer_name = null,
      buyer_email = null,
      field_values = {},
    } = body || {}

    if (!seller_id) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })
    if (!template_id) return NextResponse.json({ error: 'template_id required' }, { status: 400 })

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('contract_drafts')
      .insert({
        seller_id,
        template_id: String(template_id),
        property_id,
        buyer_name,
        buyer_email,
        field_values,
        status: 'draft',
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
