import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  try {
    const { customer_id } = await request.json()
    if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

    const customer = await stripe.customers.retrieve(customer_id)
    const defaultPmId = customer.invoice_settings?.default_payment_method

    if (!defaultPmId) {
      // Fall back to most recently attached payment method on the customer
      const paymentMethods = await stripe.paymentMethods.list({ customer: customer_id, type: 'card', limit: 1 })
      const pm = paymentMethods.data[0]
      if (!pm) return NextResponse.json({ default_payment_method: null })
      return NextResponse.json({
        default_payment_method: {
          id: pm.id,
          brand: pm.card?.brand || 'card',
          last4: pm.card?.last4 || '****',
          exp_month: pm.card?.exp_month,
          exp_year: pm.card?.exp_year,
        }
      })
    }

    const pm = await stripe.paymentMethods.retrieve(defaultPmId)
    return NextResponse.json({
      default_payment_method: {
        id: pm.id,
        brand: pm.card?.brand || 'card',
        last4: pm.card?.last4 || '****',
        exp_month: pm.card?.exp_month,
        exp_year: pm.card?.exp_year,
      }
    })
  } catch (err) {
    console.error('[billing/payment-methods]', err)
    return NextResponse.json({ default_payment_method: null })
  }
}
