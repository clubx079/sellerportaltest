import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const buyerId = searchParams.get('buyer_id');

  if (!buyerId) {
    return NextResponse.json({ error: 'buyer_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('offers')
    .select('status')
    .eq('buyer_id', buyerId)
    .in('status', ['accepted', 'rejected']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const accepted = data.filter(o => o.status === 'accepted').length;
  const rejected = data.filter(o => o.status === 'rejected').length;
  const total = accepted + rejected;
  const successRate = total === 0 ? 0 : Math.round((accepted / total) * 100);

  return NextResponse.json({
    pastDeals: accepted,
    successRate,
    total
  });
}
