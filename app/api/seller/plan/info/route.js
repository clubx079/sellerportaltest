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

    const { data: plan } = await supabase
      .from('seller_plans')
      .select('*')
      .eq('seller_id', seller_id)
      .maybeSingle()

    if (!plan?.stripe_subscription_id) {
      return NextResponse.json({ plan, pending: null })
    }

    // Verify live subscription status against Stripe (catches any webhook delays)
    const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id)

    const priceMap = {
      [process.env.STRIPE_PRICE_PRO_MONTHLY]:        { plan_type: 'pro',        billing_cycle: 'monthly' },
      [process.env.STRIPE_PRICE_PRO_ANNUAL]:         { plan_type: 'pro',        billing_cycle: 'annual'  },
      [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY]: { plan_type: 'enterprise', billing_cycle: 'monthly' },
      [process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL]:  { plan_type: 'enterprise', billing_cycle: 'annual'  },
    }

    // If Stripe has a different plan_type than our DB (webhook not yet processed), patch it
    const livePriceId = sub.items.data[0]?.price?.id
    const liveInfo = priceMap[livePriceId]
    if (liveInfo && liveInfo.plan_type !== plan.plan_type) {
      await supabase
        .from('seller_plans')
        .update({
          plan_type: liveInfo.plan_type,
          billing_cycle: liveInfo.billing_cycle,
          stripe_price_id: livePriceId,
          current_period_start: toISO(sub.current_period_start),
          current_period_end:   toISO(sub.current_period_end),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', sub.id)

      plan.plan_type = liveInfo.plan_type
      plan.billing_cycle = liveInfo.billing_cycle
      plan.current_period_end = toISO(sub.current_period_end)
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
          if (nextPlanInfo && nextPlanInfo.plan_type !== plan.plan_type) {
            pending = {
              plan_type: nextPlanInfo.plan_type,
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
