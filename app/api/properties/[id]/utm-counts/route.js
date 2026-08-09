import { NextResponse } from 'next/server';
import { createClient } from '@airostack/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PLATFORM_CODES = ['facebook', 'mailchimp', 'twitter', 'instagram'];

/**
 * GET /api/properties/[id]/utm-counts?userId=xxx
 * Returns viewer counts per UTM source for the property (for UTM share links modal).
 */
export async function GET(request, { params }) {
  try {
    const { id: propertyId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!propertyId || !userId) {
      return NextResponse.json(
        { error: 'Missing property id or userId' },
        { status: 400 }
      );
    }

    // Verify property belongs to seller (same as analytics)
    const { data: manualRow } = await supabase
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('seller_id', userId)
      .maybeSingle();

    if (!manualRow) {
      const { data: sellerRow } = await supabase
        .from('seller_applications')
        .select('temp_seller_id')
        .eq('id', userId)
        .maybeSingle();
      const tempSellerId = sellerRow?.temp_seller_id;
      if (!tempSellerId) {
        return NextResponse.json({ error: 'Seller not found' }, { status: 403 });
      }
      const { data: scrapedRow } = await supabase
        .from('wholesale_deals')
        .select('id')
        .eq('id', propertyId)
        .eq('temp_seller_id', tempSellerId)
        .maybeSingle();
      if (!scrapedRow) {
        return NextResponse.json({ error: 'Property not found or access denied' }, { status: 403 });
      }
    }

    const { data: rows, error } = await supabase
      .from('property_analytics')
      .select('utm_source')
      .eq('property_id', propertyId)
      .not('utm_source', 'is', null);

    if (error) {
      console.error('utm-counts error:', error);
      return NextResponse.json({ error: 'Failed to fetch counts' }, { status: 500 });
    }

    const counts = {};
    PLATFORM_CODES.forEach((code) => { counts[code] = 0; });
    (rows || []).forEach((row) => {
      const src = (row.utm_source || '').toLowerCase().trim();
      if (PLATFORM_CODES.includes(src)) counts[src] = (counts[src] || 0) + 1;
    });

    return NextResponse.json({ counts });
  } catch (err) {
    console.error('UTM counts API error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
