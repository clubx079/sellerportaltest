import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const toISO = (ts) => (ts && ts > 0) ? new Date(ts * 1000).toISOString() : null

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[Stripe Webhook] Signature failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      // ── Standard plan: one-time payment succeeded ──────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object
        const { seller_id, plan_type, quantity } = pi.metadata

        if (!seller_id || plan_type !== 'standard') break

        // Idempotency — skip if already processed
        const { data: existing } = await supabase
          .from('seller_plans')
          .select('id')
          .eq('stripe_customer_id', pi.customer)
          .eq('plan_type', 'standard')
          .maybeSingle()

        if (existing) break

        await supabase.from('seller_plans').insert({
          seller_id,
          plan_type: 'standard',
          billing_cycle: 'one_time',
          status: 'active',
          stripe_customer_id: pi.customer,
          quantity: parseInt(quantity || '1'),
          listings_used_this_period: 0,
        })

        await supabase
          .from('seller_applications')
          .update({ status: 'approved' })
          .eq('id', seller_id)

        break
      }

      // ── Pro/Enterprise subscription created (trial or paid) ──────────
      case 'customer.subscription.created': {
        const sub = event.data.object
        const { seller_id, plan_type, billing_cycle } = sub.metadata

        if (!seller_id) break

        const { data: existingPlan } = await supabase
          .from('seller_plans')
          .select('id')
          .eq('seller_id', seller_id)
          .maybeSingle()

        const planRow = {
          seller_id,
          plan_type,
          billing_cycle: billing_cycle || 'monthly',
          status: sub.status === 'trialing' ? 'trialing' : 'active',
          stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          stripe_subscription_id: sub.id,
          stripe_price_id: sub.items.data[0]?.price?.id || null,
          trial_ends_at:        toISO(sub.trial_end),
          current_period_start: toISO(sub.current_period_start),
          current_period_end:   toISO(sub.current_period_end),
          updated_at: new Date().toISOString(),
        }

        if (existingPlan) {
          await supabase.from('seller_plans').update(planRow).eq('id', existingPlan.id)
        } else {
          await supabase.from('seller_plans').insert(planRow)
        }

        await supabase
          .from('seller_applications')
          .update({ status: 'approved' })
          .eq('id', seller_id)

        break
      }

      // ── Subscription updated (upgrade/downgrade/renewal) ──────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object

        await supabase
          .from('seller_plans')
          .update({
            status: sub.status === 'trialing' ? 'trialing'
                  : sub.status === 'past_due' ? 'past_due'
                  : 'active',
            current_period_start: toISO(sub.current_period_start),
            current_period_end:   toISO(sub.current_period_end),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id)

        break
      }

      // ── Subscription cancelled ────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object

        await supabase
          .from('seller_plans')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id)

        break
      }

      // ── Invoice paid: reset monthly listing counter ───────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        if (invoice.billing_reason !== 'subscription_cycle') break

        await supabase
          .from('seller_plans')
          .update({ listings_used_this_period: 0, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', invoice.subscription)

        break
      }

      // ── Invoice payment failed ────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object

        await supabase
          .from('seller_plans')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', invoice.subscription)

        break
      }
    }
  } catch (err) {
    console.error('[Stripe Webhook] Handler error:', err)
  }

  return NextResponse.json({ received: true })
}
