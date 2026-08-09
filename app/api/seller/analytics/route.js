import { NextResponse } from 'next/server';
import { createClient } from '@airostack/client';
import { getWorkspaceSellerId, getCallerAccess, requirePermission } from '@/lib/workspace';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getPeriodBounds(period) {
  const now = new Date();
  const nowMs = now.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (period === 'last7days') {
    return {
      periodStart: new Date(nowMs - 7 * day).toISOString(),
      periodEnd: null,
      prevStart: new Date(nowMs - 14 * day).toISOString(),
      prevEnd: new Date(nowMs - 7 * day).toISOString(),
      days: 7,
    };
  }
  if (period === 'last30days') {
    return {
      periodStart: new Date(nowMs - 30 * day).toISOString(),
      periodEnd: null,
      prevStart: new Date(nowMs - 60 * day).toISOString(),
      prevEnd: new Date(nowMs - 30 * day).toISOString(),
      days: 30,
    };
  }
  if (period === 'thisMonth') {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return {
      periodStart: firstOfMonth,
      periodEnd: null,
      prevStart: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      prevEnd: firstOfMonth,
      days: now.getDate(),
    };
  }
  if (period === 'lastMonth') {
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const daysInLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    return {
      periodStart: firstOfLastMonth.toISOString(),
      periodEnd: firstOfThisMonth.toISOString(),
      prevStart: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(),
      prevEnd: firstOfLastMonth.toISOString(),
      days: daysInLastMonth,
    };
  }
  // 'all'
  return { periodStart: null, periodEnd: null, prevStart: null, prevEnd: null, days: 30 };
}

