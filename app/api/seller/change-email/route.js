import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { setEmailChange } from '@/lib/email-change-store';
import { verifyPassword } from '@/lib/password';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Deelmap <notifications@deelmap.com>';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// POST /api/seller/change-email
// Body: { sellerId, currentPassword, newEmail }
// Verifies the password, ensures the new email is free, and sends a 6-digit
// verification code to the NEW email address. Does NOT change anything yet.
export async function POST(request) {
  try {
    const { sellerId, currentPassword, newEmail } = await request.json();
    if (!sellerId || !currentPassword || !newEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const normalized = String(newEmail).toLowerCase().trim();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Load the seller + verify password (plaintext compare — matches current auth;
    // will become a hash compare once C1 is addressed).
    const { data: seller, error } = await supabase
      .from('seller_applications')
      .select('id, email, password')
      .eq('id', sellerId)
      .maybeSingle();
    if (error || !seller) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    if (!(await verifyPassword(currentPassword, seller.password))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }
    if (normalized === String(seller.email).toLowerCase().trim()) {
      return NextResponse.json({ error: 'That is already your email address' }, { status: 400 });
    }

    // Ensure the new email isn't already taken
    const { data: existing } = await supabase
      .from('seller_applications')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'That email is already in use by another account' }, { status: 409 });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setEmailChange(sellerId, normalized, otp);

    await resend.emails.send({
      from: FROM,
      to: normalized,
      subject: 'Verify your new DeelMap email',
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="font-size:18px;color:#1A1816;">Confirm your new email</h2>
          <p style="font-size:14px;color:#444441;line-height:1.6;">
            Use this code to confirm <strong>${normalized}</strong> as your new DeelMap login email:
          </p>
          <p style="font-size:30px;font-weight:700;letter-spacing:6px;color:#D03839;margin:24px 0;">${otp}</p>
          <p style="font-size:12px;color:#A8A8A4;">This code expires in 15 minutes. If you didn't request this, you can ignore this email — your account is unchanged.</p>
        </div>`,
      text: `Your DeelMap email verification code is ${otp}. Expires in 15 minutes.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
