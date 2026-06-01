import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getEmailChange, clearEmailChange } from '@/lib/email-change-store';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Deelmap <notifications@deelmap.com>';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// POST /api/seller/change-email/verify
// Body: { sellerId, otp }
// Verifies the code sent to the new email, updates the account email, and
// notifies the OLD address that the change happened (security heads-up).
export async function POST(request) {
  try {
    const { sellerId, otp } = await request.json();
    if (!sellerId || !otp) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    const pending = getEmailChange(sellerId);
    if (!pending) {
      return NextResponse.json({ error: 'No pending change, or the code expired. Start again.' }, { status: 400 });
    }
    if (String(otp).trim() !== pending.otp) {
      return NextResponse.json({ error: 'Incorrect code' }, { status: 401 });
    }

    const supabase = getSupabase();

    // Grab the old email first (for the heads-up notification)
    const { data: seller } = await supabase
      .from('seller_applications')
      .select('email')
      .eq('id', sellerId)
      .maybeSingle();
    const oldEmail = seller?.email;

    // Double-check the new email is still free (race guard)
    const { data: taken } = await supabase
      .from('seller_applications')
      .select('id')
      .eq('email', pending.newEmail)
      .maybeSingle();
    if (taken && taken.id !== sellerId) {
      clearEmailChange(sellerId);
      return NextResponse.json({ error: 'That email was just taken by another account' }, { status: 409 });
    }

    const { error } = await supabase
      .from('seller_applications')
      .update({ email: pending.newEmail })
      .eq('id', sellerId);
    if (error) {
      return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
    }

    clearEmailChange(sellerId);

    // Heads-up to the old address
    if (oldEmail) {
      resend.emails.send({
        from: FROM,
        to: oldEmail,
        subject: 'Your DeelMap email was changed',
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;">
            <h2 style="font-size:18px;color:#1A1816;">Your login email was changed</h2>
            <p style="font-size:14px;color:#444441;line-height:1.6;">
              The email on your DeelMap account was just changed to <strong>${pending.newEmail}</strong>.
            </p>
            <p style="font-size:13px;color:#737370;line-height:1.6;">
              If this was you, no action is needed. If you did NOT make this change, contact support immediately at support@deelmap.com.
            </p>
          </div>`,
        text: `Your DeelMap login email was changed to ${pending.newEmail}. If this wasn't you, contact support@deelmap.com immediately.`,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, newEmail: pending.newEmail });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
