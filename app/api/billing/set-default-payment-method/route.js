import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// POST /api/billing/set-default-payment-method
// Body: { customer_id, payment_method_id }
// After the client confirms a SetupIntent, set the new card as the customer's
// default AND on any active subscription so future charges use it.
export async function POST(request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { customer_id, payment_method_id } = await request.json();
    if (!customer_id || !payment_method_id) {
      return NextResponse.json({ error: 'customer_id and payment_method_id required' }, { status: 400 });
    }

    // Ensure the PM is attached to the customer (confirmSetup usually does this,
    // but attach defensively in case it isn't).
    try {
      await stripe.paymentMethods.attach(payment_method_id, { customer: customer_id });
    } catch (e) {
      // Already attached → Stripe throws; safe to ignore that specific case.
      if (!String(e?.message || '').includes('already been attached')) throw e;
    }

    // Set as the customer's default for future invoices
    await stripe.customers.update(customer_id, {
      invoice_settings: { default_payment_method: payment_method_id },
    });

    // Point any active/trialing subscription at the new card too
    const subs = await stripe.subscriptions.list({ customer: customer_id, status: 'all', limit: 10 });
    const active = subs.data.find(s => ['active', 'trialing', 'past_due'].includes(s.status));
    if (active) {
      await stripe.subscriptions.update(active.id, { default_payment_method: payment_method_id });
    }

    // Return the new card details so the UI can update without a full refetch
    const pm = await stripe.paymentMethods.retrieve(payment_method_id);
    return NextResponse.json({
      ok: true,
      payment_method: pm.card ? { brand: pm.card.brand, last4: pm.card.last4, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year } : null,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Failed to set default payment method' }, { status: 500 });
  }
}
