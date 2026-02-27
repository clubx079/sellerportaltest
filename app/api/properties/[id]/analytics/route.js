import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * GET /api/properties/[id]/analytics?userId=xxx
 * Returns aggregates + per-session viewer list for the property.
 * Verifies property belongs to seller (properties.seller_id or wholesale_deals.temp_seller_id).
 */
export async function GET(request, { params }) {
  try {
    const { id: propertyId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const period = searchParams.get('period') || 'all'; // last7days | last30days | all
    const sortBy = searchParams.get('sort') || 'last_visit'; // last_visit | time_spent | page_views

    if (!propertyId || !userId) {
      return NextResponse.json(
        { error: 'Missing property id or userId' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const periodStart =
      period === 'last7days' ? new Date(now - 7 * day).toISOString()
      : period === 'last30days' ? new Date(now - 30 * day).toISOString()
      : null;

    // 1) Verify property belongs to seller
    const { data: manualRow } = await supabase
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('seller_id', userId)
      .maybeSingle();

    if (manualRow) {
      // Manual property – allowed
    } else {
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

    // 2) property_analytics: aggregates + per-session rows
    const { data: analyticsRows, error: analyticsError } = await supabase
      .from('property_analytics')
      .select(`
        id,
        session_id,
        user_id,
        user_email,
        user_first_name,
        user_last_name,
        user_phone,
        view_start_time,
        view_end_time,
        duration_seconds,
        active_time_seconds,
        page_views,
        scrolled_to_bottom,
        viewed_description,
        viewed_repairs,
        viewed_photos,
        clicked_more_photos,
        clicked_share,
        zoomed_map,
        device_type,
        created_at,
        images_viewed
      `)
      .eq('property_id', propertyId)
      .order('view_start_time', { ascending: false });

    if (analyticsError) {
      console.error('property_analytics error:', analyticsError);
      return NextResponse.json(
        { error: 'Failed to fetch analytics' },
        { status: 500 }
      );
    }

    let list = analyticsRows || [];
    if (periodStart) {
      list = list.filter((r) => {
        const t = r.view_start_time || r.created_at;
        return t && t >= periodStart;
      });
    }

    // 3) page_visits for this property (for unique viewers and extra sessions)
    const { data: visitRows } = await supabase
      .from('page_visits')
      .select('session_id, user_id, user_email, visited_at, time_spent_seconds')
      .eq('property_id', propertyId);

    let visits = visitRows || [];
    if (periodStart) {
      visits = visits.filter((v) => v.visited_at && v.visited_at >= periodStart);
    }
    const sessionIdsFromAnalytics = new Set(list.map((r) => r.session_id));
    const visitOnlySessions = visits.filter((v) => !sessionIdsFromAnalytics.has(v.session_id));

    // 4) live_sessions: active now
    const { data: liveRows } = await supabase
      .from('live_sessions')
      .select('id')
      .eq('property_id', propertyId)
      .eq('is_active', true);

    const activeNow = (liveRows || []).length;

    // Aggregates from property_analytics
    const totalSessionViews = list.length;
    const totalPageViews = list.reduce((sum, r) => sum + (Number(r.page_views) || 0), 0);
    const totalDurationSeconds = list.reduce((sum, r) => sum + (Number(r.duration_seconds) || 0), 0);
    const totalActiveTimeSeconds = list.reduce((sum, r) => sum + (Number(r.active_time_seconds) || 0), 0);

    // Build all session rows (property_analytics + page_visits-only)
    const allSessionRows = list.map((r) => ({
      source: 'property_analytics',
      session_id: r.session_id,
      user_id: r.user_id,
      user_email: r.user_email,
      user_first_name: r.user_first_name,
      user_last_name: r.user_last_name,
      user_phone: r.user_phone,
      view_start_time: r.view_start_time,
      view_end_time: r.view_end_time,
      duration_seconds: r.duration_seconds,
      active_time_seconds: r.active_time_seconds,
      page_views: r.page_views,
      device_type: r.device_type,
      created_at: r.created_at,
      images_viewed: r.images_viewed,
      scrolled_to_bottom: r.scrolled_to_bottom,
      viewed_photos: r.viewed_photos,
      viewed_description: r.viewed_description,
      viewed_repairs: r.viewed_repairs
    }));

    visitOnlySessions.forEach((v) => {
      allSessionRows.push({
        source: 'page_visits',
        session_id: v.session_id,
        user_id: v.user_id,
        user_email: v.user_email,
        user_first_name: null,
        user_last_name: null,
        user_phone: null,
        view_start_time: v.visited_at,
        view_end_time: null,
        duration_seconds: v.time_spent_seconds,
        active_time_seconds: null,
        page_views: 1,
        device_type: null,
        created_at: v.visited_at,
        images_viewed: null,
        scrolled_to_bottom: null,
        viewed_photos: null,
        viewed_description: null,
        viewed_repairs: null
      });
    });

    // Merge by unique buyer (email). Key: normalized email (empty/null => 'guest')
    const buyerKey = (row) => {
      const e = (row.user_email || '').trim().toLowerCase();
      return e || 'guest';
    };

    const byBuyer = new Map();
    for (const row of allSessionRows) {
      const key = buyerKey(row);
      const existing = byBuyer.get(key);
      const duration = Number(row.duration_seconds) ?? Number(row.active_time_seconds) ?? 0;
      const views = Number(row.page_views) || 0;
      const images = row.images_viewed != null ? Number(row.images_viewed) : 0;
      const start = row.view_start_time ? new Date(row.view_start_time).getTime() : null;
      const end = row.view_end_time ? new Date(row.view_end_time).getTime() : (row.created_at ? new Date(row.created_at).getTime() : null);

      const scrolled = row.scrolled_to_bottom === true;
      const photos = row.viewed_photos === true;
      const desc = row.viewed_description === true;
      const repairs = row.viewed_repairs === true;

      if (!existing) {
        byBuyer.set(key, {
          user_email: (row.user_email || '').trim() || null,
          user_first_name: row.user_first_name,
          user_last_name: row.user_last_name,
          user_phone: row.user_phone || null,
          user_id: row.user_id,
          page_views: views,
          duration_seconds: duration,
          active_time_seconds: Number(row.active_time_seconds) || 0,
          images_viewed: images,
          view_start_time: row.view_start_time,
          view_end_time: row.view_end_time,
          created_at: row.created_at,
          device_type: row.device_type || null,
          scrolled_to_bottom: scrolled,
          viewed_photos: photos,
          viewed_description: desc,
          viewed_repairs: repairs,
          _minStart: start,
          _maxEnd: end
        });
      } else {
        existing.page_views += views;
        existing.duration_seconds += duration;
        if (row.active_time_seconds != null) existing.active_time_seconds += Number(row.active_time_seconds);
        existing.images_viewed += images;
        existing.scrolled_to_bottom = existing.scrolled_to_bottom || scrolled;
        existing.viewed_photos = existing.viewed_photos || photos;
        existing.viewed_description = existing.viewed_description || desc;
        existing.viewed_repairs = existing.viewed_repairs || repairs;
        if (row.user_phone && !existing.user_phone) existing.user_phone = row.user_phone;
        if (row.device_type && !existing.device_type) existing.device_type = row.device_type;
        if (start != null && (existing._minStart == null || start < existing._minStart)) {
          existing._minStart = start;
          existing.view_start_time = row.view_start_time;
        }
        if (end != null && (existing._maxEnd == null || end > existing._maxEnd)) {
          existing._maxEnd = end;
          existing.view_end_time = row.view_end_time;
        }
        if (row.view_end_time && (!existing.view_end_time || new Date(row.view_end_time) > new Date(existing.view_end_time))) {
          existing.view_end_time = row.view_end_time;
        }
        if (!existing.user_first_name && row.user_first_name) existing.user_first_name = row.user_first_name;
        if (!existing.user_last_name && row.user_last_name) existing.user_last_name = row.user_last_name;
      }
    }

    const uniqueViewers = byBuyer.size;

    const viewerSessions = Array.from(byBuyer.values()).map((b) => {
      const { _minStart, _maxEnd, ...rest } = b;
      if (!rest.view_end_time && _maxEnd != null) {
        rest.view_end_time = new Date(_maxEnd).toISOString();
      }
      return rest;
    });

    // Sort by sortBy param
    const sortKey = sortBy === 'time_spent' ? 'time_spent' : sortBy === 'page_views' ? 'page_views' : 'last_visit';
    viewerSessions.sort((a, b) => {
      if (sortKey === 'page_views') {
        return (b.page_views || 0) - (a.page_views || 0);
      }
      if (sortKey === 'time_spent') {
        const durA = a.duration_seconds ?? a.active_time_seconds ?? 0;
        const durB = b.duration_seconds ?? b.active_time_seconds ?? 0;
        return durB - durA;
      }
      const tA = a.view_end_time ? new Date(a.view_end_time).getTime() : (a.view_start_time ? new Date(a.view_start_time).getTime() : 0);
      const tB = b.view_end_time ? new Date(b.view_end_time).getTime() : (b.view_start_time ? new Date(b.view_start_time).getTime() : 0);
      return tB - tA;
    });

    return NextResponse.json({
      propertyId,
      aggregates: {
        totalSessionViews,
        totalPageViews,
        uniqueViewers,
        totalDurationSeconds,
        totalActiveTimeSeconds,
        activeNow
      },
      viewerSessions
    });
  } catch (err) {
    console.error('Analytics API error:', err);
    return NextResponse.json(
      { error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
