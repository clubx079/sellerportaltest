import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Deelmap <notifications@deelmap.com>'

// Branded "please sign this contract" email. Used for EVERY signer so the whole
// chain looks identical — the first signer (from the create API) and each
// subsequent signer (from the webhook) all get this same DeelMap template.
export function signingEmail({ signerName, property, signingUrl, leadLine }) {
  const subject = property
    ? `Action Required: Contract Ready to Sign — ${property}`
    : 'Action Required: A Contract is Ready for Your Signature'
  const lead = leadLine || 'A contract is ready for your signature. Please review and sign below.'
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;">
          <tr>
            <td style="background:#ffffff;padding:12px 40px;text-align:center;border-bottom:2px solid #D03839;">
              <img src="https://deelmap.com/deelmap.png" alt="DeelMap" height="72" style="display:inline-block;height:72px;width:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 32px;background:#ffffff;">
              <p style="margin:0 0 6px;font-size:14px;color:#737370;">Hi${signerName ? ` ${signerName}` : ' there'},</p>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25;">A contract is ready for your signature</h1>
              <p style="margin:0 0 28px;font-size:14px;line-height:1.65;color:#737370;">${lead}</p>
              ${property ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr><td style="background:#FAFAF8;border:1px solid #E8E8E4;border-radius:4px;padding:14px 16px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#A8A8A4;">Property</p>
                  <p style="margin:0;font-size:14px;font-weight:600;color:#1A1816;">${property}</p>
                </td></tr>
              </table>` : ''}
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr><td style="background:#D03839;border-radius:4px;">
                  <a href="${signingUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Review &amp; Sign Contract →</a>
                </td></tr>
              </table>
              <p style="margin:0;font-size:12px;color:#A8A8A4;line-height:1.6;">
                Or copy this link:<br>
                <span style="color:#737370;word-break:break-all;">${signingUrl}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-top:1px solid #E8E8E4;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#A8A8A4;">© 2026 DeelMap. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td></tr></table>
    </body>
    </html>
  `
  const text = `Hi${signerName ? ` ${signerName}` : ''},\n\n${lead}${property ? `\n\nProperty: ${property}` : ''}\n\nSign here: ${signingUrl}\n\n— DeelMap`
  return { subject, html, text }
}

// Send the branded signing email to one signer.
export async function sendSigningEmail({ to, signerName, property, signingUrl, leadLine }) {
  const { subject, html, text } = signingEmail({ signerName, property, signingUrl, leadLine })
  return resend.emails.send({ from: FROM, to, subject, html, text })
}
