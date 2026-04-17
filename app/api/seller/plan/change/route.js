import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const PRICE_IDS = {
  pro_monthly:        process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_annual:         process.env.STRIPE_PRICE_PRO_ANNUAL,
  enterprise_monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
  enterprise_annual:  process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL,
}

const PLAN_RANK = { pro: 1, enterprise: 2 }

export async function POST(request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    const { seller_id, new_plan_type, billing_cycle: requested_cycle } = await request.json()
    if (!seller_id || !new_plan_type) {
      return NextResponse.json({ error: 'seller_id and new_plan_type are required' }, { status: 400 })
    }

    const { data: plan } = await supabase
      .from('seller_plans')
      .select('stripe_subscription_id, plan_type, billing_cycle, status, current_period_end')
      .eq('seller_id', seller_id)
      .maybeSingle()

    if (!plan?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    if (['canceled', 'past_due'].includes(plan.status)) {
      return NextResponse.json({ error: 'Your subscription must be active to change plans.' }, { status: 400 })
    }

    if (plan.status === 'canceling') {
      return NextResponse.json({
        error: 'Your subscription is set to cancel. Please remove the cancellation in Settings before changing plans.',
      }, { status: 400 })
    }

    const isDowngrade = (PLAN_RANK[new_plan_type] || 0) < (PLAN_RANK[plan.plan_type] || 0)

    // Downgrade guard: check active manual property count
    if (isDowngrade && new_plan_type === 'pro') {
      const { count } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', seller_id)
        .in('status', ['active', 'under_review'])

      if ((count || 0) > 10) {
        return NextResponse.json({
          error: `You have ${count} active listings. Please deactivate down to 10 before switching to Pro.`,
          active_count: count,
          requires_deactivation: true,
        }, { status: 422 })
      }
    }

    // Use the billing cycle from the request if provided, otherwise fall back to current
    const billingCycle = (['monthly', 'annual'].includes(requested_cycle) ? requested_cycle : null)
      || plan.billing_cycle
      || 'monthly'

    // Block only if both plan type AND billing cycle are unchanged
    if (plan.plan_type === new_plan_type && plan.billing_cycle === billingCycle) {
      return NextResponse.json({ error: 'Already on this plan and billing cycle' }, { status: 400 })
    }

    const newPriceId = PRICE_IDS[`${new_plan_type}_${billingCycle}`]
    if (!newPriceId) {
      return NextResponse.json({ error: `Price not configured for ${new_plan_type}_${billingCycle}` }, { status: 400 })
    }

    // Retrieve current subscription from Stripe
    const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id)
    const currentItem = sub.items.data[0]
    const currentPriceId = currentItem?.price?.id
    const periodEnd = sub.current_period_end // Unix timestamp

    if (!currentPriceId) {
      return NextResponse.json({ error: 'Could not read current subscription price' }, { status: 500 })
    }
    if (!periodEnd) {
      return NextResponse.json({ error: 'Could not determine billing period end' }, { status: 500 })
    }

    // ── Trialing subscriptions: update price directly, trial continues unchanged ──
    // Subscription schedules cannot cleanly override trial phases, so we update
    // the subscription item directly. The trial end date stays the same and the
    // seller will be billed at the new plan's rate when the trial ends.
    if (sub.status === 'trialing') {
      await stripe.subscriptions.update(plan.stripe_subscription_id, {
        items: [{ id: currentItem.id, price: newPriceId, quantity: 1 }],
        proration_behavior: 'none',
      })

      // Sync the new plan to Supabase immediately so the UI reflects the change
      await supabase
        .from('seller_plans')
        .update({
          plan_type:    new_plan_type,
          billing_cycle: billingCycle,
          stripe_price_id: newPriceId,
          updated_at:   new Date().toISOString(),
        })
        .eq('seller_id', seller_id)

      const scheduledFor = new Date(periodEnd * 1000).toISOString()
      return NextResponse.json({ success: true, scheduled_for: scheduledFor, new_plan_type, immediate: true })
    }

    // ── Active (non-trial) subscriptions: schedule the change at period end ────

    // Release any existing schedule first to avoid stale phase data
    const existingScheduleId = sub.schedule
      ? (typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id)
      : null

    if (existingScheduleId) {
      await stripe.subscriptionSchedules.release(existingScheduleId)
    }

    // Create a fresh schedule from the current subscription, then define two phases:
    // (1) keep current plan until period end, (2) new plan after.
    const schedule = await stripe.subscriptionSchedules.createFromSubscription(plan.stripe_subscription_id, {
      end_behavior: 'release',
    })

    await stripe.subscriptionSchedules.update(schedule.id, {
      phases: [
        {
          items: [{ price: currentPriceId, quantity: 1 }],
          end_date: periodEnd,
          proration_behavior: 'none',
        },
        {
          items: [{ price: newPriceId, quantity: 1 }],
          proration_behavior: 'none',
        },
      ],
    })

    const scheduledFor = new Date(periodEnd * 1000).toISOString()
    return NextResponse.json({ success: true, scheduled_for: scheduledFor, new_plan_type })
  } catch (err) {
    console.error('[plan/change]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
