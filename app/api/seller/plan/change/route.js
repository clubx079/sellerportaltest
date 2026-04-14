import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const PRICE_IDS = {
  pro_monthly:        process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_annual:         process.env.STRIPE_PRICE_PRO_ANNUAL,
  enterprise_monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
  enterprise_annual:  process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL,
}

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
      .select('stripe_subscription_id, plan_type, billing_cycle, current_period_end')
      .eq('seller_id', seller_id)
      .maybeSingle()

    if (!plan?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    if (plan.plan_type === new_plan_type) {
      return NextResponse.json({ error: 'Already on this plan' }, { status: 400 })
    }

    const billingCycle = plan.billing_cycle || 'monthly'
    const newPriceId = PRICE_IDS[`${new_plan_type}_${billingCycle}`]
    if (!newPriceId) {
      return NextResponse.json({ error: `Price not configured for ${new_plan_type}_${billingCycle}` }, { status: 400 })
    }

    // Retrieve current subscription to get current price and period end
    const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id, {
      expand: ['schedule'],
    })

    const currentItemId = sub.items.data[0]?.id
    const currentPriceId = sub.items.data[0]?.price?.id
    const periodEnd = sub.current_period_end

    if (!currentItemId || !currentPriceId) {
      return NextResponse.json({ error: 'Could not read current subscription item' }, { status: 500 })
    }

    // If subscription already has a schedule, update its phases
    // Otherwise create a new schedule from the subscription
    if (sub.schedule) {
      await stripe.subscriptionSchedules.update(typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id, {
        end_behavior: 'release',
        phases: [
          {
            items: [{ price: currentPriceId, quantity: 1 }],
            end_date: periodEnd,
            proration_behavior: 'none',
          },
          {
            items: [{ price: newPriceId, quantity: 1 }],
            proration_behavior: 'none',
            metadata: { seller_id, plan_type: new_plan_type, billing_cycle: billingCycle },
          },
        ],
      })
    } else {
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: plan.stripe_subscription_id,
      })
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: 'release',
        phases: [
          {
            items: [{ price: currentPriceId, quantity: 1 }],
            end_date: periodEnd,
            proration_behavior: 'none',
          },
          {
            items: [{ price: newPriceId, quantity: 1 }],
            proration_behavior: 'none',
            metadata: { seller_id, plan_type: new_plan_type, billing_cycle: billingCycle },
          },
        ],
      })
    }

    const scheduledFor = new Date(periodEnd * 1000).toISOString()

    return NextResponse.json({ success: true, scheduled_for: scheduledFor, new_plan_type })
  } catch (err) {
    console.error('[plan/change]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
