import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function getClients() {
  return {
    stripe: new Stripe(process.env.STRIPE_SECRET_KEY),
    supabase: createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY),
  }
}

// POST — create Stripe Connect account + return onboarding URL
export async function POST(request) {
  try {
    const sellerId = request.headers.get('x-seller-id')
    if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { stripe, supabase } = getClients()

    const { data: referral } = await supabase
      .from('referrals')
      .select('id, stripe_account_id')
      .eq('user_id', sellerId)
      .eq('user_type', 'seller')
      .maybeSingle()

    if (!referral) return NextResponse.json({ error: 'No referral code found. Generate one first.' }, { status: 404 })

    let accountId = referral.stripe_account_id

    if (!accountId) {
      const account = await stripe.accounts.create({ type: 'express' })
      accountId = account.id
      await supabase.from('referrals').update({ stripe_account_id: accountId }).eq('id', referral.id)
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sell.deelmap.com'
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/referral?connect=refresh`,
      return_url: `${baseUrl}/referral?connect=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('[referral connect POST]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — check if onboarding is complete
export async function GET(request) {
  try {
    const sellerId = request.headers.get('x-seller-id')
    if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { stripe, supabase } = getClients()

    const { data: referral } = await supabase
      .from('referrals')
      .select('id, stripe_account_id, stripe_onboarding_complete')
      .eq('user_id', sellerId)
      .eq('user_type', 'seller')
      .maybeSingle()

    if (!referral?.stripe_account_id) return NextResponse.json({ connected: false })

    if (referral.stripe_onboarding_complete) return NextResponse.json({ connected: true })

    const account = await stripe.accounts.retrieve(referral.stripe_account_id)
    if (account.details_submitted) {
      await supabase.from('referrals').update({ stripe_onboarding_complete: true }).eq('id', referral.id)
      return NextResponse.json({ connected: true })
    }

    return NextResponse.json({ connected: false })
  } catch (err) {
    console.error('[referral connect GET]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
