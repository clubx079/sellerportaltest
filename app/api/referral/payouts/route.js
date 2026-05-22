import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET(request) {
  try {
    const sellerId = request.headers.get('x-seller-id')
    if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()

    const { data: referral } = await supabase
      .from('referrals')
      .select('id')
      .eq('user_id', sellerId)
      .eq('user_type', 'seller')
      .maybeSingle()

    if (!referral) return NextResponse.json({ payouts: [] })

    const { data: payouts } = await supabase
      .from('referral_payouts')
      .select('*')
      .eq('referral_id', referral.id)
      .order('paid_at', { ascending: false })

    return NextResponse.json({ payouts: payouts || [] })
  } catch (err) {
    console.error('[referral payouts GET]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
