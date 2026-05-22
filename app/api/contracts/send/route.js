import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'DeelMap Contracts <noreply@deelmap.com>'
const DOCUSEAL_BASE = 'https://api.docuseal.com'

function dsHeaders() {
  return { 'X-Auth-Token': process.env.DOCUSEAL_API_KEY, 'Content-Type': 'application/json' }
}

// POST /api/contracts/send
// Manually triggers the assignee notification — same logic as the webhook but on demand.
// Use when webhook hasn't fired or for manual resend.
export async function POST(request) {
  try {
    const { submission_id } = await request.json()
    if (!submission_id) return NextResponse.json({ error: 'submission_id required' }, { status: 400 })

    // Fetch full submission from DocuSeal
    const subRes = await fetch(`${DOCUSEAL_BASE}/submissions/${submission_id}`, { headers: dsHeaders() })
    if (!subRes.ok) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    const sub = await subRes.json()

    // Validate: Assignor must have completed
    const assignor = sub.submitters?.find(s => s.role === 'Assignor')
    if (!assignor || assignor.status !== 'completed') {
      return NextResponse.json({ error: 'Assignor has not completed signing yet' }, { status: 400 })
    }

    // Get real assignee info from metadata
    const metadata = sub.metadata || {}
    const assigneeEmail = metadata.assigneeEmail
    const assigneeName = metadata.assigneeName

    if (!assigneeEmail) {
      return NextResponse.json({ error: 'No assignee email in submission metadata' }, { status: 400 })
    }

    // Find Assignee submitter
    const assignee = sub.submitters?.find(s => s.role === 'Assignee')
    if (!assignee?.id) return NextResponse.json({ error: 'Assignee submitter not found' }, { status: 404 })

    // PATCH Assignee with real email (activates them in DocuSeal)
    const patchRes = await fetch(`${DOCUSEAL_BASE}/submitters/${assignee.id}`, {
      method: 'PATCH',
      headers: dsHeaders(),
      body: JSON.stringify({ email: assigneeEmail, name: assigneeName }),
    })
    if (!patchRes.ok) {
      return NextResponse.json({ error: 'Failed to update assignee in DocuSeal' }, { status: 500 })
    }

    const assignorName = assignor.name || assignor.email || 'The Assignor'
    const property = sub.name || ''
    const signingUrl = `https://docuseal.com/s/${assignee.slug}`

    // Send email to assignee
    await resend.emails.send({
      from: FROM,
      to: assigneeEmail,
      subject: property
        ? `Action Required: Contract Ready to Sign — ${property}`
        : 'Action Required: A Contract is Ready for Your Signature',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F3;padding:40px 16px;">
            <tr><td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #E8E8E4;">
                <tr>
                  <td style="background:#D03839;padding:24px 32px;">
                    <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">DeelMap</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 8px;font-size:13px;color:#737370;">Hello${assigneeName ? ` ${assigneeName}` : ''},</p>
                    <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1A1816;line-height:1.3;">
                      A contract is ready for your signature
                    </h1>
                    ${property ? `
                    <div style="background:#FAFAF8;border:1px solid #E8E8E4;border-radius:6px;padding:14px 16px;margin-bottom:20px;">
                      <p style="margin:0;font-size:11px;font-weight:600;color:#737370;text-transform:uppercase;letter-spacing:0.5px;">Property</p>
                      <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1A1816;">${property}</p>
                    </div>` : ''}
                    <p style="margin:0 0 24px;font-size:14px;color:#444441;line-height:1.6;">
                      <strong>${assignorName}</strong> has completed their portion of the contract and is waiting for your signature.
                    </p>
                    <a href="${signingUrl}" style="display:inline-block;background:#D03839;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:6px;">
                      Review &amp; Sign Contract →
                    </a>
                    <p style="margin:24px 0 0;font-size:12px;color:#A8A8A4;line-height:1.6;">
                      Or copy this link:<br>
                      <span style="color:#737370;word-break:break-all;">${signingUrl}</span>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 32px;border-top:1px solid #E8E8E4;">
                    <p style="margin:0;font-size:11px;color:#A8A8A4;">Powered by DeelMap · Secure, legally binding e-signatures</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      text: `Hello${assigneeName ? ` ${assigneeName}` : ''},\n\n${assignorName} has completed their portion of the contract${property ? ` for ${property}` : ''}.\n\nSign here: ${signingUrl}\n\n— DeelMap`,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contracts/send]', err)
    return NextResponse.json({ error: 'Failed to send contract' }, { status: 500 })
  }
}
