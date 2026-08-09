import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@airostack/client'

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    const { seller_id } = await request.json()
    if (!seller_id) {
      return NextResponse.json({ error: 'seller_id is required' }, { status: 400 })
    }

    const { data: plan, error: planErr } = await supabase
      .from('seller_plans')
      .select('stripe_subscription_id, plan_type, billing_cycle')
      .eq('seller_id', seller_id)
      .eq('status', 'trialing')
      .maybeSingle()

    if (planErr || !plan?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active trial found' }, { status: 404 })
    }

    // End trial immediately — Stripe invoices and charges the card on file
    await stripe.subscriptions.update(plan.stripe_subscription_id, {
      trial_end: 'now',
    })

    // Re-fetch to get the final period dates (the update response may not have them yet)
    const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id)

    const now = new Date()
    const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : now.toISOString()
    // Fallback: Stripe sometimes returns 0 briefly while processing the invoice
    let periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
    if (!periodEnd) {
      const end = new Date(now)
      if (plan.billing_cycle === 'annual') end.setFullYear(end.getFullYear() + 1)
      else end.setMonth(end.getMonth() + 1)
      periodEnd = end.toISOString()
    }

    // Update local plan status
    await supabase
      .from('seller_plans')
      .update({
        status: sub.status,
        trial_ends_at: null,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_id', seller_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[end-trial]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
