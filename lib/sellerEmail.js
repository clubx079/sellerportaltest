// Shared DeelMap seller-portal transactional email templates.
// All sends are fire-and-forget; failures are logged but do not block the caller.

import { Resend } from 'resend'

const FROM = process.env.RESEND_FROM_EMAIL || 'DeelMap <notifications@deelmap.com>'
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
          <img src="${LOGO}" alt="DeelMap" height="72" style="display:inline-block;height:72px;width:auto;border:0" />
        </td>
      </tr>
      <tr><td style="padding:36px 40px 32px;background:#ffffff">${body}</td></tr>
      <tr>
        <td style="background:#ffffff;border-top:1px solid #E8E8E4;padding:18px 40px;text-align:center">
          <p style="margin:0 0 4px;font-size:12px;color:#737370">Questions? <a href="${SELLER_PORTAL}/support" style="color:#1A1816;text-decoration:underline">Reach us through our Contact Us page</a></p>
          <p style="margin:0;font-size:12px;color:#A8A8A4">&copy; ${new Date().getFullYear()} DeelMap. All rights reserved.</p>
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
  const subject = 'Welcome to DeelMap'
  const html = shell({
    preheader: 'Your DeelMap seller account is ready — and we’d love your first impression.',
    body: `
      <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${escape(first) || 'there'},</p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Welcome to DeelMap</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Thank you for joining DeelMap. Your seller account is ready — you can list deals, connect with verified buyers, accept offers, and send contracts for e-signature, all in one place.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">We're continually improving the platform, and your perspective as a seller is invaluable. Would you take two minutes to tell us how the experience looks and feels, and whether anything could be smoother? Your feedback goes straight to our team.</p>
      <table cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr>
        <td style="background:#D03839;border-radius:4px">
          <a href="${SELLER_PORTAL}/support" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">Share your feedback &rarr;</a>
        </td>
      </tr></table>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.65;color:#737370">Ready to get started? <a href="${SELLER_PORTAL}/dashboard" style="color:#D03839;text-decoration:none;font-weight:600">Post your first listing</a> from your dashboard.</p>
      <p style="margin:28px 0 0;font-size:14px;line-height:1.65;color:#444441">Welcome aboard,<br/>The DeelMap Team</p>
    `,
  })
  return { subject, html }
}

// 2. Payment receipt — fires on payment_intent.succeeded + invoice.payment_succeeded
export function emailPaymentReceipt({ name, amount_cents, description, receipt_url }) {
  const first = (name || '').trim().split(/\s+/)[0] || ''
  const subject = `Your DeelMap receipt — ${money(amount_cents)}`
  const html = shell({
    preheader: `We received your payment of ${money(amount_cents)}.`,
    body: `
      <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${escape(first) || 'there'},</p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Payment received</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Thank you — we've received your payment of <strong>${money(amount_cents)}</strong>${description ? ` for <strong>${escape(description)}</strong>` : ''}. This email is your receipt; no action is needed.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #E8E8E4;border-radius:4px;margin:4px 0 4px">
        <tr><td style="padding:12px 16px;background:#FAFAF8;font-size:12px;font-weight:600;color:#737370;width:120px;border-bottom:1px solid #E8E8E4">Amount</td><td style="padding:12px 16px;font-size:14px;font-weight:600;color:#1A1816;border-bottom:1px solid #E8E8E4">${money(amount_cents)}</td></tr>
        ${description ? `<tr><td style="padding:12px 16px;background:#FAFAF8;font-size:12px;font-weight:600;color:#737370">For</td><td style="padding:12px 16px;font-size:14px;color:#1A1816">${escape(description)}</td></tr>` : ''}
      </table>
      ${receipt_url ? button(receipt_url, 'View full receipt', '#1A1816') : button(`${SELLER_PORTAL}/billing`, 'View billing')}
      <p style="margin:24px 0 0;font-size:14px;line-height:1.65;color:#444441">Thanks,<br/>The DeelMap Team</p>
    `,
  })
  return { subject, html }
}

