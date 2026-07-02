import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { maybeProUsageNudge } from '@/lib/proUsageNudge'

// Manual / recompute trigger for the #5 Pro-plan usage nudge. The normal publish
// flow fires the nudge inside AI moderation once a listing is approved to 'active'
// (see lib/moderateSellerProperty.js) — that's the correctly-timed hook. This
// endpoint recomputes the true number of LIVE listings (status active/published —
// drafts don't consume a slot) and hands off to the shared nudge helper (deduped
// per threshold per billing period). Handy for a future cron sweep or a manual
// re-check; safe to call any time.
export async function POST(request) {
  try {
    const { seller_id } = await request.json().catch(() => ({}))
    if (!seller_id) return NextResponse.json({ error: 'seller_id required' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // True slots consumed = live listings (active/published). Drafts/archived excluded.
    const { count } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', seller_id)
      .in('status', ['active', 'published'])

    await maybeProUsageNudge(supabase, seller_id, count ?? 0)
    return NextResponse.json({ ok: true, used: count ?? 0 })
  } catch (err) {
    console.error('[listings/usage-nudge]', err?.message || err)
    // Never surface as a publish failure — this is a best-effort notification.
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
