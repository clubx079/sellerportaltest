import { NextResponse } from 'next/server';
import { createClient } from '@airostack/client';
import { getPhoneChange, clearPhoneChange } from '@/lib/phone-change-store';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// POST /api/seller/change-phone/verify  { sellerId, otp }
export async function POST(request) {
  try {
    const { sellerId, otp } = await request.json();
    if (!sellerId || !otp) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    const pending = getPhoneChange(sellerId);
    if (!pending) return NextResponse.json({ error: 'No pending change, or the code expired. Start again.' }, { status: 400 });
    if (String(otp).trim() !== pending.otp) return NextResponse.json({ error: 'Incorrect code' }, { status: 401 });

    const supabase = getSupabase();
    const { error } = await supabase.from('seller_applications').update({ phone: pending.newPhone }).eq('id', sellerId);
    if (error) return NextResponse.json({ error: 'Failed to update phone' }, { status: 500 });
    clearPhoneChange(sellerId);
    return NextResponse.json({ ok: true, newPhone: pending.newPhone });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
