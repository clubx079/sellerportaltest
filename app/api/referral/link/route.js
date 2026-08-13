import { NextResponse } from 'next/server'
import { createClient } from '@airostack/client'

const getSupabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function GET(request) {
  try {
    const sellerId = request.headers.get('x-seller-id')
    if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()

    let { data: linkRef } = await supabase
      .from('link_referrals')
      .select('*')
      .eq('referrer_id', sellerId)
      .maybeSingle()

    if (!linkRef) {
      const { data: seller } = await supabase
        .from('seller_applications')
        .select('contact_person_name')
        .eq('id', sellerId)
        .maybeSingle()

      const firstName = (seller?.contact_person_name || '').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)
      const suffix = Math.floor(1000 + Math.random() * 9000)
      const refCode = firstName ? `${firstName}${suffix}` : `DEEL${suffix}`

      const { data, error } = await supabase
        .from('link_referrals')
        .insert({ referrer_id: sellerId, ref_code: refCode })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      linkRef = data
    }

    const [{ data: signups }, { data: commissions }] = await Promise.all([
      supabase.from('link_referral_signups').select('referred_id, signed_up_at').eq('referrer_id', sellerId),
      supabase.from('link_referral_commissions').select('amount_cents, referred_id, created_at').eq('referrer_id', sellerId),
    ])

    const totalEarned = (commissions || []).reduce((s, c) => s + c.amount_cents, 0)

    return NextResponse.json({
      ref_code: linkRef.ref_code,
      signups_count: signups?.length || 0,
      total_earned_cents: totalEarned,
      signups: signups || [],
      commissions: commissions || [],
    })
  } catch (err) {
    console.error('[referral/link GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
