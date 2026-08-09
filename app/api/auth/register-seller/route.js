import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/password'
import { createClient } from '@airostack/client'
import { setPendingSignup } from '@/lib/pendingSignupStore'

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
    // phone is accepted from step 1 but NOTHING is written to the database here.
    // register-seller only validates + stashes the pending signup; the
    // seller_applications row is created only after the OTP is verified (see
    // verify-otp). That is what keeps unverified people out of the DB entirely.
    const { first_name, last_name, email, password, phone } = await request.json()

    if (!first_name || !last_name || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Reject only if a REAL (already-created) account exists. A leftover
    // 'onboarding' row — a prior verified-but-unfinished signup — is allowed to
    // continue; verify-otp will update it rather than duplicate it.
    const { data: existing } = await supabase
      .from('seller_applications')
      .select('id, status')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existing && existing.status !== 'onboarding') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    // Stash the pending signup server-side (password hashed) until verification.
    // No DB write yet.
    setPendingSignup(normalizedEmail, {
      contact_person_name: `${first_name} ${last_name}`,
      email: normalizedEmail,
      password_hash: await hashPassword(password),
      phone: typeof phone === 'string' ? phone : '',
      ref_code: request.cookies.get('deelmap_ref')?.value || null,
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ pending: true })
  } catch (err) {
    console.error('[register-seller]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
