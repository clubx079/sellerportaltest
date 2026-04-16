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
    const { seller_id } = await request.json()
    if (!seller_id) return NextResponse.json({ error: 'seller_id is required' }, { status: 400 })

    const { data: plan, error: planErr } = await supabase
      .from('seller_plans')
      .select('stripe_subscription_id, status, current_period_end, plan_type, billing_cycle')
      .eq('seller_id', seller_id)
      .maybeSingle()

    if (planErr || !plan?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    if (plan.status === 'canceled') {
      return NextResponse.json({ error: 'Subscription is already canceled' }, { status: 400 })
    }

    if (plan.status === 'canceling') {
      return NextResponse.json({ error: 'Subscription cancellation is already pending' }, { status: 400 })
    }

    // Cancel at period end — subscription stays active until current_period_end
    await stripe.subscriptions.update(plan.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // Mark locally as 'canceling' so UI reflects state immediately without waiting for webhook
    await supabase
      .from('seller_plans')
      .update({ status: 'canceling', updated_at: new Date().toISOString() })
      .eq('seller_id', seller_id)

    return NextResponse.json({
      success: true,
      period_end: plan.current_period_end,
    })
  } catch (err) {
    console.error('[plan/cancel]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
