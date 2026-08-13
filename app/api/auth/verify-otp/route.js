import { NextResponse } from 'next/server'
import { createClient } from '@airostack/client'
import { getPendingSignup, deletePendingSignup } from '@/lib/pendingSignupStore'

let otpStore = new Map()
if (typeof global !== 'undefined') {
  if (!global.sellerOtpStore) global.sellerOtpStore = new Map()
  otpStore = global.sellerOtpStore
}

export async function POST(request) {
  try {
    const { email, otp } = await request.json()

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })
    }

    // ── Validate the OTP (stored keyed by the email as the client sent it) ──
    const stored = otpStore.get(email)

    if (!stored) {
      return NextResponse.json({ error: 'OTP not found or expired' }, { status: 400 })
    }
    if (stored.expires < Date.now()) {
      otpStore.delete(email)
      return NextResponse.json({ error: 'OTP has expired' }, { status: 400 })
    }
    if (stored.otp !== otp.toString()) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    }
    otpStore.delete(email)

    // ── OTP is valid — ONLY NOW does anything touch the database. Create (or
    //    resume) the seller_applications row from the stashed pending signup. ──
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const normalizedEmail = String(email).trim().toLowerCase()
    const pending = getPendingSignup(normalizedEmail)

    const { data: existing } = await supabase
      .from('seller_applications')
      .select('id, status')
      .eq('email', normalizedEmail)
      .maybeSingle()

    // Never touch a real (already-created) account from this route.
    if (existing && existing.status !== 'onboarding') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    // Resume: a prior verified-but-unfinished signup already has a row. Mark it
    // verified and refresh name/phone/password from the latest step-1 entry.
    if (existing) {
      const update = { phone_verified: true }
      if (pending) {
        update.phone = pending.phone || ''
        update.contact_person_name = pending.contact_person_name
        update.password = pending.password_hash
      }
      const { error: updErr } = await supabase
        .from('seller_applications')
        .update(update)
        .eq('id', existing.id)
      if (updErr) {
        console.error('[seller verify-otp] resume update failed:', updErr)
        return NextResponse.json({ error: 'Could not complete verification' }, { status: 500 })
      }
      deletePendingSignup(normalizedEmail)
      return NextResponse.json({ success: true, seller_id: existing.id })
    }

    // Fresh signup — the pending record must still be present to create the row.
    if (!pending) {
      return NextResponse.json({ error: 'Your signup session expired. Please start again.' }, { status: 400 })
    }

    const baseRow = {
      contact_person_name: pending.contact_person_name,
      email: normalizedEmail,
      password: pending.password_hash,
      phone: pending.phone || '',
      phone_verified: true,
      business_name: pending.contact_person_name,
      business_type: 'individual',
      deals_per_month: 'not_specified',
      primary_markets: '',
      property_types: [],
      description: '',
      status: 'onboarding',
    }

    let { data: seller, error } = await supabase
      .from('seller_applications')
      .insert({ ...baseRow, ip_address: pending.ip_address || null })
      .select('id')
      .single()

    // Fallback if the ip_address column doesn't exist yet (migration not run)
    if (error && /ip_address/i.test(error.message || '')) {
      ;({ data: seller, error } = await supabase
        .from('seller_applications')
        .insert(baseRow)
        .select('id')
        .single())
    }

    if (error) {
      console.error('[seller verify-otp] insert failed:', error)
      return NextResponse.json({ error: 'Could not create your account' }, { status: 500 })
    }

    // Referral attribution — now that the row exists.
    if (pending.ref_code) {
      const { data: linkRef } = await supabase
        .from('link_referrals')
        .select('referrer_id')
        .eq('ref_code', pending.ref_code.toUpperCase())
        .maybeSingle()
      if (linkRef && linkRef.referrer_id !== seller.id) {
        await supabase.from('link_referral_signups').insert({
          ref_code: pending.ref_code.toUpperCase(),
          referrer_id: linkRef.referrer_id,
          referred_id: seller.id,
        }).catch(() => {})
      }
    }

    deletePendingSignup(normalizedEmail)
    return NextResponse.json({ success: true, seller_id: seller.id })
  } catch (err) {
    console.error('[seller verify-otp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
