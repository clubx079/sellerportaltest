import { NextResponse } from 'next/server'
import { createClient } from '@airostack/client'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

function getSellerId(request) {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  return null
}

// POST /api/team/[id]/resend — re-send the invite email for a pending member.
// Only the org owner may resend. The same invite_token (link) is reused.
export async function POST(request, { params }) {
  const sellerId = getSellerId(request)
  if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id: memberId } = await params

    const { data: member } = await supabase
      .from('org_members')
      .select('id, org_id, email, name, status, invite_token')
      .eq('id', memberId)
      .maybeSingle()

    if (!member) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    if (member.status === 'active') {
      return NextResponse.json({ error: 'This member has already accepted their invite' }, { status: 409 })
    }

    const { data: org } = await supabase
      .from('seller_organizations')
      .select('owner_seller_id, name')
      .eq('id', member.org_id)
      .maybeSingle()

    if (!org || org.owner_seller_id !== sellerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: owner } = await supabase
      .from('seller_applications')
      .select('contact_person_name, email')
      .eq('id', sellerId)
      .maybeSingle()

    // Refresh the invited_at timestamp so the 7-day window restarts.
    await supabase
      .from('org_members')
      .update({ invited_at: new Date().toISOString() })
      .eq('id', memberId)

    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sell.deelmap.com'}/team/accept?token=${member.invite_token}`
    const inviterName = (owner?.contact_person_name || 'Someone').replace(/</g, '&lt;')
    const inviteeName = (member.name || member.email).replace(/</g, '&lt;')

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'DeelMap <notifications@deelmap.com>',
      to: member.email,
      subject: `${owner?.contact_person_name || 'A DeelMap user'} invited you to join their DeelMap team`,
      html: `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr>
        <td style="background:#ffffff;padding:12px 40px;text-align:center;border-bottom:2px solid #D03839">
          <img src="https://deelmap.com/deelmap.png" alt="DeelMap" height="72" style="display:inline-block;height:72px;width:auto;border:0" />
        </td>
      </tr>
      <tr>
        <td style="padding:36px 40px 32px;background:#ffffff">
          <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${inviteeName},</p>
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">You've been invited to join a team</h1>
          <p style="margin:0 0 28px;font-size:14px;line-height:1.65;color:#737370"><strong style="color:#1A1816">${inviterName}</strong> has invited you to join their team on the DeelMap Seller Portal. Click the button below to create your account and get started.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr><td>
              <a href="${acceptUrl}" style="display:inline-block;background:#D03839;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:4px;text-decoration:none;letter-spacing:0.1px">Accept Invitation</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;color:#A8A8A4;line-height:1.6">This link expires in 7 days. If you weren't expecting this invitation, you can safely ignore this email.</p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;border-top:1px solid #E8E8E4;padding:20px 40px;text-align:center">
          <p style="margin:0 0 4px;font-size:12px;color:#A8A8A4">Questions? <a href="https://sell.deelmap.com/support" style="color:#737370;text-decoration:underline">Reach us through our Contact Us page</a></p>
          <p style="margin:0;font-size:12px;color:#A8A8A4">© 2026 DeelMap. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </td></tr></table>
</body></html>`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[team resend]', err)
    return NextResponse.json({ error: 'Failed to resend invitation' }, { status: 500 })
  }
}
