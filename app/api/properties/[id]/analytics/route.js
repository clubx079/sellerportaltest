import { NextResponse } from 'next/server';
import { createClient } from '@airostack/client';

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
        utm_source,
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

    // Exclude in-company / internal staff (system_users) from seller-facing analytics.
    // Keep rows with null email (genuine anonymous visitors).
    const { data: sysUsers } = await supabase.from('system_users').select('email');
    const excludedEmails = new Set((sysUsers || []).map(u => (u.email || '').trim().toLowerCase()).filter(Boolean));
    const isExcluded = (email) => excludedEmails.has((email || '').trim().toLowerCase());

    let list = (analyticsRows || []).filter(r => !isExcluded(r.user_email));
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

    let visits = (visitRows || []).filter(v => !isExcluded(v.user_email));
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
    const totalImagesViewed = list.reduce((sum, r) => sum + (Number(r.images_viewed) || 0), 0);
    const deviceBreakdown = list.reduce(
      (acc, r) => {
        const t = (r.device_type || '').toLowerCase().trim();
        if (t === 'mobile') acc.mobile += 1;
        else if (t === 'desktop') acc.desktop += 1;
        else if (t === 'tablet') acc.tablet += 1;
        return acc;
      },
      { mobile: 0, desktop: 0, tablet: 0 }
    );

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
      utm_source: r.utm_source || null,
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
        utm_source: null,
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
          utm_source: row.utm_source || null,
          scrolled_to_bottom: scrolled,
          viewed_photos: photos,
          viewed_description: desc,
          viewed_repairs: repairs,
          visit_count: 1,
          _minStart: start,
          _maxEnd: end
        });
      } else {
        existing.visit_count = (existing.visit_count || 1) + 1;
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
        if (row.utm_source && !existing.utm_source) existing.utm_source = row.utm_source;
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

    // ── Funnel + per-buyer intent: Saves & Offers on this property ──────────
    // Counts respect the selected period (so the funnel is consistent with the
    // Viewers number); the id sets are all-time so we can still flag a buyer who
    // ever saved/offered, regardless of the period filter.
    let savesCount = 0;
    let offersCount = 0;
    const saverIds = new Set();
    const offererIds = new Set();
    try {
      const { data: favRows } = await supabase
        .from('user_favorites')
        .select('user_id, created_at')
        .eq('property_id', propertyId);
      (favRows || []).forEach((r) => {
        if (r.user_id) saverIds.add(String(r.user_id));
        if (!periodStart || (r.created_at && r.created_at >= periodStart)) savesCount += 1;
      });
    } catch {}
    try {
      const { data: offerRows } = await supabase
        .from('offers')
        .select('buyer_id, created_at')
        .eq('property_id', propertyId);
      (offerRows || []).forEach((r) => {
        if (r.buyer_id) offererIds.add(String(r.buyer_id));
        if (!periodStart || (r.created_at && r.created_at >= periodStart)) offersCount += 1;
      });
    } catch {}

    // Resolve saver/offerer ids -> emails so a viewer can be matched by id OR email.
    const idsToResolve = [...new Set([...saverIds, ...offererIds])];
    const idToEmail = new Map();
    if (idsToResolve.length) {
      try {
        const { data: urows } = await supabase
          .from('users')
          .select('id, email')
          .in('id', idsToResolve);
        (urows || []).forEach((u) => { if (u.email) idToEmail.set(String(u.id), String(u.email).trim().toLowerCase()); });
      } catch {}
    }
    const saverEmails = new Set([...saverIds].map((id) => idToEmail.get(String(id))).filter(Boolean));
    const offererEmails = new Set([...offererIds].map((id) => idToEmail.get(String(id))).filter(Boolean));

    // Flag each buyer who saved and/or made an offer on this property.
    viewerSessions.forEach((v) => {
      const vid = v.user_id ? String(v.user_id) : null;
      const vemail = (v.user_email || '').trim().toLowerCase();
      v.saved = !!((vid && saverIds.has(vid)) || (vemail && saverEmails.has(vemail)));
      v.offered = !!((vid && offererIds.has(vid)) || (vemail && offererEmails.has(vemail)));
    });

    // Unique viewers (people, period-consistent): identified buyers deduped by
    // id/email, anonymous visitors deduped by session — not inflated by reloads.
    const viewerKeySet = new Set();
    for (const row of allSessionRows) {
      const email = (row.user_email || '').trim().toLowerCase();
      const key = row.user_id
        ? `u:${row.user_id}`
        : (email && email !== 'guest' ? `e:${email}` : (row.session_id ? `s:${row.session_id}` : null));
      if (key) viewerKeySet.add(key);
    }
    const uniqueViewerCount = viewerKeySet.size;

    return NextResponse.json({
      propertyId,
      aggregates: {
        totalSessionViews,
        totalPageViews,
        uniqueViewers,
        totalDurationSeconds,
        totalActiveTimeSeconds,
        totalImagesViewed,
        deviceBreakdown,
        activeNow,
        uniqueViewerCount,
        savesCount,
        offersCount
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
