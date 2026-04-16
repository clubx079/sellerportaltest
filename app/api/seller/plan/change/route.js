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
    const { seller_id, new_plan_type } = await request.json()
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
      return NextResponse.json({ error: 'Your subscription is set to cancel. Please remove the cancellation in Settings before changing plans.' }, { status: 400 })
    }

    if (plan.plan_type === new_plan_type) {
      return NextResponse.json({ error: 'Already on this plan' }, { status: 400 })
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

    const billingCycle = plan.billing_cycle || 'monthly'
    const newPriceId = PRICE_IDS[`${new_plan_type}_${billingCycle}`]
    if (!newPriceId) {
      return NextResponse.json({ error: `Price not configured for ${new_plan_type}_${billingCycle}` }, { status: 400 })
    }

    // Retrieve current subscription
    const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id)
    const currentPriceId = sub.items.data[0]?.price?.id
    const periodEnd = sub.current_period_end // Unix timestamp

    if (!currentPriceId) {
      return NextResponse.json({ error: 'Could not read current subscription price' }, { status: 500 })
    }

    // Schedule the plan change to take effect at the end of the current billing period
    const existingScheduleId = sub.schedule
      ? (typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id)
      : null

    if (existingScheduleId) {
      // Update the existing schedule: replace phase 2 with the new plan
      const currentSchedule = await stripe.subscriptionSchedules.retrieve(existingScheduleId)
      const phase1 = currentSchedule.phases[0]

      await stripe.subscriptionSchedules.update(existingScheduleId, {
        phases: [
          {
            items: phase1.items.map(i => ({
              price: typeof i.price === 'string' ? i.price : i.price.id,
              quantity: i.quantity || 1,
            })),
            end_date: periodEnd,
            proration_behavior: 'none',
          },
          {
            items: [{ price: newPriceId, quantity: 1 }],
            proration_behavior: 'none',
          },
        ],
      })
    } else {
      // Create a new schedule from the current subscription, then set phase 2
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
    }

    const scheduledFor = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

    return NextResponse.json({ success: true, scheduled_for: scheduledFor, new_plan_type })
  } catch (err) {
    console.error('[plan/change]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
