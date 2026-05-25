import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// GET /api/contracts/drafts/[id]
// Load a single draft (used by the wizard when resuming).
export async function GET(_request, { params }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('contract_drafts')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/contracts/drafts/[id]
// Used by auto-save: merges updatable fields onto the row.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await request.json()
    const updatable = ['template_id', 'property_id', 'buyer_name', 'buyer_email', 'field_values', 'status', 'docuseal_submission_id']
    const patch = { updated_at: new Date().toISOString() }
    for (const key of updatable) {
      if (key in body) patch[key] = body[key]
    }
    if (patch.template_id != null) patch.template_id = String(patch.template_id)

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('contract_drafts')
      .update(patch)
      .eq('id', id)
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/contracts/drafts/[id]
export async function DELETE(_request, { params }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = getSupabase()
    const { error } = await supabase.from('contract_drafts').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
