import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * GET /api/seller/dashboard-stats?userId=xxx
 * Returns total page views across all of the seller's properties.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { data: manualRows } = await supabase
      .from('properties')
      .select('id')
      .eq('seller_id', userId);
    const manualIds = (manualRows || []).map((r) => r.id);

    const { data: sellerRow } = await supabase
      .from('seller_applications')
      .select('temp_seller_id')
      .eq('id', userId)
      .maybeSingle();
    const tempSellerId = sellerRow?.temp_seller_id ?? null;

    let scrapedIds = [];
    if (tempSellerId) {
      const { data: scrapedRows } = await supabase
        .from('wholesale_deals')
        .select('id')
        .eq('temp_seller_id', tempSellerId);
      scrapedIds = (scrapedRows || []).map((r) => r.id);
    }

    const propertyIds = [...new Set([...manualIds, ...scrapedIds])];
    if (propertyIds.length === 0) {
      return NextResponse.json({ totalViews: 0 });
    }

    const { data: rows, error } = await supabase
      .from('property_analytics')
      .select('page_views')
      .in('property_id', propertyIds);

    if (error) {
      console.error('[dashboard-stats] property_analytics error:', error);
      return NextResponse.json({ totalViews: 0 });
    }

    const totalViews = (rows || []).reduce((sum, r) => sum + (Number(r.page_views) || 0), 0);
    return NextResponse.json({ totalViews });
  } catch (err) {
    console.error('[dashboard-stats] error:', err);
    return NextResponse.json({ totalViews: 0 });
  }
}
