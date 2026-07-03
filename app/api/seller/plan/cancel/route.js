import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

const FROM = process.env.RESEND_FROM_EMAIL || 'DeelMap <notifications@deelmap.com>'
const SELLER_URL = (process.env.NEXT_PUBLIC_SELLER_PORTAL_URL || 'https://sell.deelmap.com').replace(/\/$/, '')
const DEELMAP_URL = (process.env.NEXT_PUBLIC_DEELMAP_VIEW_BASE_URL || 'https://deelmap.com').replace(/\/$/, '')
const FEEDBACK_SECRET = process.env.FEEDBACK_LINK_SECRET || process.env.CONTRACT_DOWNLOAD_SECRET || 'deelmap-feedback-dev-secret'

// Feedback deep link (token must match deelmap/lib/feedbackToken.js).
function feedbackUrl({ uid, type, source }) {
  const payload = Buffer.from(JSON.stringify({ uid: uid || null, type: type || 'anon', source: source || 'general' })).toString('base64url')
  const sig = crypto.createHmac('sha256', FEEDBACK_SECRET).update(payload).digest('base64url').slice(0, 24)
  return `${DEELMAP_URL}/feedback?fid=${payload}.${sig}`
}

function buildCancellationEmail({ name, planType, periodEnd, manageUrl, feedbackLink }) {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const first = (name || 'there').split(' ')[0]
  const dateStr = periodEnd ? new Date(periodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'the end of your billing period'
  const planLabel = planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'DeelMap'
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr><td style="background:#ffffff;padding:12px 40px;text-align:center;border-bottom:2px solid #D03839">
        <img src="https://deelmap.com/deelmap.png" alt="DeelMap" height="72" style="display:inline-block;height:72px;width:auto;border:0" />
      </td></tr>
      <tr><td style="padding:36px 40px 32px;background:#ffffff">
        <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${esc(first)},</p>
        <p style="margin:0 0 18px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Sorry to see you go</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Your <strong>${esc(planLabel)}</strong> plan is scheduled to end on <strong>${esc(dateStr)}</strong>. You'll keep full access until then — nothing changes before that date, and your listings stay live.</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">If something wasn't working for you, we'd genuinely like to know — it helps us do better. And if you change your mind, you can manage or restart your plan anytime.</p>
        <table cellpadding="0" cellspacing="0" style="margin:24px 0 4px"><tr>
          <td style="background:#D03839;border-radius:4px">
            <a href="${manageUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">Manage my subscription &rarr;</a>
          </td></tr></table>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#737370">Mind telling us why you're leaving? <a href="${feedbackLink}" style="color:#D03839;text-decoration:none;font-weight:600">Share your feedback</a>.</p>
      </td></tr>
      <tr><td style="background:#ffffff;border-top:1px solid #E8E8E4;padding:20px 40px;text-align:center">
        <p style="margin:0 0 4px;font-size:12px;color:#A8A8A4">Questions? <a href="https://deelmap.com/contact" style="color:#737370;text-decoration:underline">Reach us through our contact page</a></p>
        <p style="margin:0;font-size:12px;color:#A8A8A4">© 2026 DeelMap. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
  return { subject: 'Your DeelMap plan is set to cancel', html }
}

// #6 — fire a one-time "sorry to see you go" email when a seller cancels. Best-effort,
// deduped per subscription, suppressed if the seller opted out of emails.
async function sendCancellationFollowup(supabase, sellerId, plan) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return
    const { data: seller } = await supabase.from('seller_applications')
      .select('id, email, contact_person_name, business_name').eq('id', sellerId).maybeSingle()
    if (!seller?.email) return
    const entityId = plan.stripe_subscription_id
    const { data: led } = await supabase.from('followup_emails').select('id')
      .eq('recipient_id', sellerId).eq('followup_type', 'cancellation').eq('entity_id', entityId).maybeSingle()
    if (led) return // already emailed for this subscription's cancellation
    const { data: unsub } = await supabase.from('email_unsubscribes').select('email').eq('email', seller.email.toLowerCase()).maybeSingle()
    if (unsub) return
    const { subject, html } = buildCancellationEmail({
      name: seller.contact_person_name || seller.business_name || '',
      planType: plan.plan_type,
      periodEnd: plan.current_period_end,
      manageUrl: `${SELLER_URL}/billing`,
      feedbackLink: feedbackUrl({ uid: seller.id, type: 'seller', source: 'cancellation' }),
    })
    const resend = new Resend(apiKey)
    await resend.emails.send({ from: FROM, to: seller.email, subject, html })
    await supabase.from('followup_emails').insert({
      recipient_id: sellerId, recipient_type: 'seller', followup_type: 'cancellation',
      entity_id: entityId, sent_count: 1, last_sent_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[cancellation-followup]', e?.message || e)
  }
}

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    const { seller_id } = await request.json()
    if (!seller_id) return NextResponse.json({ error: 'seller_id is required' }, { status: 400 })

    const { data: plan, error: planErr } = await supabase
      .from('seller_plans')
      .select('stripe_subscription_id, status, current_period_end, plan_type, billing_cycle')
      .eq('seller_id', seller_id)
      .maybeSingle()

    if (planErr || !plan?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    if (plan.status === 'canceled') {
      return NextResponse.json({ error: 'Subscription is already canceled' }, { status: 400 })
    }

    if (plan.status === 'canceling') {
      return NextResponse.json({ error: 'Subscription cancellation is already pending' }, { status: 400 })
    }

    // If the subscription is managed by a schedule, release it first —
    // Stripe blocks cancel_at_period_end updates on schedule-managed subscriptions.
    const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id)
    const scheduleId = sub.schedule
      ? (typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id)
      : null

    if (scheduleId) {
      await stripe.subscriptionSchedules.release(scheduleId)
    }

    // Cancel at period end — subscription stays active until current_period_end
    await stripe.subscriptions.update(plan.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // Mark locally as 'canceling' so UI reflects state immediately without waiting for webhook
    await supabase
      .from('seller_plans')
      .update({ status: 'canceling', updated_at: new Date().toISOString() })
      .eq('seller_id', seller_id)

    // #6 — one-time cancellation follow-up email (best-effort; never blocks the cancel)
    await sendCancellationFollowup(supabase, seller_id, plan)

    return NextResponse.json({
      success: true,
      period_end: plan.current_period_end,
    })
  } catch (err) {
    console.error('[plan/cancel]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
