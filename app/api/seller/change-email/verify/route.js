import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEmailChange, clearEmailChange } from '@/lib/email-change-store';
import { sendSellerEmail, emailChanged } from '@/lib/sellerEmail';

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

    // Heads-up to the old address (branded; security notice)
    if (oldEmail) {
      sendSellerEmail({
        to: oldEmail,
        subject: 'Your DeelMap email was changed',
        html: emailChanged({ newEmail: pending.newEmail }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, newEmail: pending.newEmail });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
