import { NextResponse } from 'next/server'

let otpStore = new Map()
if (typeof global !== 'undefined') {
  if (!global.sellerOtpStore) global.sellerOtpStore = new Map()
  otpStore = global.sellerOtpStore
}

if (typeof global !== 'undefined' && !global.sellerOtpCleanupInterval) {
  global.sellerOtpCleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, data] of otpStore.entries()) {
      if (data.expires < now) otpStore.delete(key)
    }
  }, 5 * 60 * 1000)
}

export async function POST(request) {
  try {
    const { phone, email } = await request.json()

    if (!phone || !email) {
      return NextResponse.json({ error: 'Phone and email are required' }, { status: 400 })
    }

    const digits = phone.replace(/\D/g, '')
    const e164Phone = digits.length === 10
      ? `+1${digits}`
      : (digits.length === 11 && digits.startsWith('1') ? `+${digits}` : null)

    if (!e164Phone) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    otpStore.set(email, { otp, expires: Date.now() + 10 * 60 * 1000 })

    const smsResponse = await fetch('https://ap.airosofts.com/api/external/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AIROSOFTS_SMS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.AIROSOFTS_SMS_FROM,
        to: e164Phone,
        message: `Your Deelmap verification code is ${otp}. Valid for 10 minutes. Do not share this code.`
      })
    })

    if (!smsResponse.ok) {
      const err = await smsResponse.json().catch(() => smsResponse.text())
      console.error('[seller send-otp] SMS error:', JSON.stringify(err))
      console.error('[seller send-otp] From:', process.env.AIROSOFTS_SMS_FROM, '| Key set:', !!process.env.AIROSOFTS_SMS_API_KEY)
      return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[seller send-otp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
