import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const SELLER_PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sellerportaldeelmap-production-bea8.up.railway.app'

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  try {
    const { customer_id } = await request.json()
    if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

    const session = await stripe.billingPortal.sessions.create({
      customer: customer_id,
      return_url: `${SELLER_PORTAL_URL}/billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[billing/portal]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
