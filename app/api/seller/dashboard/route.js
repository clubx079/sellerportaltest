import { NextResponse } from 'next/server';
import { createClient } from '@airostack/client';
import { getWorkspaceSellerId, getCallerAccess } from '@/lib/workspace';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getSellerId(request) {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

function normalizeStatus(p) {
  const s = (p.status || '').toLowerCase();
  if (s === 'archived') return 'archived';
  if (s === 'published' || s === 'active') return 'active';
  return 'draft';
}

function getFeatureImage(property) {
  const photos = property?.property_photos || [];
  const sorted = [...photos].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  return sorted[0]?.photo_url || null;
}

/**
 * GET /api/seller/dashboard
 * Bearer = logged-in seller id.
 * Resolves the effective workspace owner + caller permissions, then computes the
 * full dashboard payload server-side (KPI stats + listings carousel).
 */
export async function GET(request) {
  try {
    const rawSellerId = getSellerId(request);
    if (!rawSellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [{ effectiveId: sellerId }, access] = await Promise.all([
      getWorkspaceSellerId(rawSellerId),
      getCallerAccess(rawSellerId),
    ]);

    const { isOwner, permissions } = access;

    // Seller application (temp_seller_id for scraped deals + display name)
    const { data: sellerData } = await supabase
      .from('seller_applications')
      .select('temp_seller_id, contact_person_name, business_name')
      .eq('id', sellerId)
      .maybeSingle();
    const tempSellerId = sellerData?.temp_seller_id ?? null;
    const sellerName = sellerData?.contact_person_name || sellerData?.business_name || null;

    // Manual properties + their images
    const { data: manualList } = await supabase
      .from('properties')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });
    let manualWithImages = manualList || [];
    if (manualWithImages.length > 0) {
      const ids = manualWithImages.map((p) => p.id);
      const { data: imagesData } = await supabase
        .from('property_images')
        .select('id, image_url, sort_order, property_id')
        .in('property_id', ids)
        .order('sort_order');
      const imagesByProperty = {};
      (imagesData || []).forEach((img) => {
        if (!imagesByProperty[img.property_id]) imagesByProperty[img.property_id] = [];
        imagesByProperty[img.property_id].push(img);
      });
      manualWithImages = manualWithImages.map((p) => ({
        ...p,
        _source: 'manual',
        property_photos: (imagesByProperty[p.id] || [])
          .map((img) => ({ photo_url: img.image_url, display_order: img.sort_order }))
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
      }));
    } else {
      manualWithImages = (manualList || []).map((p) => ({ ...p, _source: 'manual', property_photos: [] }));
    }

    // Scraped properties (wholesale_deals)
    let scrapedList = [];
    if (tempSellerId) {
      const { data: wholesaleList, error: wholesaleError } = await supabase
        .from('wholesale_deals')
        .select('*, property_photos (id, photo_url, display_order, is_featured)')
        .eq('temp_seller_id', tempSellerId)
        .order('created_at', { ascending: false });
      if (!wholesaleError && wholesaleList) scrapedList = wholesaleList.map((p) => ({ ...p, _source: 'scraped' }));
    }

    const combined = [
      ...manualWithImages.map((p) => ({ ...p, _normalizedStatus: normalizeStatus(p), property_status: p.property_status || 'available' })),
      ...scrapedList.map((p) => ({ ...p, _normalizedStatus: normalizeStatus(p), property_status: p.property_status || 'available' })),
    ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeList = combined.filter((p) => p._normalizedStatus !== 'archived');
    const soldList = combined.filter((p) => (p.property_status || '').toLowerCase() === 'sold');
    const recentCount = combined.filter((p) => new Date(p.created_at) >= sevenDaysAgo).length;
    const trashCount = combined.filter((p) => p._normalizedStatus === 'archived').length;

    // closedThisMonth — count SOLD listings whose sold date falls in the current
    // calendar month. There's no dedicated sold_at column, so use updated_at (the
    // time the row was last touched, i.e. when it was marked sold) as the proxy.
    let closedThisMonth = 0;
    let hasSoldDateSignal = false;
    for (const p of soldList) {
      const soldAt = p.updated_at || p.sold_at || null;
      if (soldAt) {
        hasSoldDateSignal = true;
        const d = new Date(soldAt);
        if (d >= monthStart && d <= now) closedThisMonth += 1;
      }
    }

    // Views (real 7-day + total) — reuse the same exclusion logic as dashboard-stats.
    let totalViews = 0;
    let viewsLast7Days = 0;
    let viewsLast30Days = 0;
    let hasSevenDayViews = false;
    try {
      const manualIds = manualWithImages.map((p) => p.id);
      const scrapedIds = scrapedList.map((p) => p.id);
      const propertyIds = [...new Set([...manualIds, ...scrapedIds])];
      if (propertyIds.length > 0) {
        const { data: rows } = await supabase
          .from('property_analytics')
          .select('page_views, view_start_time, created_at, user_email')
          .in('property_id', propertyIds);
        const { data: sysUsers } = await supabase.from('system_users').select('email');
        const excluded = new Set((sysUsers || []).map((u) => (u.email || '').trim().toLowerCase()).filter(Boolean));
        const sevenIso = sevenDaysAgo.toISOString();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyIso = thirtyDaysAgo.toISOString();
        hasSevenDayViews = true;
        (rows || []).forEach((r) => {
          if (excluded.has((r.user_email || '').trim().toLowerCase())) return;
          const views = Number(r.page_views) || 0;
          totalViews += views;
          const t = r.view_start_time || r.created_at;
          if (t) {
            if (t >= sevenIso) viewsLast7Days += views;
            if (t >= thirtyIso) viewsLast30Days += views;
          }
        });
      }
    } catch (e) {
      console.error('[seller/dashboard] views error:', e?.message);
    }

    // Offers (count + this week) for the effective workspace.
    let offersReceived = 0;
    let offersThisWeek = 0;
    try {
      const { data: offers } = await supabase
        .from('offers')
        .select('id, created_at')
        .eq('seller_id', sellerId);
      offersReceived = (offers || []).length;
      offersThisWeek = (offers || []).filter((o) => new Date(o.created_at) >= sevenDaysAgo).length;
    } catch (e) {
      console.error('[seller/dashboard] offers error:', e?.message);
    }

    const stats = {
      activeProperties: activeList.length,
      totalViews,
      offersReceived,
      dealsClosed: soldList.length,
      recentlyAdded: recentCount,
      viewsThisWeek: viewsLast7Days,
      viewsLast30Days,
      hasSevenDayViews,
      offersThisWeek,
      // honest only — null means OMIT the "+N this month" sub entirely.
      closedThisMonth: hasSoldDateSignal ? closedThisMonth : null,
      trashProperties: trashCount,
    };

    // Top 8 active listings for the carousel, enriched with per-property
    // views / saves / offers counts.
    const top8 = activeList.slice(0, 8);
    let listings = top8;
    if (top8.length > 0) {
      const ids = top8.map((p) => p.id);
      const [analyticsRes, favRes, offersRes] = await Promise.all([
        supabase.from('property_analytics').select('property_id, page_views').in('property_id', ids),
        supabase.from('user_favorites').select('property_id').in('property_id', ids),
        supabase.from('offers').select('property_id').in('property_id', ids),
      ]);
      const viewsMap = {}, savesMap = {}, offersMap = {};
      for (const r of analyticsRes.data || []) viewsMap[r.property_id] = (viewsMap[r.property_id] || 0) + (Number(r.page_views) || 0);
      for (const r of favRes.data || []) savesMap[r.property_id] = (savesMap[r.property_id] || 0) + 1;
      for (const r of offersRes.data || []) offersMap[r.property_id] = (offersMap[r.property_id] || 0) + 1;
      listings = top8.map((p) => ({
        id: p.id,
        title: p.title || p.full_address || p.address || 'Property',
        full_address: p.full_address || null,
        address: p.address || null,
        city: p.city || '',
        state: p.state || '',
        price: p.price ?? null,
        bedrooms: p.bedrooms ?? null,
        bathrooms: p.bathrooms ?? null,
        property_status: p.property_status,
        _source: p._source,
        feature_image: getFeatureImage(p),
        view_count: viewsMap[p.id] || 0,
        saves_count: savesMap[p.id] || 0,
        offers_count: offersMap[p.id] || 0,
      }));
    }

    return NextResponse.json({
      stats,
      listings,
      sellerName,
      permissions: {
        isOwner,
        listings_create: isOwner || permissions?.listings_create === true,
        listings_update: isOwner || permissions?.listings_update === true,
        contracts_create: isOwner || permissions?.contracts_create === true,
      },
    });
  } catch (err) {
    console.error('[seller/dashboard] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
