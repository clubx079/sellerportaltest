import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const getClients = () => ({
  supabase: createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY),
  stripe: new Stripe(process.env.STRIPE_SECRET_KEY),
})

export async function POST(request) {
  const { supabase, stripe } = getClients()
  try {
    const { first_name, last_name, email, password } = await request.json()

    if (!first_name || !last_name || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('seller_applications')
      .select('id, status')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existing) {
      if (existing.status === 'onboarding') {
        // Allow resuming an incomplete onboarding
        return NextResponse.json({ seller_id: existing.id, resumed: true })
      }
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: email.trim().toLowerCase(),
      name: `${first_name} ${last_name}`,
      metadata: { source: 'deelmap_seller_onboarding' }
    })

    // Create seller_applications row
    const contact_person_name = `${first_name} ${last_name}`
    const { data: seller, error } = await supabase
      .from('seller_applications')
      .insert({
        contact_person_name,
        email: email.trim().toLowerCase(),
        password,
        phone: '',
        business_name: contact_person_name,
        business_type: 'individual',
        deals_per_month: 'not_specified',
        primary_markets: '',
        property_types: [],
        description: '',
        status: 'onboarding',
        stripe_customer_id: customer.id,
        onboarding_step: 1,
        phone_verified: false,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[register-seller]', error)
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    return NextResponse.json({ seller_id: seller.id })
  } catch (err) {
    console.error('[register-seller]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
