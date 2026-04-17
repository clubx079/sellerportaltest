import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  try {
    const { customer_id } = await request.json()
    if (!customer_id) return NextResponse.json({ invoices: [] })

    // Fetch subscription invoices + one-time charges in parallel
    const [invoiceList, chargeList] = await Promise.all([
      stripe.invoices.list({ customer: customer_id, limit: 24 }),
      stripe.charges.list({ customer: customer_id, limit: 24 }),
    ])

    // Subscription invoices
    const invoices = invoiceList.data
      .filter(inv => inv.amount_paid > 0 || inv.amount_due > 0)
      .map(inv => ({
        id:                 inv.id,
        number:             inv.number,
        created:            inv.created,
        amount_paid:        inv.amount_paid,
        amount_due:         inv.amount_due,
        currency:           inv.currency,
        status:             inv.status,
        hosted_invoice_url: inv.hosted_invoice_url,
        invoice_pdf:        inv.invoice_pdf,
        description:        inv.lines?.data?.[0]?.description || 'Subscription',
        type:               'invoice',
      }))

    // One-time charges (add-ons) — exclude charges already covered by an invoice
    const invoiceChargeIds = new Set(
      invoiceList.data.map(inv => inv.charge).filter(Boolean)
    )
    const addonCharges = chargeList.data
      .filter(ch => ch.paid && ch.amount > 0 && !invoiceChargeIds.has(ch.id))
      .map(ch => ({
        id:          ch.id,
        number:      null,
        created:     ch.created,
        amount_paid: ch.amount,
        amount_due:  ch.amount,
        currency:    ch.currency,
        status:      'paid',
        hosted_invoice_url: ch.receipt_url,
        invoice_pdf: null,
        description: ch.metadata?.add_ons
          ? `Add-ons: ${ch.metadata.add_ons.split(',').join(', ')}`
          : (ch.description || 'Listing add-on'),
        type: 'charge',
      }))

    // Merge and sort by date descending
    const all = [...invoices, ...addonCharges].sort((a, b) => b.created - a.created)

    return NextResponse.json({ invoices: all })
  } catch (err) {
    console.error('[billing/invoices]', err)
    return NextResponse.json({ invoices: [] })
  }
}
