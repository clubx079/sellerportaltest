import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

function getSellerId(request) {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  return null
}

// GET /api/team — returns org + members for the current seller
export async function GET(request) {
  const sellerId = getSellerId(request)
  if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data: seller } = await supabase
      .from('seller_applications')
      .select('id, contact_person_name, email, org_id')
      .eq('id', sellerId)
      .maybeSingle()

    if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 })

    const { data: plan } = await supabase
      .from('seller_plans')
      .select('plan_type, status')
      .eq('seller_id', sellerId)
      .maybeSingle()

    const isEnterprise = plan?.plan_type === 'enterprise'
    const isTrialing = plan?.status === 'trialing'

    // Check if owner of an org
    const { data: ownedOrg } = await supabase
      .from('seller_organizations')
      .select('*')
      .eq('owner_seller_id', sellerId)
      .maybeSingle()

    if (ownedOrg) {
      const { data: rows } = await supabase
        .from('org_members')
        .select('*')
        .eq('org_id', ownedOrg.id)
        .order('invited_at', { ascending: true })
      return NextResponse.json({
        org: { ...ownedOrg, is_owner: true },
        members: rows || [],
        memberOrgs: [],
        isEnterprise,
        isTrialing,
        seller,
      })
    }

    // Not an owner — find all orgs this seller is a member of
    const { data: memberships } = await supabase
      .from('org_members')
      .select('org_id, role, status')
      .eq('seller_id', sellerId)
      .eq('status', 'active')

    const memberOrgIds = (memberships || []).map(m => m.org_id)

    let memberOrgs = []
    if (memberOrgIds.length > 0) {
      const { data: orgs } = await supabase
        .from('seller_organizations')
        .select('id, name, owner_seller_id')
        .in('id', memberOrgIds)

      // Enrich with owner name
      const ownerIds = [...new Set((orgs || []).map(o => o.owner_seller_id))]
      const { data: owners } = await supabase
        .from('seller_applications')
        .select('id, contact_person_name, email')
        .in('id', ownerIds)

      const ownerMap = Object.fromEntries((owners || []).map(o => [o.id, o]))
      memberOrgs = (orgs || []).map(org => ({
        ...org,
        is_owner: false,
        owner: ownerMap[org.owner_seller_id] || null,
      }))
    }

    // Active org = seller.org_id (or first one if not set)
    const activeOrgId = seller.org_id || memberOrgIds[0] || null
    const activeOrg = memberOrgs.find(o => o.id === activeOrgId) || memberOrgs[0] || null

    let members = []
    if (activeOrg) {
      const { data: rows } = await supabase
        .from('org_members')
        .select('*')
        .eq('org_id', activeOrg.id)
        .order('invited_at', { ascending: true })
      members = rows || []
    }

    return NextResponse.json({
      org: activeOrg,
      members,
      memberOrgs,
      isEnterprise,
      isTrialing,
      seller,
    })
  } catch (err) {
    console.error('[team GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/team — invite a member (or create org first if none exists)
export async function POST(request) {
  const sellerId = getSellerId(request)
  if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { email, name, orgName, role } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const { data: seller } = await supabase
      .from('seller_applications')
      .select('id, contact_person_name, email')
      .eq('id', sellerId)
      .maybeSingle()

    if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 })

    // Check plan
    const { data: plan } = await supabase
      .from('seller_plans')
      .select('plan_type, status')
      .eq('seller_id', sellerId)
      .maybeSingle()

    if (plan?.plan_type !== 'enterprise') {
      return NextResponse.json({ error: 'Enterprise plan required to invite team members' }, { status: 403 })
    }

    if (plan?.status === 'trialing') {
      return NextResponse.json({ error: 'TRIAL_ACTIVE' }, { status: 403 })
    }

    // Get or create org
    let { data: org } = await supabase
      .from('seller_organizations')
      .select('*')
      .eq('owner_seller_id', sellerId)
      .maybeSingle()

    if (!org) {
      const { data: newOrg, error: orgErr } = await supabase
        .from('seller_organizations')
        .insert({ owner_seller_id: sellerId, name: orgName || seller.contact_person_name + "'s Team" })
        .select()
        .single()
      if (orgErr) return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
      org = newOrg
    }

    // Enforce 3-member limit
    const { count: memberCount } = await supabase
      .from('org_members')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)

    if (memberCount >= 3) {
      return NextResponse.json({ error: 'MEMBER_LIMIT', message: 'Team limit reached. Enterprise plans allow up to 3 team members.' }, { status: 403 })
    }

    // Check if already invited
    const { data: existing } = await supabase
      .from('org_members')
      .select('id, status')
      .eq('org_id', org.id)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'This email has already been invited' }, { status: 409 })
    }

    // Create member row with auto-generated invite_token
    const memberRole = role === 'admin' ? 'admin' : 'member'
    const { data: member, error: memberErr } = await supabase
      .from('org_members')
      .insert({ org_id: org.id, email: email.trim().toLowerCase(), name: name || null, role: memberRole })
      .select()
      .single()

    if (memberErr) return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })

    // Send invite email
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sell.deelmap.com'}/team/accept?token=${member.invite_token}`

    const inviterName = (seller.contact_person_name || 'Someone').replace(/</g, '&lt;')
    const inviteeName = (name || email).replace(/</g, '&lt;')

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Deelmap <notifications@deelmap.com>',
      to: email.trim().toLowerCase(),
      subject: `${seller.contact_person_name} invited you to join their DeelMap team`,
      html: `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr>
        <td style="background:#ffffff;padding:12px 40px;text-align:center;border-bottom:2px solid #D03839">
          <img src="https://sellerportaldeelmap-production-bea8.up.railway.app/deelmap.png" alt="Deelmap" height="72" style="display:inline-block;height:72px;width:auto;border:0" />
        </td>
      </tr>
      <tr>
        <td style="padding:36px 40px 32px;background:#ffffff">
          <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${inviteeName},</p>
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">You've been invited to join a team</h1>
          <p style="margin:0 0 28px;font-size:14px;line-height:1.65;color:#737370"><strong style="color:#1A1816">${inviterName}</strong> has invited you to join their team on the DeelMap Seller Portal. Click the button below to create your account and get started.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr><td>
              <a href="${acceptUrl}" style="display:inline-block;background:#D03839;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:4px;text-decoration:none;letter-spacing:0.1px">Accept Invitation</a>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr>
              <td style="background:#FAFAF8;border:1px solid #E8E8E4;border-radius:4px;padding:16px 20px">
                <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#A8A8A4">Invitation link</p>
                <p style="margin:0;font-size:12px;color:#737370;word-break:break-all;line-height:1.5">${acceptUrl}</p>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:12px;color:#A8A8A4;line-height:1.6">This link expires in 7 days. If you weren't expecting this invitation, you can safely ignore this email.</p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;border-top:1px solid #E8E8E4;padding:20px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#A8A8A4">© 2026 Deelmap. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </td></tr></table>
</body></html>`,
    })

    return NextResponse.json({ member, org })
  } catch (err) {
    console.error('[team POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
