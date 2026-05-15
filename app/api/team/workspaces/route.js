import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSellerId(request) {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  return null
}

// GET /api/team/workspaces — returns available workspaces + current active one
export async function GET(request) {
  const sellerId = getSellerId(request)
  if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    const { data: seller } = await supabase
      .from('seller_applications')
      .select('org_id')
      .eq('id', sellerId)
      .maybeSingle()

    // Get all orgs this seller is an active member of
    const { data: memberships } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('seller_id', sellerId)
      .eq('status', 'active')

    const available = [{ id: null, name: 'Personal' }]

    if (memberships?.length) {
      const orgIds = memberships.map(m => m.org_id)
      const { data: orgs } = await supabase
        .from('seller_organizations')
        .select('id, name')
        .in('id', orgIds)

      if (orgs?.length) available.push(...orgs.map(o => ({ id: o.id, name: o.name })))
    }

    const current = seller?.org_id
      ? available.find(w => w.id === seller.org_id) || null
      : null

    return NextResponse.json({ current, available })
  } catch (err) {
    console.error('[team/workspaces]', err)
    return NextResponse.json({ current: null, available: [{ id: null, name: 'Personal' }] })
  }
}
