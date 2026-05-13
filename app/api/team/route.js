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

    // Check plan
    const { data: plan } = await supabase
      .from('seller_plans')
      .select('plan_type')
      .eq('seller_id', sellerId)
      .maybeSingle()

    const isEnterprise = plan?.plan_type === 'enterprise'

    // Find org where this seller is owner or member
    let org = null
    let members = []

    // Check if owner
    const { data: ownedOrg } = await supabase
      .from('seller_organizations')
      .select('*')
      .eq('owner_seller_id', sellerId)
      .maybeSingle()

    if (ownedOrg) {
      org = ownedOrg
      org.is_owner = true
    } else if (seller.org_id) {
      // Member of an org
      const { data: memberOrg } = await supabase
        .from('seller_organizations')
        .select('*')
        .eq('id', seller.org_id)
        .maybeSingle()
      if (memberOrg) {
        org = memberOrg
        org.is_owner = false
      }
    }

    if (org) {
      const { data: rows } = await supabase
        .from('org_members')
        .select('*')
        .eq('org_id', org.id)
        .order('invited_at', { ascending: true })
      members = rows || []
    }

    return NextResponse.json({ org, members, isEnterprise, seller })
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
    const { email, name, orgName } = await request.json()
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
      .select('plan_type')
      .eq('seller_id', sellerId)
      .maybeSingle()

    if (plan?.plan_type !== 'enterprise') {
      return NextResponse.json({ error: 'Enterprise plan required to invite team members' }, { status: 403 })
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
    const { data: member, error: memberErr } = await supabase
      .from('org_members')
      .insert({ org_id: org.id, email: email.trim().toLowerCase(), name: name || null })
      .select()
      .single()

    if (memberErr) return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })

    // Send invite email
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sell.deelmap.com'}/team/accept?token=${member.invite_token}`

    await resend.emails.send({
      from: 'DeelMap <notifications@deelmap.com>',
      to: email.trim().toLowerCase(),
      subject: `${seller.contact_person_name} invited you to join their DeelMap team`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <img src="https://deelmap.com/assets/logo.svg" alt="DeelMap" width="120" style="margin-bottom: 24px;" />
          <h2 style="font-size: 20px; font-weight: 700; color: #1A1816; margin: 0 0 8px;">You've been invited</h2>
          <p style="color: #444441; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            <strong>${seller.contact_person_name}</strong> has invited you to join their team on DeelMap Seller Portal.
          </p>
          <a href="${acceptUrl}" style="display: inline-block; background: #D03839; color: white; font-size: 14px; font-weight: 600; padding: 10px 24px; border-radius: 6px; text-decoration: none;">
            Accept Invitation
          </a>
          <p style="color: #737370; font-size: 12px; margin: 24px 0 0;">
            This link expires in 7 days. If you weren't expecting this, you can ignore this email.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ member, org })
  } catch (err) {
    console.error('[team POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
