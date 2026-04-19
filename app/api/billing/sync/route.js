import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const toISO = (ts) => (ts && ts > 0) ? new Date(ts * 1000).toISOString() : null

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    const { seller_id } = await request.json()
    if (!seller_id) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

    // Get stripe_customer_id from seller_applications
    const { data: appRow, error: appErr } = await supabase
      .from('seller_applications')
      .select('stripe_customer_id, email')
      .eq('id', seller_id)
      .maybeSingle()

    if (appErr || !appRow) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

    let customerId = appRow.stripe_customer_id

    // If no customer ID saved yet, search Stripe by email
    if (!customerId) {
      const customers = await stripe.customers.list({ email: appRow.email, limit: 1 })
      if (customers.data.length > 0) {
        customerId = customers.data[0].id
        // Save it back
        await supabase
          .from('seller_applications')
          .update({ stripe_customer_id: customerId })
          .eq('id', seller_id)
      }
    }

    if (!customerId) {
      return NextResponse.json({ synced: false, reason: 'No Stripe customer found' })
    }

    // Get latest active/trialing subscription for this customer
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 5,
    })

    const sub = subs.data.find(s =>
      ['active', 'trialing', 'past_due'].includes(s.status)
    ) || subs.data[0]

    if (!sub) {
      return NextResponse.json({ synced: false, reason: 'No subscription found' })
    }

    // Check if row already exists
    const { data: existing } = await supabase
      .from('seller_plans')
      .select('id, listings_used_this_period')
      .eq('seller_id', seller_id)
      .maybeSingle()

    const meta = sub.metadata || {}
    const planRow = {
      seller_id,
      plan_type:              meta.plan_type     || 'pro',
      billing_cycle:          meta.billing_cycle || 'monthly',
      status:                 sub.status === 'trialing' ? 'trialing'
                            : sub.status === 'past_due' ? 'past_due'
                            : sub.status === 'canceled'  ? 'canceled'
                            : 'active',
      stripe_customer_id:     customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id:        sub.items.data[0]?.price?.id || null,
      trial_ends_at:          toISO(sub.trial_end),
      current_period_start:   toISO(sub.current_period_start),
      current_period_end:     toISO(sub.current_period_end),
      listings_used_this_period: existing?.listings_used_this_period ?? 0,
      updated_at:             new Date().toISOString(),
    }

    if (existing) {
      await supabase.from('seller_plans').update(planRow).eq('id', existing.id)
    } else {
      const { error: insertErr } = await supabase.from('seller_plans').insert(planRow)
      if (insertErr) {
        console.error('[billing/sync] insert error:', insertErr)
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
    }

    // Approve the seller if not already
    await supabase
      .from('seller_applications')
      .update({ status: 'approved', stripe_customer_id: customerId })
      .eq('id', seller_id)

    return NextResponse.json({ synced: true, plan: planRow })
  } catch (err) {
    console.error('[billing/sync]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
