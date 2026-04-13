import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    const { seller_id, subscription_id } = await request.json()
    if (!seller_id || !subscription_id) {
      return NextResponse.json({ error: 'seller_id and subscription_id are required' }, { status: 400 })
    }

    const sub = await stripe.subscriptions.retrieve(subscription_id)
    const meta = sub.metadata || {}

    await supabase.from('seller_plans').upsert({
      seller_id,
      plan_type:              meta.plan_type     || 'pro',
      billing_cycle:          meta.billing_cycle || 'monthly',
      status:                 sub.status === 'trialing' ? 'trialing' : 'active',
      stripe_customer_id:     typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
      stripe_subscription_id: sub.id,
      stripe_price_id:        sub.items.data[0]?.price?.id || null,
      trial_ends_at:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
      listings_used_this_period: 0,
    }, { onConflict: 'seller_id' })

    await supabase
      .from('seller_applications')
      .update({ status: 'approved' })
      .eq('id', seller_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[seller/plan/activate]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
