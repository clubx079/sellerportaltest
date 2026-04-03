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

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr>
        <td style="background:#ffffff;padding:24px 40px;text-align:center;border-bottom:2px solid #D03839">
          <img src="https://sellerportaldeelmap-production.up.railway.app/deelmap-new.png" alt="Deelmap" height="36" style="display:inline-block;height:36px;width:auto;border:0" />
        </td>
      </tr>
      <tr>
        <td style="padding:36px 40px 32px;background:#ffffff">
          <p style="margin:0 0 6px;font-size:14px;color:#737370">Hi ${(seller.contact_person_name || 'there').replace(/</g, '&lt;')},</p>
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1A1816;letter-spacing:-0.4px;line-height:1.25">Reset your password</h1>
          <p style="margin:0 0 28px;font-size:14px;line-height:1.65;color:#737370">Use the code below to reset your seller dashboard password. It expires in 15 minutes.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr><td align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#FAFAF8;border:1px solid #E8E8E4;border-radius:4px;padding:20px 32px;text-align:center">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#A8A8A4">Password reset code</p>
                    <p style="margin:0;font-size:36px;font-weight:700;color:#1A1816;font-family:'Courier New',monospace;letter-spacing:6px;line-height:1.2">${otp}</p>
                    <p style="margin:8px 0 0;font-size:12px;color:#A8A8A4">Expires in 15 minutes</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;color:#A8A8A4;line-height:1.6">If you didn't request this, you can safely ignore this email.</p>
        </td>
      </tr>
      <tr>
        <td style="background:#FAFAF8;border-top:1px solid #E8E8E4;padding:20px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#A8A8A4">© 2026 Deelmap. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </td></tr></table>
</body></html>`;

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
