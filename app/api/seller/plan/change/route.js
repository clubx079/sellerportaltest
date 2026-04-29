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
    const { seller_id, new_plan_type, billing_cycle: requested_cycle, promo_code_id } = await request.json()
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

      if ((count || 0) > 5) {
        return NextResponse.json({
          error: `You have ${count} active listings. Please deactivate down to 5 before switching to Pro.`,
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
    const periodEnd = sub.current_period_end || sub.items?.data?.[0]?.current_period_end || sub.trial_end

    if (!currentPriceId) {
      return NextResponse.json({ error: 'Could not read current subscription price' }, { status: 500 })
    }
    if (!periodEnd) {
      return NextResponse.json({ error: 'Could not determine billing period end' }, { status: 500 })
    }

    // ── Trialing subscriptions: update price directly, trial continues unchanged ──
    if (sub.status === 'trialing') {
      const trialUpdateParams = {
        items: [{ id: currentItem.id, price: newPriceId, quantity: 1 }],
        proration_behavior: 'none',
      }
      if (promo_code_id) trialUpdateParams.discounts = [{ promotion_code: promo_code_id }]
      await stripe.subscriptions.update(plan.stripe_subscription_id, trialUpdateParams)

      await supabase
        .from('seller_plans')
        .update({
          plan_type:       new_plan_type,
          billing_cycle:   billingCycle,
          stripe_price_id: newPriceId,
          updated_at:      new Date().toISOString(),
        })
        .eq('seller_id', seller_id)

      const scheduledFor = new Date(periodEnd * 1000).toISOString()
      return NextResponse.json({ success: true, scheduled_for: scheduledFor, new_plan_type, immediate: true })
    }

    // ── Active subscriptions: all changes scheduled at period end ────────────
    // No immediate charges or prorations — the new plan starts on the next renewal.

    // Release any existing schedule so the subscription is unmanaged before we act on it
    const existingScheduleId = sub.schedule
      ? (typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id)
      : null

    if (existingScheduleId) {
      await stripe.subscriptionSchedules.release(existingScheduleId)
    }

    // Re-fetch subscription after schedule release to get fresh period dates
    const freshSub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id)
    const freshPeriodEnd = freshSub.current_period_end || freshSub.items?.data?.[0]?.current_period_end || freshSub.trial_end

    if (!freshPeriodEnd) {
      return NextResponse.json({ error: 'Could not determine billing period end' }, { status: 500 })
    }

    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: plan.stripe_subscription_id,
    })

    // Use dates directly from the schedule object — both values come from the same
    // Stripe response so they are guaranteed to be consistent with each other.
    const phase0StartDate = schedule.phases[0].start_date
    const phase0EndDate   = schedule.current_phase?.end_date || freshPeriodEnd

    console.log('[plan/change] schedule dates', { phase0StartDate, phase0EndDate, freshPeriodEnd })

    if (!phase0StartDate || !phase0EndDate || phase0StartDate >= phase0EndDate) {
      await stripe.subscriptionSchedules.release(schedule.id).catch(() => {})
      return NextResponse.json({
        error: `Invalid billing period dates (start=${phase0StartDate}, end=${phase0EndDate}). Please contact support.`,
      }, { status: 500 })
    }

    const phase2 = {
      items: [{ price: newPriceId, quantity: 1 }],
      proration_behavior: 'none',
    }
    if (promo_code_id) phase2.discounts = [{ promotion_code: promo_code_id }]

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release',
      phases: [
        {
          items: [{ price: currentPriceId, quantity: 1 }],
          start_date: phase0StartDate,
          end_date: phase0EndDate,
          proration_behavior: 'none',
        },
        phase2,
      ],
    })

    const scheduledFor = new Date(phase0EndDate * 1000).toISOString()
    return NextResponse.json({ success: true, scheduled_for: scheduledFor, new_plan_type })

  } catch (err) {
    console.error('[plan/change]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
