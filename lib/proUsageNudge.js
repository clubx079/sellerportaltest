import { Resend } from 'resend'

// ── #5 Pro-plan usage → Enterprise upgrade nudge ────────────────────────────
// Shared by the listings actions route (activate/unpause path) and the
// publish-new-listing path (app/api/seller/listings/usage-nudge). Sends at most
// once per threshold (1-left / used-all) per billing period, deduped via the
// followup_emails ledger, and respects email opt-out.
export const PRO_LISTING_CAP = 5 // Pro allows a max of 5 listings (see plans/upgrade page)
const NUDGE_FROM = process.env.RESEND_FROM_EMAIL || 'DeelMap <notifications@deelmap.com>'

export function buildProUsageEmail({ name, remaining, upgradeUrl }) {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const first = (name || '').trim().split(/\s+/)[0] || 'there'
  const usedAll = remaining === 0
  const subject = usedAll
    ? "You've used all your Pro listings — upgrade to Enterprise"
    : 'Only 1 Pro listing left — time to consider Enterprise'
  const heading = usedAll ? "You've used all your Pro listings" : 'You have just 1 listing left'
  const line = usedAll
    ? `You've now used all ${PRO_LISTING_CAP} listings included in your Pro plan, so you can't post another until one frees up — or you move up to Enterprise for more room to grow.`
    : `You're down to your last available listing on the Pro plan (${PRO_LISTING_CAP - 1} of ${PRO_LISTING_CAP} used). Upgrade to Enterprise before you run out and keep listing without interruption.`
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr><td style="background:#ffffff;padding:12px 40px;text-align:center;border-bottom:2px solid #D03839">
        <img src="https://deelmap.com/deelmap.png" alt="DeelMap" height="64" style="display:inline-block;height:64px;width:auto;border:0" />
      </td></tr>
      <tr><td style="padding:36px 40px 32px;background:#ffffff">
        <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${esc(first)},</p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">${esc(heading)}</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">${esc(line)}</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#444441">Enterprise gives you more listings, promoted placement, and team access, so you can scale without hitting limits.</p>
        <table cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr>
          <td style="background:#D03839;border-radius:4px;">
            <a href="${upgradeUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Upgrade to Enterprise &rarr;</a>
          </td></tr></table>
      </td></tr>
      <tr><td style="background:#ffffff;border-top:1px solid #E8E8E4;padding:20px 40px;text-align:center">
        <p style="margin:0;font-size:12px;color:#A8A8A4">© 2026 DeelMap. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
  return { subject, html }
}

// Send at most once per threshold (1-left / used-all) per billing period.
// `newUsed` is the number of slots the seller has consumed (live listings).
export async function maybeProUsageNudge(supabase, effectiveSellerId, newUsed) {
  try {
    if (typeof newUsed !== 'number' || newUsed < PRO_LISTING_CAP - 1) return
    const { data: plan } = await supabase.from('seller_plans')
      .select('plan_type, current_period_start').eq('seller_id', effectiveSellerId).maybeSingle()
    if (!plan || plan.plan_type !== 'pro') return
    const remaining = Math.max(0, PRO_LISTING_CAP - newUsed)
    if (remaining > 1) return
    const threshold = remaining === 0 ? 'used_all' : 'one_left'
    const period = (plan.current_period_start || '').slice(0, 10) || 'na'
    const entityId = `${threshold}:${period}`
    const { data: led } = await supabase.from('followup_emails').select('id')
      .eq('recipient_id', effectiveSellerId).eq('followup_type', 'pro_usage').eq('entity_id', entityId).maybeSingle()
    if (led) return // already nudged for this threshold this period
    const { data: seller } = await supabase.from('seller_applications')
      .select('email, contact_person_name, business_name').eq('id', effectiveSellerId).maybeSingle()
    if (!seller?.email) return
    const { data: unsub } = await supabase.from('email_unsubscribes').select('email').eq('email', seller.email.toLowerCase()).maybeSingle()
    if (unsub) return // respect opt-out
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return
    const sellerBase = (process.env.NEXT_PUBLIC_SELLER_PORTAL_URL || 'https://sell.deelmap.com').replace(/\/$/, '')
    const name = seller.contact_person_name || seller.business_name || ''
    const { subject, html } = buildProUsageEmail({ name, remaining, upgradeUrl: `${sellerBase}/plans/upgrade/enterprise` })
    const resend = new Resend(apiKey)
    await resend.emails.send({ from: NUDGE_FROM, to: seller.email, subject, html })
    await supabase.from('followup_emails').insert({
      recipient_id: effectiveSellerId, recipient_type: 'seller', followup_type: 'pro_usage',
      entity_id: entityId, sent_count: 1, last_sent_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[pro-usage-nudge]', e?.message || e)
  }
}
