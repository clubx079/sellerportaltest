import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { enrollAutomation } from '@/lib/enrollAutomation'

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const toISO = (ts) => (ts && ts > 0) ? new Date(ts * 1000).toISOString() : null

  try {
    const { seller_id, subscription_id, pm_id } = await request.json()
    if (!seller_id || !subscription_id) {
      return NextResponse.json({ error: 'seller_id and subscription_id are required' }, { status: 400 })
    }

    // Retrieve full subscription data from Stripe
    const sub = await stripe.subscriptions.retrieve(subscription_id)
    const meta = sub.metadata || {}
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id

    // Block activation for lifetime-free accounts
    const { data: appCheck } = await supabase
      .from('seller_applications')
      .select('admin_notes, email, contact_person_name')
      .eq('id', seller_id)
      .maybeSingle()

    if (appCheck?.admin_notes === 'LIFETIME_FREE') {
      return NextResponse.json({ success: true, lifetime_free: true })
    }

    // Check if a plan row already exists for this seller
    const { data: existing, error: selectErr } = await supabase
      .from('seller_plans')
      .select('id, listings_used_this_period')
      .eq('seller_id', seller_id)
      .maybeSingle()

    if (selectErr) {
      console.error('[activate] select error:', selectErr)
      return NextResponse.json({ error: selectErr.message }, { status: 500 })
    }

    const planRow = {
      seller_id,
      plan_type:              meta.plan_type     || 'pro',
      billing_cycle:          meta.billing_cycle || 'monthly',
      status:                 sub.status === 'trialing' ? 'trialing' : 'active',
      stripe_customer_id:     customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id:        sub.items.data[0]?.price?.id || null,
      trial_ends_at:          toISO(sub.trial_end),
      current_period_start:   toISO(sub.current_period_start ?? sub.items?.data?.[0]?.current_period_start) || new Date().toISOString(),
      current_period_end:     toISO(sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? sub.trial_end),
      listings_used_this_period: existing?.listings_used_this_period ?? 0,
      updated_at:             new Date().toISOString(),
    }

    if (existing) {
      const { error: updateErr } = await supabase
        .from('seller_plans')
        .update(planRow)
        .eq('id', existing.id)
      if (updateErr) {
        console.error('[activate] update error:', updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
    } else {
      const { error: insertErr } = await supabase
        .from('seller_plans')
        .insert(planRow)
      if (insertErr) {
        console.error('[activate] insert error:', insertErr)
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
    }

    // Save payment method as customer-level default so billing page can display it
    const resolvedPmId = pm_id || sub.default_payment_method || null
    if (resolvedPmId && customerId) {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: resolvedPmId },
      })
    }

    await supabase
      .from('seller_applications')
      .update({ status: 'approved', stripe_customer_id: customerId, phone_verified: true })
      .eq('id', seller_id)

    // Welcome — fires only now that the seller has an active plan. Instant + tracked
    // via the follow-up engine; the welcome:{{seller_id}} dedup key makes the Stripe
    // webhook backstop a no-op, so exactly one email is ever sent. Engine-only —
    // no direct send (delivery therefore requires ADMIN_AUTOMATIONS_URL + CRON_SECRET).
    await enrollAutomation('seller_welcome', seller_id, {
      seller_id,
      name: appCheck?.contact_person_name || '',
      email: appCheck?.email || '',
    }, { immediate: true }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[seller/plan/activate]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
