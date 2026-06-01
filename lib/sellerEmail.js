// Shared Deelmap seller-portal transactional email templates.
// All sends are fire-and-forget; failures are logged but do not block the caller.

import { Resend } from 'resend'

const FROM = process.env.RESEND_FROM_EMAIL || 'Deelmap <notifications@deelmap.com>'
const LOGO = 'https://deelmap.com/deelmap.png'
const SELLER_PORTAL = (process.env.NEXT_PUBLIC_APP_URL || 'https://sell.deelmap.com').replace(/\/+$/, '')

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function escape(s) {
  return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function money(cents) {
  const n = Number(cents) / 100
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(isFinite(n) ? n : 0)
}

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

// Branded card shell — reused by every template.
function shell({ accent = '#0F6E56', preheader = '', body }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  ${preheader ? `<div style="display:none;font-size:1px;color:#F5F5F3;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escape(preheader)}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr>
        <td style="background:#ffffff;padding:12px 40px;text-align:center;border-bottom:2px solid #D03839">
          <img src="${LOGO}" alt="Deelmap" height="72" style="display:inline-block;height:72px;width:auto;border:0" />
        </td>
      </tr>
      <tr><td style="padding:36px 40px 32px;background:#ffffff">${body}</td></tr>
      <tr>
        <td style="background:#ffffff;border-top:1px solid #E8E8E4;padding:18px 40px;text-align:center">
          <p style="margin:0 0 4px;font-size:12px;color:#737370">Questions? Reach us at <a href="mailto:support@deelmap.com" style="color:#1A1816">support@deelmap.com</a></p>
          <p style="margin:0;font-size:12px;color:#A8A8A4">&copy; ${new Date().getFullYear()} Deelmap. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </td></tr></table>
</body></html>`
}

function button(href, label, accent = '#D03839') {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td style="background:${accent};border-radius:4px">
    <a href="${href}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">${label}</a>
  </td></tr></table>`
}

// 1. Welcome email — fires after seller signup
export function emailSellerWelcome({ name, email }) {
  const first = (name || '').trim().split(/\s+/)[0] || ''
  const CONTACT_SITE = (process.env.NEXT_PUBLIC_BUYER_APP_URL || 'https://deelmap.com').replace(/\/+$/, '')
  const subject = 'Welcome to Deelmap'
  const html = shell({
    preheader: 'Your Deelmap seller account is ready — and we’d love your first impression.',
    body: `
      <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${escape(first) || 'there'},</p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Welcome to Deelmap</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Thank you for joining Deelmap. Your seller account is ready — you can list deals, connect with verified buyers, accept offers, and send contracts for e-signature, all in one place.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">We're continually improving the platform, and your perspective as a seller is invaluable. Would you take two minutes to tell us how the experience looks and feels, and whether anything could be smoother? Your feedback goes straight to our team.</p>
      <table cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr>
        <td style="background:#D03839;border-radius:4px">
          <a href="${CONTACT_SITE}/contact" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">Share your feedback &rarr;</a>
        </td>
      </tr></table>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.65;color:#737370">Ready to get started? <a href="${SELLER_PORTAL}/dashboard" style="color:#D03839;text-decoration:none;font-weight:600">Post your first listing</a> from your dashboard.</p>
      <p style="margin:28px 0 0;font-size:14px;line-height:1.65;color:#444441">Welcome aboard,<br/>The Deelmap Team</p>
    `,
  })
  return { subject, html }
}

// 2. Payment receipt — fires on payment_intent.succeeded + invoice.payment_succeeded
export function emailPaymentReceipt({ name, amount_cents, description, receipt_url }) {
  const subject = `Payment received — ${money(amount_cents)}`
  const html = shell({
    accent: '#0F6E56',
    preheader: `We received your payment of ${money(amount_cents)}.`,
    body: `
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#A8A8A4">Receipt</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F6E56">Payment received</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#444441;line-height:1.5">Thanks${name ? `, ${escape((name || '').split(' ')[0])}` : ''}. We received your payment of <strong>${money(amount_cents)}</strong>${description ? ` for ${escape(description)}` : ''}.</p>
      ${receipt_url ? button(receipt_url, 'View Stripe receipt', '#1A1816') : ''}
      ${button(`${SELLER_PORTAL}/billing`, 'Open billing in Deelmap')}
    `,
  })
  return { subject, html }
}

// 3. Subscription created — fires on customer.subscription.created (trial or paid)
export function emailSubscriptionCreated({ name, plan_type, billing_cycle, trial_ends_at }) {
  const isTrial = !!trial_ends_at
  const planLabel = `${(plan_type || 'plan').charAt(0).toUpperCase()}${(plan_type || '').slice(1)}`.trim()
  const subject = isTrial ? `Your Deelmap ${planLabel} trial is active` : `Your Deelmap ${planLabel} subscription is active`
  const html = shell({
    accent: '#0F6E56',
    preheader: isTrial ? `Your ${planLabel} trial runs until ${formatDate(trial_ends_at)}.` : `${planLabel} (${billing_cycle || 'monthly'}) is active.`,
    body: `
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#A8A8A4">Subscription</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F6E56">${isTrial ? 'Trial started' : 'You\'re subscribed'}</h1>
      <p style="margin:0 0 8px;font-size:15px;color:#444441;line-height:1.5">Your <strong>${escape(planLabel)} ${billing_cycle ? `· ${escape(billing_cycle)}` : ''}</strong> ${isTrial ? 'trial' : 'subscription'} is now active${isTrial && trial_ends_at ? ` and runs through <strong>${formatDate(trial_ends_at)}</strong>` : ''}.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#737370">All your premium features are unlocked. Post your first deal and start talking to buyers.</p>
      ${button(`${SELLER_PORTAL}/dashboard`, 'Open dashboard')}
    `,
  })
  return { subject, html }
}

// 4. Trial converted to paid — fires on customer.subscription.updated when status moves trialing -> active
export function emailTrialConverted({ name, plan_type, billing_cycle, next_charge_amount_cents, next_charge_at }) {
  const planLabel = `${(plan_type || 'plan').charAt(0).toUpperCase()}${(plan_type || '').slice(1)}`.trim()
  const subject = `Your Deelmap ${planLabel} trial converted`
  const html = shell({
    accent: '#0F6E56',
    preheader: `Your ${planLabel} subscription is now billing as ${billing_cycle || 'monthly'}.`,
    body: `
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#A8A8A4">Subscription</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F6E56">Trial converted — you're on ${escape(planLabel)}</h1>
      <p style="margin:0 0 8px;font-size:15px;color:#444441;line-height:1.5">Your trial ended and your <strong>${escape(planLabel)} ${billing_cycle ? `· ${escape(billing_cycle)}` : ''}</strong> subscription is now active.</p>
      ${next_charge_amount_cents ? `<p style="margin:0 0 8px;font-size:14px;color:#737370">Next charge: <strong>${money(next_charge_amount_cents)}</strong>${next_charge_at ? ` on ${formatDate(next_charge_at)}` : ''}.</p>` : ''}
      ${button(`${SELLER_PORTAL}/billing`, 'View billing')}
    `,
  })
  return { subject, html }
}

// 5. Payment failed — fires on invoice.payment_failed
export function emailPaymentFailed({ name, amount_cents, hosted_invoice_url }) {
  const subject = 'We could not process your Deelmap payment'
  const html = shell({
    accent: '#D03839',
    preheader: 'Update your card to keep your subscription active.',
    body: `
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#A8A8A4">Action needed</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#D03839">Payment failed</h1>
      <p style="margin:0 0 8px;font-size:15px;color:#444441;line-height:1.5">We tried to process your payment${amount_cents ? ` of <strong>${money(amount_cents)}</strong>` : ''} but it didn't go through. Update your card to keep your subscription active.</p>
      ${hosted_invoice_url ? button(hosted_invoice_url, 'Retry payment in Stripe', '#1A1816') : ''}
      ${button(`${SELLER_PORTAL}/billing`, 'Update your card')}
    `,
  })
  return { subject, html }
}

// 6. Listing promoted / featured confirmation — fires per add-on purchased
export function emailListingPromoted({ name, addons, property_address }) {
  // addons: [{ type, ends_at }]
  const labels = { highlight: 'Highlight', boost: 'Boost', homepage: 'Homepage Feature', bundle: 'Search Visibility Bundle' }
  const subject = `Your listing is now promoted on Deelmap`
  const rows = (addons || []).map(a => `<tr>
    <td style="padding:6px 12px 6px 0;font-size:13px;color:#737370">${escape(labels[a.type] || a.type)}</td>
    <td style="padding:6px 0;font-size:13px;color:#1A1816">${a.ends_at ? `runs through ${formatDate(a.ends_at)}` : 'active'}</td>
  </tr>`).join('')
  const html = shell({
    accent: '#0F6E56',
    preheader: `Your listing${property_address ? ` at ${property_address}` : ''} is now promoted.`,
    body: `
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#A8A8A4">Promotion active</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F6E56">Your listing is now promoted</h1>
      ${property_address ? `<p style="margin:0 0 8px;font-size:14px;color:#444441">${escape(property_address)}</p>` : ''}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px">${rows}</table>
      ${button(`${SELLER_PORTAL}/properties`, 'View your listings')}
    `,
  })
  return { subject, html }
}

export async function sendSellerEmail({ to, subject, html }) {
  const resend = getResend()
  if (!resend) {
    console.warn('[sellerEmail] RESEND_API_KEY not set; skipping email to', to)
    return false
  }
  if (!to) return false
  try {
    await resend.emails.send({ from: FROM, to, subject, html })
    return true
  } catch (e) {
    console.error('[sellerEmail] send failed:', e?.message || e)
    return false
  }
}
