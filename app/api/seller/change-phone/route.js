import { NextResponse } from 'next/server';
import { createClient } from '@airostack/client';
import { setPhoneChange } from '@/lib/phone-change-store';
import { verifyPassword } from '@/lib/password';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function toE164(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

// POST /api/seller/change-phone  { sellerId, currentPassword, newPhone }
// Verifies password, then SMS-OTPs the NEW phone to prove ownership.
export async function POST(request) {
  try {
    const { sellerId, currentPassword, newPhone } = await request.json();
    if (!sellerId || !currentPassword || !newPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const e164 = toE164(newPhone);
    if (!e164) return NextResponse.json({ error: 'Enter a valid US phone number' }, { status: 400 });

    const supabase = getSupabase();
    const { data: seller } = await supabase
      .from('seller_applications').select('id, phone, password').eq('id', sellerId).maybeSingle();
    if (!seller) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (!(await verifyPassword(currentPassword, seller.password))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setPhoneChange(sellerId, e164, otp);

    const sms = await fetch('https://app.airophone.com/api/external/sms/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.AIROSOFTS_SMS_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.AIROSOFTS_SMS_FROM,
        to: e164,
        message: `Your DeelMap phone verification code is ${otp}. Valid for 15 minutes. Do not share this code.`,
      }),
    });
    if (!sms.ok) return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