// 3. Subscription created — fires on customer.subscription.created (trial or paid)
export function emailSubscriptionCreated({ name, plan_type, billing_cycle, trial_ends_at }) {
  const first = (name || '').trim().split(/\s+/)[0] || ''
  const isTrial = !!trial_ends_at
  const planLabel = `${(plan_type || 'plan').charAt(0).toUpperCase()}${(plan_type || '').slice(1)}`.trim()
  const cycle = billing_cycle ? ` (${billing_cycle})` : ''
  const subject = isTrial ? `Your DeelMap ${planLabel} trial has started` : `You're now on DeelMap ${planLabel}`

  const trialBody = `
      <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${escape(first) || 'there'},</p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Your ${escape(planLabel)} trial has started</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Your <strong>${escape(planLabel)}${escape(cycle)}</strong> plan is now active on a free trial through <strong>${formatDate(trial_ends_at)}</strong>. You won't be charged until then, and you can cancel anytime before that date.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Everything in ${escape(planLabel)} is unlocked. The best way to start is to post your first deal and begin connecting with verified buyers.</p>
      ${button(`${SELLER_PORTAL}/dashboard`, 'Open your dashboard')}
      <p style="margin:24px 0 0;font-size:14px;line-height:1.65;color:#444441">Welcome to ${escape(planLabel)},<br/>The DeelMap Team</p>`

  const paidBody = `
      <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${escape(first) || 'there'},</p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">You're now on ${escape(planLabel)}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Your <strong>${escape(planLabel)}${escape(cycle)}</strong> subscription is active and every feature it includes is unlocked.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Jump back in — post your next deal and keep the conversations with buyers moving.</p>
      ${button(`${SELLER_PORTAL}/dashboard`, 'Open your dashboard')}
      <p style="margin:24px 0 0;font-size:14px;line-height:1.65;color:#444441">Thanks for being with us,<br/>The DeelMap Team</p>`

  const html = shell({
    preheader: isTrial
      ? `Your ${planLabel} trial is active through ${formatDate(trial_ends_at)} — no charge until then.`
      : `Your ${planLabel}${cycle} subscription is active.`,
    body: isTrial ? trialBody : paidBody,
  })
  return { subject, html }
}

