import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const getClients = () => ({
  supabase: createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY),
  stripe: new Stripe(process.env.STRIPE_SECRET_KEY),
})

export async function POST(request) {
  const { supabase, stripe } = getClients()
  const PRICE_IDS = {
    standard:             process.env.STRIPE_PRICE_STANDARD,
    pro_monthly:          process.env.STRIPE_PRICE_PRO_MONTHLY,
    pro_annual:           process.env.STRIPE_PRICE_PRO_ANNUAL,
    enterprise_monthly:   process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    enterprise_annual:    process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL,
  }
  try {
    const { seller_id, plan_type, billing_cycle, quantity = 1, no_trial = false } = await request.json()

    if (!seller_id || !plan_type) {
      return NextResponse.json({ error: 'seller_id and plan_type are required' }, { status: 400 })
    }

    // Fetch seller email
    const { data: seller, error: sellerError } = await supabase
      .from('seller_applications')
      .select('email, contact_person_name')
      .eq('id', seller_id)
      .single()

    if (sellerError || !seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

    // Check if a Stripe customer already exists for this seller (in seller_plans)
    let customerId = null
    const { data: existingPlan } = await supabase
      .from('seller_plans')
      .select('stripe_customer_id')
      .eq('seller_id', seller_id)
      .not('stripe_customer_id', 'is', null)
      .maybeSingle()

    if (existingPlan?.stripe_customer_id) {
      customerId = existingPlan.stripe_customer_id
    } else {
      // Also check seller_applications.stripe_customer_id as a fallback
      const { data: appRow } = await supabase
        .from('seller_applications')
        .select('stripe_customer_id')
        .eq('id', seller_id)
        .maybeSingle()

      if (appRow?.stripe_customer_id) {
        customerId = appRow.stripe_customer_id
      } else {
        // Create a new Stripe customer
        const customer = await stripe.customers.create({
          email: seller.email,
          name: seller.contact_person_name || seller.email,
          metadata: { seller_id, source: 'deelmap_seller_onboarding' },
        })
        customerId = customer.id
        // Save immediately so it's available even if seller_plans write fails later
        await supabase
          .from('seller_applications')
          .update({ stripe_customer_id: customerId })
          .eq('id', seller_id)
      }
    }

    // --- STANDARD: one-time PaymentIntent ($29 × quantity) ---
    if (plan_type === 'standard') {
      const amount = 2900 * quantity
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customerId,
        automatic_payment_methods: { enabled: true },
        metadata: { seller_id, plan_type: 'standard', quantity: String(quantity) },
      })
      return NextResponse.json({ type: 'payment_intent', clientSecret: paymentIntent.client_secret })
    }

    // --- PRO / ENTERPRISE: Subscription ---
    const priceKey = `${plan_type}_${billing_cycle || 'monthly'}`
    const priceId = PRICE_IDS[priceKey]

    if (!priceId) {
      return NextResponse.json({ error: `Price not configured for ${priceKey}` }, { status: 400 })
    }

    const subscriptionParams = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      metadata: { seller_id, plan_type, billing_cycle: billing_cycle || 'monthly' },
    }

    if ((plan_type === 'pro' || plan_type === 'enterprise') && !no_trial) {
      subscriptionParams.trial_period_days = 7
    }

    // Cancel any existing incomplete/trialing subscriptions before creating a new one
    // This prevents duplicate billing history entries when the user goes back and re-selects a plan
    const existingSubs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
    for (const sub of existingSubs.data) {
      if (['incomplete', 'trialing'].includes(sub.status)) {
        await stripe.subscriptions.cancel(sub.id)
      }
    }
    // Clear the stale seller_plans row so it doesn't reference a cancelled subscription
    await supabase.from('seller_plans').delete().eq('seller_id', seller_id)

    const subscription = await stripe.subscriptions.create(subscriptionParams)

    // For trial subscriptions the first invoice is $0 so payment_intent is null.
    // Fall back to pending_setup_intent which Stripe creates to collect the card.
    let paymentClientSecret = subscription.latest_invoice?.payment_intent?.client_secret
    const setupClientSecret = subscription.pending_setup_intent?.client_secret

    // Log what Stripe actually returned for debugging
    const liType = typeof subscription.latest_invoice
    const liPaymentIntent = liType === 'object' ? subscription.latest_invoice?.payment_intent : 'n/a'
    console.log('[create-intent] latest_invoice type:', liType, '| payment_intent type:', typeof liPaymentIntent, '| payment_intent value:', JSON.stringify(liPaymentIntent)?.slice(0, 200))

    // If payment_intent is missing — either latest_invoice is a string ID (not expanded)
    // or it's an object but payment_intent is still null or a string — fetch the invoice directly
    if (!paymentClientSecret && subscription.latest_invoice) {
      const invoiceId = typeof subscription.latest_invoice === 'string'
        ? subscription.latest_invoice
        : subscription.latest_invoice.id
      console.log('[create-intent] fetching invoice directly:', invoiceId)
      if (invoiceId) {
        const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['payment_intent'] })
        console.log('[create-intent] invoice.payment_intent type:', typeof invoice.payment_intent, '| has client_secret:', !!invoice.payment_intent?.client_secret)
        paymentClientSecret = invoice.payment_intent?.client_secret
      }
    }

    const clientSecret = paymentClientSecret || setupClientSecret

    console.log('[create-intent] subscription.id:', subscription.id, '| paymentClientSecret:', !!paymentClientSecret, '| setupClientSecret:', !!setupClientSecret, '| clientSecret:', !!clientSecret)

    if (!clientSecret) {
      return NextResponse.json({ error: 'Could not initialize subscription payment' }, { status: 500 })
    }

    return NextResponse.json({
      type: paymentClientSecret ? 'subscription' : 'setup',
      clientSecret,
      subscription_id: subscription.id,
    })
  } catch (err) {
    console.error('[create-intent]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
