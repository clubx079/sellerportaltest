import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  try {
    const { customer_id } = await request.json()
    if (!customer_id) return NextResponse.json({ invoices: [] })

    const list = await stripe.invoices.list({ customer: customer_id, limit: 12 })

    const invoices = list.data
      .filter(inv => (inv.amount_paid > 0 || inv.amount_due > 0))
      .map(inv => ({
        id:                  inv.id,
        number:              inv.number,
        created:             inv.created,
        amount_paid:         inv.amount_paid,
        amount_due:          inv.amount_due,
        currency:            inv.currency,
        status:              inv.status,
        hosted_invoice_url:  inv.hosted_invoice_url,
        invoice_pdf:         inv.invoice_pdf,
        description:         inv.lines?.data?.[0]?.description || 'Subscription',
      }))

    return NextResponse.json({ invoices })
  } catch (err) {
    console.error('[billing/invoices]', err)
    return NextResponse.json({ invoices: [] })
  }
}
