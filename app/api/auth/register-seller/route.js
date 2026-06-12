import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/password'
import { createClient } from '@supabase/supabase-js'
import { emailSellerWelcome, sendSellerEmail } from '@/lib/sellerEmail'

const getSupabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function getClientIP(request) {
  const cf = request.headers.get('cf-connecting-ip')
  if (cf) return cf
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP
  return null
}

export async function POST(request) {
  const supabase = getSupabase()
  try {
    const { first_name, last_name, email, password } = await request.json()

    if (!first_name || !last_name || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('seller_applications')
      .select('id, status')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existing) {
      if (existing.status === 'onboarding') {
        return NextResponse.json({ seller_id: existing.id, resumed: true })
      }
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    // Create seller_applications row
    const contact_person_name = `${first_name} ${last_name}`
    const clientIP = getClientIP(request)
    const baseRow = {
      contact_person_name,
      email: email.trim().toLowerCase(),
      password: await hashPassword(password),
      phone: '',
      business_name: contact_person_name,
      business_type: 'individual',
      deals_per_month: 'not_specified',
      primary_markets: '',
      property_types: [],
      description: '',
      status: 'onboarding',
    }

    let { data: seller, error } = await supabase
      .from('seller_applications')
      .insert({ ...baseRow, ip_address: clientIP || null })
      .select('id')
      .single()

    // Fallback if ip_address column doesn't exist yet (migration not run)
    if (error && /ip_address/i.test(error.message || '')) {
      ;({ data: seller, error } = await supabase
        .from('seller_applications')
        .insert(baseRow)
        .select('id')
        .single())
    }

    if (error) {
      console.error('[register-seller]', error)
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    // Link referral attribution — check for ref cookie set by middleware
    const refCookie = request.cookies.get('deelmap_ref')?.value
    if (refCookie) {
      const { data: linkRef } = await supabase
        .from('link_referrals')
        .select('referrer_id')
        .eq('ref_code', refCookie.toUpperCase())
        .maybeSingle()

      if (linkRef && linkRef.referrer_id !== seller.id) {
        await supabase.from('link_referral_signups').insert({
          ref_code: refCookie.toUpperCase(),
          referrer_id: linkRef.referrer_id,
          referred_id: seller.id,
        }).catch(() => {})
      }
    }

    // Welcome email — fire and forget so a Resend hiccup never blocks signup
    ;(async () => {
      try {
        const { subject, html } = emailSellerWelcome({ name: contact_person_name, email: email.trim().toLowerCase() })
        await sendSellerEmail({ to: email.trim().toLowerCase(), subject, html })
      } catch (e) {
        console.error('[register-seller] welcome email failed:', e?.message || e)
      }
    })()

    return NextResponse.json({ seller_id: seller.id })
  } catch (err) {
    console.error('[register-seller]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