function buildDailyMap(period) {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const map = {};

  if (period === 'lastMonth') {
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const daysInLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    for (let i = 0; i < daysInLastMonth; i++) {
      const d = new Date(firstOfLastMonth.getTime() + i * day);
      map[d.toISOString().slice(0, 10)] = 0;
    }
  } else if (period === 'thisMonth') {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 0; i < now.getDate(); i++) {
      const d = new Date(firstOfMonth.getTime() + i * day);
      map[d.toISOString().slice(0, 10)] = 0;
    }
  } else {
    const numDays = period === 'last7days' ? 7 : 30;
    const nowMs = now.getTime();
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(nowMs - i * day);
      map[d.toISOString().slice(0, 10)] = 0;
    }
  }
  return map;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUserId = searchParams.get('userId');
    const period = searchParams.get('period') || 'last30days';

    if (!rawUserId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const access = await getCallerAccess(rawUserId);
    if (!requirePermission(access, 'analytics_view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { effectiveId: userId } = await getWorkspaceSellerId(rawUserId);

    // Get all property IDs for this seller
    const [{ data: manualRows, error: manualErr }, { data: sellerRow }] = await Promise.all([
      supabase.from('properties').select('id, address, slug').eq('seller_id', userId),
      supabase.from('seller_applications').select('temp_seller_id').eq('id', userId).maybeSingle(),
    ]);

    if (manualErr) console.error('[seller/analytics] properties query error:', manualErr.message);

    const manualMap = {};
    (manualRows || []).forEach(r => { manualMap[r.id] = r.address || r.slug || r.id; });

    let scrapedMap = {};
    if (sellerRow?.temp_seller_id) {
      const { data: scrapedRows } = await supabase
        .from('wholesale_deals')
        .select('id, full_address, address, slug')
        .eq('temp_seller_id', sellerRow.temp_seller_id);
      (scrapedRows || []).forEach(r => { scrapedMap[r.id] = r.full_address || r.address || r.slug || r.id; });
    }

    const propertyNameMap = { ...manualMap, ...scrapedMap };
    const propertyIds = Object.keys(propertyNameMap);
    const totalListings = propertyIds.length;

    console.log(`[seller/analytics] userId=${userId} manualCount=${Object.keys(manualMap).length} scrapedCount=${Object.keys(scrapedMap).length} total=${totalListings} tempSellerId=${sellerRow?.temp_seller_id || 'none'}`);

    if (propertyIds.length === 0) {
      return NextResponse.json({ totalListings: 0, summary: {}, topProperties: [], dailyViews: [], deviceBreakdown: {}, utmBreakdown: [], engagement: {}, recentViewers: [] });
    }

    const { periodStart, periodEnd, prevStart, prevEnd, days } = getPeriodBounds(period);

    // Fetch property_analytics rows
    let analyticsQuery = supabase
      .from('property_analytics')
      .select(`
        property_id, user_email, user_first_name, user_last_name,
        page_views, duration_seconds, active_time_seconds, images_viewed,
        device_type, utm_source, view_start_time, view_end_time, created_at,
        scrolled_to_bottom, viewed_photos, viewed_description, viewed_repairs
      `)
      .in('property_id', propertyIds)
      .order('view_start_time', { ascending: false });

    const { data: analyticsRows } = await analyticsQuery;

    // Also fetch page_visits for additional coverage
    const { data: visitRows } = await supabase
      .from('page_visits')
      .select('property_id, user_email, visited_at, time_spent_seconds, session_id')
      .in('property_id', propertyIds);

    // Exclude in-company / internal staff (system_users) from seller-facing analytics.
    // Keep rows with null email (genuine anonymous visitors).
    const { data: sysUsers } = await supabase.from('system_users').select('email');
    const excludedEmails = new Set((sysUsers || []).map(u => (u.email || '').trim().toLowerCase()).filter(Boolean));
    const isExcluded = (email) => excludedEmails.has((email || '').trim().toLowerCase());

    const analyticsAll = (analyticsRows || []).filter(r => !isExcluded(r.user_email));
    const visitsAll = (visitRows || []).filter(v => !isExcluded(v.user_email));

    // Helper to check if a row falls in a period
    const inRange = (t, start, end) => {
      if (!t) return false;
      if (start && t < start) return false;
      if (end && t >= end) return false;
      return true;
    };

    const getTimestamp = r => r.view_start_time || r.created_at || null;

    const inPeriod = periodStart
      ? analyticsAll.filter(r => inRange(getTimestamp(r), periodStart, periodEnd))
      : analyticsAll;

    const inPrev = (prevStart && prevEnd)
      ? analyticsAll.filter(r => inRange(getTimestamp(r), prevStart, prevEnd))
      : [];

    // Also filter page_visits for this period (merge as additional sessions)
    const visitsInPeriod = periodStart
      ? visitsAll.filter(v => inRange(v.visited_at, periodStart, periodEnd))
      : visitsAll;

    // Build a set of analytics session keys to avoid double-counting
    const analyticsEmailSet = new Set(inPeriod.map(r => r.user_email).filter(Boolean));

    // Merge unique page_visits sessions not already in analytics
    const visitSessions = visitsInPeriod.filter(v => {
      // If visit has no email, include it as additional anonymous session
      if (!v.user_email) return true;
      // If email is already in analytics, skip (already counted)
      return !analyticsEmailSet.has(v.user_email);
    });

    // Summary
    const totalViews = inPeriod.reduce((s, r) => s + (Number(r.page_views) || 0), 0) + visitSessions.length;
    const prevViews = inPrev.reduce((s, r) => s + (Number(r.page_views) || 0), 0);
    const uniqueEmails = new Set([
      ...inPeriod.map(r => r.user_email).filter(Boolean),
      ...visitSessions.map(v => v.user_email).filter(Boolean),
    ]);
    const uniqueViewers = uniqueEmails.size + inPeriod.filter(r => !r.user_email).length + visitSessions.filter(v => !v.user_email).length;
    const totalDuration = inPeriod.reduce((s, r) => s + (Number(r.duration_seconds) || Number(r.active_time_seconds) || 0), 0)
      + visitSessions.reduce((s, v) => s + (Number(v.time_spent_seconds) || 0), 0);
    const totalSessions = inPeriod.length + visitSessions.length;
    const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
    const viewTrend = prevViews > 0 ? Math.round(((totalViews - prevViews) / prevViews) * 100) : null;

    // Per-property summary
    const byProperty = {};
    inPeriod.forEach(r => {
      const pid = r.property_id;
      if (!byProperty[pid]) byProperty[pid] = { views: 0, sessions: 0, emails: new Set(), duration: 0 };
      byProperty[pid].views += Number(r.page_views) || 0;
      byProperty[pid].sessions += 1;
      byProperty[pid].duration += Number(r.duration_seconds) || 0;
      if (r.user_email) byProperty[pid].emails.add(r.user_email);
    });
    const topProperties = Object.entries(byProperty)
      .map(([id, v]) => ({
        id,
        name: propertyNameMap[id] || id,
        views: v.views,
        sessions: v.sessions,
        uniqueViewers: v.emails.size,
        avgDuration: v.sessions > 0 ? Math.round(v.duration / v.sessions) : 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 50);

    // Daily views
    const dailyMap = buildDailyMap(period);
    // For 'all' period, build map from actual data dates if empty
    if (period === 'all' && analyticsAll.length > 0) {
      analyticsAll.forEach(r => {
        const t = getTimestamp(r);
        if (!t) return;
        const key = t.slice(0, 10);
        if (!(key in dailyMap)) dailyMap[key] = 0;
      });
    }
    inPeriod.forEach(r => {
      const t = getTimestamp(r);
      if (!t) return;
      const key = t.slice(0, 10);
      if (key in dailyMap) dailyMap[key] += Number(r.page_views) || 1;
    });
    visitsInPeriod.forEach(v => {
      const t = v.visited_at;
      if (!t) return;
      const key = t.slice(0, 10);
      if (key in dailyMap) dailyMap[key] += 1;
    });
    const dailyViews = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    // Device breakdown
    const deviceBreakdown = { mobile: 0, desktop: 0, tablet: 0 };
    inPeriod.forEach(r => {
      const t = (r.device_type || '').toLowerCase();
      if (t === 'mobile') deviceBreakdown.mobile++;
      else if (t === 'tablet') deviceBreakdown.tablet++;
      else if (t === 'desktop') deviceBreakdown.desktop++;
    });

    // UTM breakdown
    const utmMap = {};
    inPeriod.forEach(r => {
      if (!r.utm_source) return;
      utmMap[r.utm_source] = (utmMap[r.utm_source] || 0) + 1;
    });
    const utmBreakdown = Object.entries(utmMap)
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count }));

    // Engagement rates
    const total = inPeriod.length;
    const engagement = {
      scrolled: total > 0 ? Math.round((inPeriod.filter(r => r.scrolled_to_bottom).length / total) * 100) : 0,
      viewedPhotos: total > 0 ? Math.round((inPeriod.filter(r => r.viewed_photos).length / total) * 100) : 0,
      viewedDescription: total > 0 ? Math.round((inPeriod.filter(r => r.viewed_description).length / total) * 100) : 0,
      viewedRepairs: total > 0 ? Math.round((inPeriod.filter(r => r.viewed_repairs).length / total) * 100) : 0,
    };

    // Recent viewers (top 15)
    const recentViewers = inPeriod.slice(0, 15).map(r => ({
      email: r.user_email || null,
      firstName: r.user_first_name || null,
      lastName: r.user_last_name || null,
      propertyId: r.property_id,
      propertyName: propertyNameMap[r.property_id] || r.property_id,
      views: Number(r.page_views) || 0,
      duration: Number(r.duration_seconds) || 0,
      device: r.device_type || null,
      utmSource: r.utm_source || null,
      lastSeen: r.view_end_time || r.view_start_time || r.created_at,
    }));

    return NextResponse.json({
      totalListings,
      summary: { totalViews, uniqueViewers, avgDuration, viewTrend, prevViews, totalSessions },
      topProperties,
      dailyViews,
      deviceBreakdown,
      utmBreakdown,
      engagement,
      recentViewers,
    });
  } catch (err) {
    console.error('[seller/analytics] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
