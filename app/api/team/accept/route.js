import { NextResponse } from 'next/server'
import { hashPassword, verifyPassword } from '@/lib/password'
import { createClient } from '@airostack/client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getClientIP(request) {
  const cf = request.headers.get('cf-connecting-ip')
  if (cf) return cf
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP
  return null
}

// Invitations are valid for 7 days (matches the invite email copy). A resend
// refreshes invited_at, restarting the window.
const INVITE_TTL_DAYS = 7
function isInviteExpired(member) {
  if (!member?.invited_at) return false // no timestamp (legacy) → don't expire
  return Date.now() - new Date(member.invited_at).getTime() > INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
}

// GET /api/team/accept?token=xxx — validate token, return member info
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  try {
    const { data: member } = await supabase
      .from('org_members')
      .select('id, email, name, status, org_id, invite_token, invited_at')
      .eq('invite_token', token)
      .maybeSingle()

    if (!member) return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
    if (member.status === 'active') return NextResponse.json({ error: 'Invitation already accepted' }, { status: 409 })
    if (isInviteExpired(member)) return NextResponse.json({ error: 'This invitation has expired. Ask the team owner to resend it.' }, { status: 410 })

    const { data: org } = await supabase
      .from('seller_organizations')
      .select('name')
      .eq('id', member.org_id)
      .maybeSingle()

    const { data: existingAccount } = await supabase
      .from('seller_applications')
      .select('id')
      .eq('email', member.email)
      .maybeSingle()

    return NextResponse.json({ member, orgName: org?.name, hasExistingAccount: !!existingAccount })
  } catch (err) {
    console.error('[team/accept GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/team/accept — create account and accept invite
export async function POST(request) {
  try {
    const { token, name, password, isLogin } = await request.json()
    if (!token || !password) return NextResponse.json({ error: 'Token and password required' }, { status: 400 })
    if (!isLogin && password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

    const { data: member } = await supabase
      .from('org_members')
      .select('*')
      .eq('invite_token', token)
      .maybeSingle()

    if (!member) return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
    if (member.status === 'active') return NextResponse.json({ error: 'Invitation already accepted' }, { status: 409 })
    if (isInviteExpired(member)) return NextResponse.json({ error: 'This invitation has expired. Ask the team owner to resend it.' }, { status: 410 })

    const { data: org } = await supabase
      .from('seller_organizations')
      .select('*')
      .eq('id', member.org_id)
      .maybeSingle()

    const displayName = name || member.name || member.email.split('@')[0]

    // Check if account already exists for this email
    const { data: existing } = await supabase
      .from('seller_applications')
      .select('id, org_id, password')
      .eq('email', member.email)
      .maybeSingle()

    let sellerId
    if (existing) {
      // Verify password matches existing account
      if (!(await verifyPassword(password, existing.password))) {
        return NextResponse.json({ error: 'Incorrect password for your existing account' }, { status: 401 })
      }
      sellerId = existing.id
      await supabase
        .from('seller_applications')
        .update({ org_id: member.org_id })
        .eq('id', sellerId)
    } else {
      // Create new seller account
      const nameParts = displayName.split(' ')
      const firstName = nameParts[0] || displayName
      const lastName = nameParts.slice(1).join(' ') || ''

      const clientIP = getClientIP(request)
      const baseRow = {
        contact_person_name: displayName,
        email: member.email,
        password: await hashPassword(password),
        phone: '',
        business_name: displayName,
        business_type: 'individual',
        deals_per_month: 'not_specified',
        primary_markets: '',
        property_types: [],
        description: '',
        status: 'approved',
        org_id: member.org_id,
      }

      let { data: newSeller, error: sellerErr } = await supabase
        .from('seller_applications')
        .insert({ ...baseRow, ip_address: clientIP || null })
        .select('id')
        .single()

      // Fallback if ip_address column doesn't exist yet (migration not run)
      if (sellerErr && /ip_address/i.test(sellerErr.message || '')) {
        ;({ data: newSeller, error: sellerErr } = await supabase
          .from('seller_applications')
          .insert(baseRow)
          .select('id')
          .single())
      }

      if (sellerErr) {
        console.error('[team/accept] create seller error:', sellerErr)
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
      }
      sellerId = newSeller.id
    }

    // Update org_member to active
    await supabase
      .from('org_members')
      .update({ status: 'active', seller_id: sellerId, accepted_at: new Date().toISOString(), name: displayName })
      .eq('id', member.id)

    return NextResponse.json({
      seller_id: sellerId,
      email: member.email,
      name: displayName,
      org: { id: org?.id, name: org?.name },
    })
  } catch (err) {
    console.error('[team/accept POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
