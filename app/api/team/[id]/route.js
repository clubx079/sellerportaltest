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

// PATCH /api/team/[id] — update a member's permissions and/or phone
export async function PATCH(request, { params }) {
  const sellerId = getSellerId(request)
  if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id: memberId } = await params
    const body = await request.json()
    const { permissions, phone } = body

    const hasPermissions = permissions !== undefined
    const hasPhone = phone !== undefined

    if (!hasPermissions && !hasPhone) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    if (hasPermissions && (typeof permissions !== 'object' || Array.isArray(permissions) || permissions === null)) {
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

    const update = {}
    if (hasPermissions) {
      update.permissions = permissions
      update.role = 'member'
    }
    if (hasPhone) {
      const trimmed = typeof phone === 'string' ? phone.trim() : ''
      update.phone = trimmed || null
    }

    const { error: updateErr } = await supabase.from('org_members').update(update).eq('id', memberId)

    // Fallback if phone column doesn't exist yet (migration not run)
    if (updateErr && hasPhone && /phone/i.test(updateErr.message || '')) {
      const { phone: _, ...rest } = update
      if (Object.keys(rest).length > 0) {
        await supabase.from('org_members').update(rest).eq('id', memberId)
      }
      return NextResponse.json({ success: true, phoneSkipped: true, message: 'Phone column not available — run database/add_phone_to_team_members.sql' })
    }

    if (updateErr) return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
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
      .select('org_id, seller_id, invited_at')
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

    // Guard: the org owner can never be removed (they are the last owner and
    // cannot remove themselves). The owner is normally not an org_members row,
    // but reject defensively in case one was ever created.
    if (member.seller_id && member.seller_id === org.owner_seller_id) {
      return NextResponse.json({ error: 'The owner cannot be removed from the team' }, { status: 403 })
    }

    let accountDeleted = false
    if (member.seller_id) {
      // Decide delete-vs-unlink. A team-created sub-account is made at accept time
      // (its created_at is at/after the invite was sent); deleting it means a
      // re-invite starts fresh (the person sets a new password). A pre-existing
      // independent seller who merely joined is only unlinked — we never destroy
      // an account that existed before the invite (that would nuke their own data).
      const { data: acct } = await supabase
        .from('seller_applications')
        .select('id, created_at')
        .eq('id', member.seller_id)
        .maybeSingle()

      const invitedAt = member.invited_at ? new Date(member.invited_at).getTime() : 0
      const createdAt = acct?.created_at ? new Date(acct.created_at).getTime() : 0
      const isTeamSubAccount = !!acct && invitedAt > 0 && createdAt >= invitedAt

      // Remove the membership row first so any FK to it is cleared.
      await supabase.from('org_members').delete().eq('id', memberId)

      if (isTeamSubAccount) {
        const { error: delErr } = await supabase.from('seller_applications').delete().eq('id', member.seller_id)
        if (delErr) {
          // Constraint blocked the delete — fall back to unlinking so removal still succeeds.
          await supabase.from('seller_applications').update({ org_id: null }).eq('id', member.seller_id)
        } else {
          accountDeleted = true
        }
      } else {
        // Pre-existing independent account → only unlink it from the team.
        await supabase.from('seller_applications').update({ org_id: null }).eq('id', member.seller_id)
      }

      return NextResponse.json({ success: true, accountDeleted })
    }

    // Pending invite (never accepted, no account) → just delete the invite row.
    await supabase.from('org_members').delete().eq('id', memberId)
    return NextResponse.json({ success: true, accountDeleted })
  } catch (err) {
    console.error('[team DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
