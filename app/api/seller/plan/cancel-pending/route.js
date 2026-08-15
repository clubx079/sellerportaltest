import { NextResponse } from 'next/server'
import { createClient } from '@airostack/client'
import Stripe from 'stripe'

export async function POST(request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    const { seller_id } = await request.json()
    if (!seller_id) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

    const { data: plan } = await supabase
      .from('seller_plans')
      .select('stripe_subscription_id')
      .eq('seller_id', seller_id)
      .maybeSingle()

    if (!plan?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id)
    const scheduleId = sub.schedule
      ? (typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id)
      : null

    if (!scheduleId) {
      return NextResponse.json({ error: 'No scheduled plan change found' }, { status: 404 })
    }

    // Release the schedule — subscription reverts to standard (no pending change)
    await stripe.subscriptionSchedules.release(scheduleId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[plan/cancel-pending]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
