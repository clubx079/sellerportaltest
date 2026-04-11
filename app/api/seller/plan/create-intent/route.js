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
    const { seller_id, plan_type, billing_cycle, quantity = 1 } = await request.json()

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
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: seller.email,
        name: seller.contact_person_name || seller.email,
        metadata: { seller_id, source: 'deelmap_seller_onboarding' },
      })
      customerId = customer.id
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
      expand: ['latest_invoice.payment_intent'],
      metadata: { seller_id, plan_type, billing_cycle: billing_cycle || 'monthly' },
    }

    if (plan_type === 'pro') {
      subscriptionParams.trial_period_days = 7
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams)

    const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret

    if (!clientSecret) {
      return NextResponse.json({ error: 'Could not initialize subscription payment' }, { status: 500 })
    }

    return NextResponse.json({
      type: 'subscription',
      clientSecret,
      subscription_id: subscription.id,
    })
  } catch (err) {
    console.error('[create-intent]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
