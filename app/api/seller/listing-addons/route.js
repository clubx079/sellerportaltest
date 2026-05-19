import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const getClients = () => ({
  supabase: createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY),
  stripe: new Stripe(process.env.STRIPE_SECRET_KEY),
})

const ADD_ON_PRICES = {
  highlight: { label: 'Highlight Listing',                      amount: 999  },
  boost:     { label: 'Boost Listing',                          amount: 1499 },
  homepage:  { label: 'Feature on Homepage',                    amount: 2900 },
  bundle:    { label: 'Full Visibility Bundle (Highlight + Boost)', amount: 2200 },
}

const ADDON_DAYS = { highlight: 30, boost: 7, homepage: 7, bundle: 30 }

export async function POST(request) {
  const { supabase, stripe } = getClients()
  try {
    const { seller_id, add_ons = [], property_id, promo_code_id } = await request.json()

    if (!seller_id) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

    const validAddOns = add_ons.filter(id => ADD_ON_PRICES[id])
    if (validAddOns.length === 0) return NextResponse.json({ error: 'No valid add-ons provided' }, { status: 400 })

    // Lifetime-free accounts get addons at no charge — record directly, skip Stripe
    const { data: appCheck } = await supabase
      .from('seller_applications')
      .select('admin_notes')
      .eq('id', seller_id)
      .maybeSingle()

    if (appCheck?.admin_notes === 'LIFETIME_FREE') {
      const now = new Date()
      for (const addonId of validAddOns) {
        const days = ADDON_DAYS[addonId] || 7
        await supabase.from('listing_addons').insert({
          property_id:              property_id || null,
          seller_id,
          addon_type:               addonId,
          stripe_payment_intent_id: null,
          amount_paid:              0,
          days_purchased:           days,
          starts_at:                now.toISOString(),
          ends_at:                  new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
          status:                   'active',
        })
      }
      return NextResponse.json({ free: true, add_ons: validAddOns })
    }

    const baseAmount = validAddOns.reduce((sum, id) => sum + ADD_ON_PRICES[id].amount, 0)

    let amount = baseAmount
    let discountInfo = null
    if (promo_code_id) {
      const promoCode = await stripe.promotionCodes.retrieve(promo_code_id, { expand: ['promotion.coupon'] })
      const coupon = promoCode.promotion?.coupon
      if (coupon && typeof coupon !== 'string' && coupon.valid) {
        const discountAmount = coupon.percent_off
          ? Math.round(baseAmount * coupon.percent_off / 100)
          : Math.min(coupon.amount_off, baseAmount)
        amount = Math.max(baseAmount - discountAmount, 50)
        discountInfo = {
          type: coupon.percent_off ? 'percent' : 'fixed',
          value: coupon.percent_off || coupon.amount_off / 100,
          discountAmount,
        }
      }
    }

    // Resolve Stripe customer
    let customerId = null
    const { data: planRow } = await supabase
      .from('seller_plans')
      .select('stripe_customer_id')
      .eq('seller_id', seller_id)
      .not('stripe_customer_id', 'is', null)
      .maybeSingle()

    if (planRow?.stripe_customer_id) {
      customerId = planRow.stripe_customer_id
    } else {
      const { data: appRow } = await supabase
        .from('seller_applications')
        .select('stripe_customer_id')
        .eq('id', seller_id)
        .maybeSingle()
      customerId = appRow?.stripe_customer_id || null
    }

    if (!customerId) return NextResponse.json({ error: 'No Stripe customer found for this seller' }, { status: 404 })

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        seller_id,
        property_id: property_id || '',
        add_ons: validAddOns.join(','),
        original_amount: String(baseAmount),
        discount_amount: String(baseAmount - amount),
        ...(promo_code_id ? { promo_code_id } : {}),
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount,
      baseAmount,
      discountInfo,
      add_ons: validAddOns,
    })
  } catch (err) {
    console.error('[listing-addons]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