// 4. Trial converted to paid — fires on customer.subscription.updated when status moves trialing -> active
export function emailTrialConverted({ name, plan_type, billing_cycle, next_charge_amount_cents, next_charge_at }) {
  const first = (name || '').trim().split(/\s+/)[0] || ''
  const planLabel = `${(plan_type || 'plan').charAt(0).toUpperCase()}${(plan_type || '').slice(1)}`.trim()
  const cycle = billing_cycle ? ` (${billing_cycle})` : ''
  const subject = `You're now on DeelMap ${planLabel}`
  const html = shell({
    preheader: `Your free trial has ended — your ${planLabel} subscription is now active.`,
    body: `
      <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${escape(first) || 'there'},</p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Your trial has ended — you're on ${escape(planLabel)}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Your free trial has ended and your <strong>${escape(planLabel)}${escape(cycle)}</strong> subscription is now active, so you keep full access to every feature without interruption.</p>
      ${next_charge_amount_cents ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Your next payment of <strong>${money(next_charge_amount_cents)}</strong>${next_charge_at ? ` is scheduled for <strong>${formatDate(next_charge_at)}</strong>` : ''}. You can review or change your plan anytime from billing.</p>` : ''}
      ${button(`${SELLER_PORTAL}/billing`, 'View billing')}
      <p style="margin:24px 0 0;font-size:14px;line-height:1.65;color:#444441">Thanks for being with us,<br/>The DeelMap Team</p>
    `,
  })
  return { subject, html }
}

// 5. Payment failed — fires on invoice.payment_failed
export function emailPaymentFailed({ name, amount_cents, hosted_invoice_url }) {
  const first = (name || '').trim().split(/\s+/)[0] || ''
  const subject = 'Action needed: your DeelMap payment didn’t go through'
  const html = shell({
    preheader: 'Update your payment method to keep your subscription active.',
    body: `
      <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${escape(first) || 'there'},</p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#D03839;letter-spacing:-0.4px;line-height:1.25">We couldn't process your payment</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">We tried to charge${amount_cents ? ` <strong>${money(amount_cents)}</strong>` : ' your card'} for your DeelMap subscription, but it didn't go through — this usually means an expired card or a temporary decline.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Please update your payment method so your subscription and active listings aren't interrupted. We'll automatically retry once your card is updated.</p>
      ${button(`${SELLER_PORTAL}/billing`, 'Update your card')}
      ${hosted_invoice_url ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.65;color:#737370">Prefer to pay this invoice directly? <a href="${hosted_invoice_url}" style="color:#D03839;text-decoration:none;font-weight:600">Retry the payment here</a>.</p>` : ''}
      <p style="margin:24px 0 0;font-size:14px;line-height:1.65;color:#444441">Thanks,<br/>The DeelMap Team</p>
    `,
  })
  return { subject, html }
}

// 6. Listing promoted / featured confirmation — fires per add-on purchased
export function emailListingPromoted({ name, addons, property_address }) {
  // addons: [{ type, ends_at }]
  const first = (name || '').trim().split(/\s+/)[0] || ''
  const labels = { highlight: 'Highlight', boost: 'Boost', homepage: 'Homepage Feature', bundle: 'Search Visibility Bundle' }
  const rows = (addons || []).map(a => `<tr>
    <td style="padding:12px 16px;background:#FAFAF8;font-size:13px;font-weight:600;color:#444441;border-bottom:1px solid #E8E8E4">${escape(labels[a.type] || a.type)}</td>
    <td style="padding:12px 16px;font-size:13px;color:#1A1816;border-bottom:1px solid #E8E8E4">${a.ends_at ? `Active through ${formatDate(a.ends_at)}` : 'Active'}</td>
  </tr>`).join('')
  const subject = `Your listing is now promoted on DeelMap`
  const html = shell({
    preheader: `Your listing${property_address ? ` at ${property_address}` : ''} is now promoted.`,
    body: `
      <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${escape(first) || 'there'},</p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Your listing is now promoted</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Your promotion is live${property_address ? ` for <strong>${escape(property_address)}</strong>` : ''}, so it will stand out to more buyers across DeelMap. Here's what's active:</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #E8E8E4;border-radius:4px;overflow:hidden;margin:4px 0">${rows}</table>
      ${button(`${SELLER_PORTAL}/properties`, 'View your listings')}
      <p style="margin:24px 0 0;font-size:14px;line-height:1.65;color:#444441">Thanks,<br/>The DeelMap Team</p>
    `,
  })
  return { subject, html }
}

// Email-change verification code — sent to the NEW address.
export function emailVerificationCode({ code, newEmail }) {
  const body = `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Confirm your new email</h1>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#737370">Use this code to confirm <strong style="color:#1A1816">${escape(newEmail)}</strong> as your new DeelMap login email:</p>
      <p style="margin:24px 0;font-size:30px;font-weight:700;letter-spacing:6px;color:#D03839">${escape(code)}</p>
      <p style="margin:0;font-size:12px;color:#A8A8A4;line-height:1.6">This code expires in 15 minutes. If you didn&rsquo;t request this, you can ignore this email — your account is unchanged.</p>`
  return shell({ body, preheader: 'Confirm your new DeelMap email' })
}

// Confirmation that the login email was changed.
export function emailChanged({ newEmail }) {
  const body = `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Your login email was changed</h1>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#737370">Your DeelMap login email is now <strong style="color:#1A1816">${escape(newEmail)}</strong>.</p>
      <p style="margin:0;font-size:12px;color:#A8A8A4;line-height:1.6">If you didn&rsquo;t make this change, please contact us right away through the Contact Us page in your portal.</p>`
  return shell({ body, preheader: 'Your DeelMap login email was changed' })
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
