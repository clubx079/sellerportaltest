import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// POST /api/billing/setup-intent
// Body: { customer_id }
// Creates a Stripe SetupIntent so the client can collect + save a new card
// via Stripe Elements, without any redirect to a hosted portal.
export async function POST(request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { customer_id } = await request.json();
    if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 });

    const setupIntent = await stripe.setupIntents.create({
      customer: customer_id,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Failed to create setup intent' }, { status: 500 });
  }
}
