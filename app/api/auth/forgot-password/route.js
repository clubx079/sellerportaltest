import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { setResetOtp } from '@/lib/password-reset-store';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    const { data: seller } = await supabase
      .from('seller_applications')
      .select('id, email, contact_person_name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    // Keep response generic to avoid account enumeration.
    if (!seller) {
      return NextResponse.json({ message: 'If this email exists, a verification code has been sent.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setResetOtp(normalizedEmail, otp);

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ message: 'Reset code generated. Email service is not configured.' });
    }
    const resend = new Resend(resendKey);
    // Same logo URL and markup as buyer website emails (seller portal /deelmap.png)
    const logoBase = (process.env.NEXT_PUBLIC_SELLER_PORTAL_URL || 'https://sellerportaldeelmap-production.up.railway.app').replace(/\/$/, '');
    const logoUrl = `${logoBase}/deelmap.png`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reset your seller password</title>
</head>
<body style="margin:0;padding:0;background:#f3f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6f8;padding:20px 10px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
          <tr>
            <td style="background:#022b41;padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="vertical-align:middle;">
                    <img src="${logoUrl}" alt="Deelmap" width="160" height="48" style="display:block;max-width:160px;height:auto;border:0;margin:0 auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;text-align:center">
              <h1 style="margin:0 0 20px;font-size:22px;line-height:1.25;font-weight:700;color:#0f172a;text-align:center">Reset your seller password</h1>
              <p style="margin:0 0 12px;font-size:15px;color:#334155;text-align:center">Hi ${(seller.contact_person_name || 'Seller').replace(/</g, '&lt;')},</p>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#64748b;text-align:center">Use this verification code to reset your seller dashboard password. This code expires in 15 minutes.</p>
              <div style="margin:16px 0 20px;text-align:center">
                <span style="display:inline-block;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px 18px;font-size:30px;letter-spacing:5px;font-weight:700;color:#022b41;font-family:'Courier New',monospace">${otp}</span>
              </div>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center">If you did not request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 40px;background-color:#ffffff;border-top:1px solid #e5e7eb;text-align:center">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:10px;">
                    <p style="margin:0 0 10px 0;font-size:14px;color:#374151;font-weight:500;text-align:center">Thanks,<br>DeelMap Team</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:5px;">
                    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">2464 Royal Ln. Mesa, New Jersey 45463</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">© 2026 DeelMap</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Deelmap <notifications@deelmap.com>',
      to: [normalizedEmail],
      subject: `${otp} is your seller password reset code`,
      html
    });

    return NextResponse.json({ message: 'Verification code sent successfully.' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to send reset code.' }, { status: 500 });
  }
}
