import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@airostack/client'

const REFERRAL_COUPON_ID = 'huzBZPT2'

function getClients() {
  return {
    stripe: new Stripe(process.env.STRIPE_SECRET_KEY),
    supabase: createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY),
  }
}

// GET — fetch seller's referral code + usage stats
export async function GET(request) {
  try {
    const sellerId = request.headers.get('x-seller-id')
    if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { supabase, stripe } = getClients()

    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('user_id', sellerId)
      .eq('user_type', 'seller')
      .maybeSingle()

    if (!referral) return NextResponse.json({ referral: null })

    const { data: usages } = await supabase
      .from('promo_code_usages')
      .select('stripe_payment_intent_id, portal')
      .eq('promo_code_id', referral.promo_code_id)

    const timesRedeemed = usages?.length || 0

    // Mirror the payout cron exactly so what we DISPLAY matches what gets PAID:
    // only succeeded payments count, and earnings mature after a 30-day hold
    // (the window that catches refunds/chargebacks). 20% of the original fee.
    const HOLD_DAYS = 30
    const now = Date.now()
    const earnFor = (p) => {
      let originalAmount = p.amount
      try {
        const desc = JSON.parse(p.description)
        const base = desc.base?.amount || 0
        const addons = (desc.addons || []).reduce((s, a) => s + (a.amount || 0), 0)
        if (base + addons > 0) originalAmount = base + addons
      } catch {}
      return Math.round(originalAmount * 0.20)
    }

    let totalEarnings = 0   // lifetime, succeeded only
    let maturedEarnings = 0 // succeeded AND past the 30-day hold (what the cron pays from)
    if (usages && usages.length > 0) {
      const piIds = usages.map(u => u.stripe_payment_intent_id).filter(Boolean)
      if (piIds.length > 0) {
        const { data: payments } = await supabase
          .from('payments')
          .select('amount, description, stripe_payment_intent_id, status, created_at')
          .in('stripe_payment_intent_id', piIds)

        for (const p of (payments || [])) {
          if (p.status && p.status !== 'succeeded') continue
          const e = earnFor(p)
          totalEarnings += e
          const aged = p.created_at && (now - new Date(p.created_at).getTime()) / 86400000 >= HOLD_DAYS
          if (aged) maturedEarnings += e
        }
      }
    }

    return NextResponse.json({
      referral: {
        ...referral,
        times_redeemed: timesRedeemed,
        estimated_earnings: totalEarnings,
        matured_earnings: maturedEarnings,
        held_earnings: totalEarnings - maturedEarnings,
      }
    })
  } catch (err) {
    console.error('[referral GET]', err)
    return NextResponse.json({ error: err.message || 'Failed to load referral' }, { status: 500 })
  }
}

// POST — generate referral code for seller
export async function POST(request) {
  try {
    const sellerId = request.headers.get('x-seller-id')
    if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { supabase, stripe } = getClients()

    const { data: existing } = await supabase
      .from('referrals')
      .select('*')
      .eq('user_id', sellerId)
      .eq('user_type', 'seller')
      .maybeSingle()

    if (existing) return NextResponse.json({ referral: { ...existing, times_redeemed: 0, estimated_earnings: 0 } })

    const { data: seller } = await supabase
      .from('seller_applications')
      .select('contact_person_name')
      .eq('id', sellerId)
      .maybeSingle()

    const firstName = (seller?.contact_person_name || '').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)
    const suffix = Math.floor(1000 + Math.random() * 9000)
    const code = firstName ? `${firstName}${suffix}` : `DEEL${suffix}`

    const promoCode = await stripe.promotionCodes.create({
      promotion: { type: 'coupon', coupon: REFERRAL_COUPON_ID },
      code,
      metadata: { user_id: sellerId, user_type: 'seller' },
    })

    const { data: referral, error } = await supabase
      .from('referrals')
      .insert({
        user_id: sellerId,
        user_type: 'seller',
        promo_code_id: promoCode.id,
        promo_code: code,
        stripe_coupon_id: REFERRAL_COUPON_ID,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ referral: { ...referral, times_redeemed: 0, estimated_earnings: 0 } })
  } catch (err) {
    console.error('[referral POST]', err)
    return NextResponse.json({ error: err.message || 'Failed to generate referral code' }, { status: 500 })
  }
}
