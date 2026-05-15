import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'DeelMap Contracts <noreply@deelmap.com>'

export async function POST(request) {
  try {
    const body = await request.json()
    const { event_type, data } = body

    if (event_type !== 'submitter.completed') return NextResponse.json({ ok: true })
    if (!data?.submission?.submitters) return NextResponse.json({ ok: true })

    const completedRole = data.role
    if (completedRole !== 'Assignor') return NextResponse.json({ ok: true })

    const assignee = data.submission.submitters.find(s => s.role === 'Assignee')
    if (!assignee?.slug || !assignee?.email) return NextResponse.json({ ok: true })

    const assignorName = data.name || data.email || 'The Assignor'
    const property = data.submission.name || ''
    const signingUrl = `https://docuseal.com/s/${assignee.slug}`

    await resend.emails.send({
      from: FROM,
      to: assignee.email,
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

                <!-- Header -->
                <tr>
                  <td style="background:#D03839;padding:24px 32px;">
                    <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">DeelMap</span>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 8px;font-size:13px;color:#737370;">Hello${assignee.name ? ` ${assignee.name}` : ''},</p>
                    <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1A1816;line-height:1.3;">
                      A contract is ready for your signature
                    </h1>

                    ${property ? `
                    <div style="background:#FAFAF8;border:1px solid #E8E8E4;border-radius:6px;padding:14px 16px;margin-bottom:20px;">
                      <p style="margin:0;font-size:11px;font-weight:600;color:#737370;text-transform:uppercase;letter-spacing:0.5px;">Property</p>
                      <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1A1816;">${property}</p>
                    </div>` : ''}

                    <p style="margin:0 0 24px;font-size:14px;color:#444441;line-height:1.6;">
                      <strong>${assignorName}</strong> has completed their portion of the contract and is waiting for your signature as the <strong>Assignee</strong>.
                    </p>

                    <a href="${signingUrl}" style="display:inline-block;background:#D03839;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:6px;">
                      Review &amp; Sign Contract →
                    </a>

                    <p style="margin:24px 0 0;font-size:12px;color:#A8A8A4;line-height:1.6;">
                      Or copy this link into your browser:<br>
                      <span style="color:#737370;word-break:break-all;">${signingUrl}</span>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:16px 32px;border-top:1px solid #E8E8E4;">
                    <p style="margin:0;font-size:11px;color:#A8A8A4;">
                      Powered by DeelMap · Secure, legally binding e-signatures
                    </p>
                  </td>
                </tr>

              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      text: `Hello${assignee.name ? ` ${assignee.name}` : ''},\n\n${assignorName} has completed their portion of the contract${property ? ` for ${property}` : ''} and is waiting for your signature as the Assignee.\n\nSign here: ${signingUrl}\n\n— DeelMap`,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
