import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getSellerId(request) {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  return null
}

// PATCH /api/team/[id] — update a member's permissions
export async function PATCH(request, { params }) {
  const sellerId = getSellerId(request)
  if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id: memberId } = await params
    const { permissions } = await request.json()

    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Invalid permissions' }, { status: 400 })
    }

    const { data: member } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('id', memberId)
      .maybeSingle()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const { data: org } = await supabase
      .from('seller_organizations')
      .select('owner_seller_id')
      .eq('id', member.org_id)
      .maybeSingle()

    if (!org || org.owner_seller_id !== sellerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await supabase.from('org_members').update({ permissions, role: 'member' }).eq('id', memberId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[team PATCH id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/team/[id] — remove a member
export async function DELETE(request, { params }) {
  const sellerId = getSellerId(request)
  if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id: memberId } = await params

    const { data: member } = await supabase
      .from('org_members')
      .select('org_id, seller_id')
      .eq('id', memberId)
      .maybeSingle()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const { data: org } = await supabase
      .from('seller_organizations')
      .select('owner_seller_id')
      .eq('id', member.org_id)
      .maybeSingle()

    if (!org || org.owner_seller_id !== sellerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (member.seller_id) {
      await supabase
        .from('seller_applications')
        .update({ org_id: null })
        .eq('id', member.seller_id)
    }

    await supabase.from('org_members').delete().eq('id', memberId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[team DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
