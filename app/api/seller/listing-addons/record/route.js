import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADDON_DAYS   = { highlight: 30, boost: 7, homepage: 7, bundle: 30 }
const ADDON_PRICES = { highlight: 999, boost: 1499, homepage: 2900, bundle: 2200 }

export async function POST(request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { seller_id, property_id, add_ons = [] } = await request.json()

    if (!seller_id || !property_id || add_ons.length === 0) {
      return NextResponse.json({ error: 'seller_id, property_id, and add_ons are required' }, { status: 400 })
    }

    const now = new Date()
    const ms  = (d) => d * 24 * 60 * 60 * 1000
    const inserted = []

    for (const addonId of add_ons) {
      if (!ADDON_DAYS[addonId]) continue
      const days = ADDON_DAYS[addonId]
      const { data, error } = await supabase.from('listing_addons').insert({
        property_id,
        seller_id,
        addon_type:     addonId,
        amount_paid:    ADDON_PRICES[addonId] || 0,
        days_purchased: days,
        starts_at:      now.toISOString(),
        ends_at:        new Date(now.getTime() + ms(days)).toISOString(),
        status:         'active',
      }).select('id').single()

      if (!error) inserted.push(data?.id)
    }

    return NextResponse.json({ success: true, inserted })
  } catch (err) {
    console.error('[listing-addons/record]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
