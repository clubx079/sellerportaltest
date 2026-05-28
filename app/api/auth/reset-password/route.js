import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { createClient } from '@supabase/supabase-js';
import { clearResetOtp, getResetOtp } from '@/lib/password-reset-store';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { email, otp, newPassword, confirmPassword } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedOtp = String(otp || '').trim();

    if (!normalizedEmail || !normalizedOtp || !newPassword || !confirmPassword) {
      return NextResponse.json({ message: 'All fields are required.' }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ message: 'Passwords do not match.' }, { status: 400 });
    }
    if (String(newPassword).length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const row = getResetOtp(normalizedEmail);
    if (!row) {
      return NextResponse.json({ message: 'Invalid or expired reset session.' }, { status: 400 });
    }
    if (Date.now() > row.expires) {
      clearResetOtp(normalizedEmail);
      return NextResponse.json({ message: 'Reset code has expired.' }, { status: 400 });
    }
    if (!row.verified) {
      return NextResponse.json({ message: 'Please verify your code first.' }, { status: 400 });
    }
    if (row.otp !== normalizedOtp) {
      return NextResponse.json({ message: 'Invalid verification code.' }, { status: 400 });
    }

    const { data: seller } = await supabase
      .from('seller_applications')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!seller) {
      return NextResponse.json({ message: 'Seller account not found.' }, { status: 404 });
    }

    // Keep same auth scheme as current seller login (plaintext compare in login route).
    const { error: updateError } = await supabase
      .from('seller_applications')
      .update({
        password: await hashPassword(newPassword),
        updated_at: new Date().toISOString()
      })
      .eq('id', seller.id);

    if (updateError) {
      return NextResponse.json({ message: 'Failed to update password.' }, { status: 500 });
    }

    clearResetOtp(normalizedEmail);
    return NextResponse.json({ message: 'Password reset successfully.' });
  } catch {
    return NextResponse.json({ message: 'Failed to reset password.' }, { status: 500 });
  }
}
