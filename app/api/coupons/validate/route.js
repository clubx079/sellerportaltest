import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// GET /api/coupons/validate?code=SAVE20
export async function GET(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 })

  try {
    const promoCodes = await stripe.promotionCodes.list({ code: code.toUpperCase(), active: true, limit: 1 })

    if (!promoCodes.data.length) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired promo code' }, { status: 404 })
    }

    const promoCode = promoCodes.data[0]
    const coupon = promoCode.coupon

    if (!coupon.valid) {
      return NextResponse.json({ valid: false, error: 'This coupon is no longer valid' }, { status: 404 })
    }

    return NextResponse.json({
      valid: true,
      promo_code_id: promoCode.id,
      coupon_id: coupon.id,
      discount: coupon.percent_off
        ? { type: 'percent', value: coupon.percent_off }
        : { type: 'fixed', value: coupon.amount_off / 100 },
      duration: coupon.duration,
      duration_in_months: coupon.duration_in_months,
      name: coupon.name,
    })
  } catch (err) {
    return NextResponse.json({ valid: false, error: 'Failed to validate code' }, { status: 500 })
  }
}
