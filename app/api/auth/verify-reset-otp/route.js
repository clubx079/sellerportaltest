import { NextResponse } from 'next/server';
import { getResetOtp, markResetOtpVerified } from '@/lib/password-reset-store';

export async function POST(request) {
  try {
    const { email, otp } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedOtp = String(otp || '').trim();

    if (!normalizedEmail || !normalizedOtp) {
      return NextResponse.json({ message: 'Email and code are required.' }, { status: 400 });
    }

    const row = getResetOtp(normalizedEmail);
    if (!row) {
      return NextResponse.json({ message: 'Invalid or expired reset session.' }, { status: 400 });
    }
    if (Date.now() > row.expires) {
      return NextResponse.json({ message: 'Reset code has expired.' }, { status: 400 });
    }
    if (row.otp !== normalizedOtp) {
      return NextResponse.json({ message: 'Invalid verification code.' }, { status: 400 });
    }

    markResetOtpVerified(normalizedEmail);
    return NextResponse.json({ message: 'Code verified successfully.' });
  } catch {
    return NextResponse.json({ message: 'Failed to verify code.' }, { status: 500 });
  }
}
