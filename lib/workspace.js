import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * Resolves the effective seller_id to use for workspace data queries.
 * If the seller is a team member, returns the owner's seller_id instead.
 * If the seller is an owner or solo, returns their own seller_id.
 */
export async function getWorkspaceSellerId(sellerId) {
  if (!sellerId) return { effectiveId: sellerId, isTeamMember: false }

  const supabase = getSupabase()

  const { data: seller } = await supabase
    .from('seller_applications')
    .select('org_id')
    .eq('id', sellerId)
    .maybeSingle()

  if (!seller?.org_id) return { effectiveId: sellerId, isTeamMember: false }

  const { data: org } = await supabase
    .from('seller_organizations')
    .select('owner_seller_id, name')
    .eq('id', seller.org_id)
    .maybeSingle()

  if (!org?.owner_seller_id) return { effectiveId: sellerId, isTeamMember: false }

  // Don't redirect if they ARE the owner (org they own, not member of)
  if (org.owner_seller_id === sellerId) return { effectiveId: sellerId, isTeamMember: false }

  return {
    effectiveId: org.owner_seller_id,
    isTeamMember: true,
    orgId: seller.org_id,
    orgName: org.name,
  }
}

/**
 * Returns all orgs a seller is a member of (not owner of).
 */
export async function getMemberOrgs(sellerId) {
  if (!sellerId) return []

  const supabase = getSupabase()

  const { data: memberships } = await supabase
    .from('org_members')
    .select('org_id, role, status')
    .eq('seller_id', sellerId)
    .eq('status', 'active')

  if (!memberships?.length) return []

  const orgIds = memberships.map(m => m.org_id)

  const { data: orgs } = await supabase
    .from('seller_organizations')
    .select('id, name, owner_seller_id')
    .in('id', orgIds)

  return (orgs || []).map(org => {
    const membership = memberships.find(m => m.org_id === org.id)
    return { ...org, role: membership?.role || 'member' }
  })
}
