import { createClient } from '@airostack/client'

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
 * Resolves the caller's access level for a given seller id (the Bearer id).
 *
 * Owner-vs-member: a caller is treated as having FULL access (isOwner: true) when
 * they are NOT an active member of an org they don't own — i.e. a personal/solo
 * account, or the owner of the org they're acting in. Only an active org_members
 * row (where the org is owned by someone else) makes them a member, and then
 * their permissions come from that org_members.permissions jsonb.
 *
 * Returns { isOwner, permissions, effectiveSellerId }.
 */
export async function getCallerAccess(sellerId) {
  if (!sellerId) return { isOwner: true, permissions: {}, effectiveSellerId: sellerId }

  const supabase = getSupabase()

  const { data: seller } = await supabase
    .from('seller_applications')
    .select('org_id')
    .eq('id', sellerId)
    .maybeSingle()

  // No org at all → personal account → full access.
  if (!seller?.org_id) return { isOwner: true, permissions: {}, effectiveSellerId: sellerId }

  const { data: org } = await supabase
    .from('seller_organizations')
    .select('owner_seller_id')
    .eq('id', seller.org_id)
    .maybeSingle()

  // Org row missing/owner unknown → treat as personal → full access.
  if (!org?.owner_seller_id) return { isOwner: true, permissions: {}, effectiveSellerId: sellerId }

  // They own this org → full access.
  if (org.owner_seller_id === sellerId) {
    return { isOwner: true, permissions: {}, effectiveSellerId: sellerId }
  }

  // They are a member → read their permissions for this org.
  let permissions = {}
  const { data: member, error: memErr } = await supabase
    .from('org_members')
    .select('permissions')
    .eq('org_id', seller.org_id)
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .maybeSingle()
  // If the permissions column doesn't exist yet, fail safe to empty (no perms).
  if (!memErr && member?.permissions && typeof member.permissions === 'object') {
    permissions = member.permissions
  }

  return { isOwner: false, permissions, effectiveSellerId: org.owner_seller_id }
}

/**
 * Permission gate. Owners/personal accounts always pass; members pass only when
 * the specific permission key is explicitly true.
 */
export function requirePermission(access, key) {
  if (!access) return false
  if (access.isOwner) return true
  return access.permissions?.[key] === true
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
