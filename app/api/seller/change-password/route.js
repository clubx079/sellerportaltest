import { NextResponse } from 'next/server';
import { createClient } from '@airostack/client';
import { verifyPassword, hashPassword } from '@/lib/password';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function POST(request) {
  try {
    const { sellerId, currentPassword, newPassword } = await request.json();
    if (!sellerId || !currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (String(newPassword).length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }
    const supabase = getSupabase();
    const { data: seller } = await supabase
      .from('seller_applications').select('id, password').eq('id', sellerId).maybeSingle();
    if (!seller) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const ok = await verifyPassword(currentPassword, seller.password);
    if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });

    const hashed = await hashPassword(newPassword);
    const { error } = await supabase
      .from('seller_applications').update({ password: hashed, updated_at: new Date().toISOString() }).eq('id', sellerId);
    if (error) return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
