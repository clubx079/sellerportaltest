import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const toISO = (ts) => (ts && ts > 0) ? new Date(ts * 1000).toISOString() : null

export async function POST(request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    const { seller_id } = await request.json()
    if (!seller_id) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

    const { data: appCheck } = await supabase
      .from('seller_applications')
      .select('admin_notes')
      .eq('id', seller_id)
      .maybeSingle()

    const isLifetimeFree = appCheck?.admin_notes === 'LIFETIME_FREE'

    const { data: plan } = await supabase
      .from('seller_plans')
      .select('*')
      .eq('seller_id', seller_id)
      .maybeSingle()

    if (isLifetimeFree || !plan?.stripe_subscription_id) {
      return NextResponse.json({ plan, pending: null, lifetime_free: isLifetimeFree })
    }

    // Verify live subscription status against Stripe (catches any webhook delays)
    const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id)

    const priceMap = {
      [process.env.STRIPE_PRICE_PRO_MONTHLY]:        { plan_type: 'pro',        billing_cycle: 'monthly' },
      [process.env.STRIPE_PRICE_PRO_ANNUAL]:         { plan_type: 'pro',        billing_cycle: 'annual'  },
      [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY]: { plan_type: 'enterprise', billing_cycle: 'monthly' },
      [process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL]:  { plan_type: 'enterprise', billing_cycle: 'annual'  },
    }

    // Sync live Stripe data to DB (catches webhook delays and missing period dates)
    const livePriceId = sub.items.data[0]?.price?.id
    const liveInfo = priceMap[livePriceId]
    const livePeriodEnd = toISO(sub.current_period_end)
    const livePeriodStart = toISO(sub.current_period_start)

    const liveStatus   = sub.status
    const liveTrialEnd = liveStatus === 'trialing' ? toISO(sub.trial_end) : null

    // Fallback period end when Stripe returns 0 (e.g. briefly after ending trial)
    let resolvedPeriodEnd = livePeriodEnd
    if (!resolvedPeriodEnd && liveStatus === 'active' && !plan.current_period_end) {
      const end = new Date()
      if (plan.billing_cycle === 'annual') end.setFullYear(end.getFullYear() + 1)
      else end.setMonth(end.getMonth() + 1)
      resolvedPeriodEnd = end.toISOString()
    }

    const needsSync = (liveInfo && liveInfo.plan_type !== plan.plan_type)
      || (resolvedPeriodEnd && resolvedPeriodEnd !== plan.current_period_end)
      || (liveStatus && liveStatus !== plan.status)

    if (needsSync) {
      const update = {
        current_period_start: livePeriodStart || plan.current_period_start,
        current_period_end:   resolvedPeriodEnd,
        status:               liveStatus,
        trial_ends_at:        liveTrialEnd,
        updated_at:           new Date().toISOString(),
      }
      if (liveInfo) {
        update.plan_type       = liveInfo.plan_type
        update.billing_cycle   = liveInfo.billing_cycle
        update.stripe_price_id = livePriceId
      }
      await supabase
        .from('seller_plans')
        .update(update)
        .eq('stripe_subscription_id', sub.id)

      if (liveInfo) {
        plan.plan_type     = liveInfo.plan_type
        plan.billing_cycle = liveInfo.billing_cycle
      }
      plan.current_period_end   = resolvedPeriodEnd
      plan.current_period_start = livePeriodStart || plan.current_period_start
      plan.status               = liveStatus
      plan.trial_ends_at        = liveTrialEnd
    }

    // Check for a pending scheduled plan change via Stripe Subscription Schedule
    let pending = null
    const scheduleId = sub.schedule
      ? (typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id)
      : null

    if (scheduleId) {
      try {
        const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId)
        if (schedule.status === 'active' && schedule.phases.length > 1) {
          const phase1 = schedule.phases[0]
          const phase2 = schedule.phases[1]
          const nextPriceId = phase2.items?.[0]?.price
          const nextPriceIdStr = typeof nextPriceId === 'string' ? nextPriceId : nextPriceId?.id
          const nextPlanInfo = priceMap[nextPriceIdStr]
          if (nextPlanInfo && (nextPlanInfo.plan_type !== plan.plan_type || nextPlanInfo.billing_cycle !== plan.billing_cycle)) {
            pending = {
              plan_type: nextPlanInfo.plan_type,
              billing_cycle: nextPlanInfo.billing_cycle,
              scheduled_for: phase1.end_date
                ? new Date(phase1.end_date * 1000).toISOString()
                : null,
            }
          }
        }
      } catch (schedErr) {
        console.error('[plan/info] schedule fetch error:', schedErr.message)
      }
    }

    return NextResponse.json({ plan, pending })
  } catch (err) {
    console.error('[plan/info]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
