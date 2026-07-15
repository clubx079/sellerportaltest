import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

let otpStore = new Map()
if (typeof global !== 'undefined') {
  if (!global.sellerOtpStore) global.sellerOtpStore = new Map()
  otpStore = global.sellerOtpStore
}

export async function POST(request) {
  try {
    const { email, otp, seller_id, phone } = await request.json()

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })
    }

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

    // Save phone number to seller_applications if provided
    if (seller_id && phone) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        )
        await supabase
          .from('seller_applications')
          .update({ phone, phone_verified: true })
          .eq('id', seller_id)
      } catch (dbErr) {
        console.error('[seller verify-otp] failed to save phone:', dbErr)
        // Don't fail the request — OTP was valid
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[seller verify-otp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
