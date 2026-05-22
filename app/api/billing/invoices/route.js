import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// Must match listing-addons prices exactly
const ADD_ON_PRICES = {
  highlight: 999,
  boost:     1499,
  homepage:  2900,
  bundle:    2200,
}

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  try {
    const { customer_id } = await request.json()
    if (!customer_id) return NextResponse.json({ invoices: [] })

    // Fetch subscription invoices + addon PaymentIntents in parallel
    const [invoiceList, piList] = await Promise.all([
      stripe.invoices.list({ customer: customer_id, limit: 24 }),
      stripe.paymentIntents.list({ customer: customer_id, limit: 24 }),
    ])

    // Subscription invoices
    const invoices = invoiceList.data
      .filter(inv => inv.amount_paid > 0 || inv.amount_due > 0)
      .map(inv => {
        const discountAmount = (inv.total_discount_amounts || []).reduce((sum, d) => sum + d.amount, 0)
        const subtotal = inv.subtotal || 0
        const discountLabel = inv.discount
          ? (inv.discount.coupon?.percent_off
              ? `${inv.discount.coupon.percent_off}% off`
              : inv.discount.coupon?.amount_off
                ? `$${(inv.discount.coupon.amount_off / 100).toFixed(2)} off`
                : null)
          : null
        return {
          id:                 inv.id,
          number:             inv.number,
          created:            inv.created,
          amount_paid:        inv.amount_paid,
          amount_due:         inv.amount_due,
          subtotal:           subtotal,
          discount_amount:    discountAmount,
          discount_label:     discountLabel,
          currency:           inv.currency,
          status:             inv.status,
          hosted_invoice_url: inv.hosted_invoice_url,
          invoice_pdf:        inv.invoice_pdf,
          description:        inv.lines?.data?.[0]?.description || 'Subscription',
          type:               'invoice',
        }
      })

    // Addon charges — only PaymentIntents that have add_ons in metadata (never subscription charges)
    const addonCharges = piList.data
      .filter(pi => pi.status === 'succeeded' && pi.metadata?.add_ons)
      .map(pi => {
        // Prefer stored original_amount; fall back to reconstructing from known prices
        let subtotal
        if (pi.metadata.original_amount) {
          subtotal = parseInt(pi.metadata.original_amount)
        } else {
          const addOnIds = pi.metadata.add_ons.split(',').map(s => s.trim())
          subtotal = addOnIds.reduce((sum, id) => sum + (ADD_ON_PRICES[id] || 0), 0) || pi.amount
        }

        const discountAmount = pi.metadata.discount_amount
          ? parseInt(pi.metadata.discount_amount)
          : Math.max(subtotal - pi.amount, 0)

        return {
          id:                 pi.id,
          number:             null,
          created:            pi.created,
          amount_paid:        pi.amount,
          amount_due:         pi.amount,
          subtotal:           subtotal,
          discount_amount:    discountAmount,
          discount_label:     null,
          currency:           pi.currency,
          status:             'paid',
          hosted_invoice_url: pi.charges?.data?.[0]?.receipt_url || null,
          invoice_pdf:        null,
          description:        `Add-ons: ${pi.metadata.add_ons.split(',').map(s => s.trim()).join(', ')}`,
          type:               'charge',
        }
      })

    // Merge and sort by date descending
    const all = [...invoices, ...addonCharges].sort((a, b) => b.created - a.created)

    return NextResponse.json({ invoices: all })
  } catch (err) {
    console.error('[billing/invoices]', err)
    return NextResponse.json({ invoices: [] })
  }
}
