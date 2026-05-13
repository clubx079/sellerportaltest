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

// DELETE /api/team/[id] — remove a member
export async function DELETE(request, { params }) {
  const sellerId = getSellerId(request)
  if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const memberId = params.id

    // Verify caller owns the org that this member belongs to
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

    // If member had accepted and created an account, unlink their org
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
