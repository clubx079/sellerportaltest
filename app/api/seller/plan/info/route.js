import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

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

    // Check Stripe subscription for a schedule (pending plan change)
    const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id, {
      expand: ['schedule'],
    })

    let pending = null
    if (sub.schedule && typeof sub.schedule !== 'string') {
      // Schedule exists — look at the second phase for the new plan
      const phases = sub.schedule.phases || []
      if (phases.length >= 2) {
        const nextPhase = phases[1]
        const nextPriceId = nextPhase.items?.[0]?.price
        const scheduledFor = nextPhase.start_date
          ? new Date(nextPhase.start_date * 1000).toISOString()
          : null

        // Map price ID back to plan type
        const priceMap = {
          [process.env.STRIPE_PRICE_PRO_MONTHLY]:        { plan_type: 'pro',        billing_cycle: 'monthly' },
          [process.env.STRIPE_PRICE_PRO_ANNUAL]:         { plan_type: 'pro',        billing_cycle: 'annual'  },
          [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY]: { plan_type: 'enterprise', billing_cycle: 'monthly' },
          [process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL]:  { plan_type: 'enterprise', billing_cycle: 'annual'  },
        }

        const nextPlanInfo = priceMap[nextPriceId] || nextPhase.metadata || null
        if (nextPlanInfo) {
          pending = {
            plan_type: nextPlanInfo.plan_type,
            scheduled_for: scheduledFor,
            schedule_id: sub.schedule.id,
          }
        }
      }
    }

    return NextResponse.json({ plan, pending })
  } catch (err) {
    console.error('[plan/info]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
