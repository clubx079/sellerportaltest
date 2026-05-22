import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  try {
    const { subscription_id } = await request.json()
    if (!subscription_id) return NextResponse.json({ error: 'subscription_id required' }, { status: 400 })

    const subscription = await stripe.subscriptions.retrieve(subscription_id, {
      expand: ['discount.coupon', 'items.data.price'],
    })

    const item = subscription.items?.data?.[0]
    const price = item?.price
    const unitAmount = price?.unit_amount || 0
    const interval = price?.recurring?.interval || 'month'

    const discount = subscription.discount
    let discountAmount = 0
    let couponName = null

    if (discount?.coupon) {
      const coupon = discount.coupon
      couponName = coupon.name || coupon.id
      if (coupon.percent_off) {
        discountAmount = Math.round(unitAmount * coupon.percent_off / 100)
      } else if (coupon.amount_off) {
        discountAmount = coupon.amount_off
      }
    }

    return NextResponse.json({
      original_amount: unitAmount,
      discount_amount: discountAmount,
      discounted_amount: Math.max(0, unitAmount - discountAmount),
      coupon_name: couponName,
      interval,
      has_discount: discountAmount > 0,
    })
  } catch (err) {
    console.error('[billing/subscription-details]', err)
    return NextResponse.json({ has_discount: false })
  }
}
