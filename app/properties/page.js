"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Search, X, Building2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ChevronsUpDown, MapPin, BarChart2, Link2, Home, FileEdit, Eye, Zap, CheckCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import DeleteConfirmModal from '@/components/properties/DeleteConfirmModal';
import PropertyViewModal from '@/components/properties/PropertyViewModal';
import PropertyAnalyticsSidebar from '@/components/properties/PropertyAnalyticsSidebar';
import { UTMLinksModal } from '@/components/properties/UTMLinksModal';

const DEELMAP_VIEW_BASE_URL = process.env.NEXT_PUBLIC_DEELMAP_VIEW_BASE_URL || 'https://deelmap.com';

// Per-source fetch cap. Listings come from TWO tables (manual `properties` +
// scraped `wholesale_deals`) and are unioned client-side, so a single clean
// server-side paginated query isn't possible. We instead bound each source with
// .range() and paginate the unioned result client-side. PAGE_SIZE is the rows
// shown per page; FETCH_CAP bounds how many rows we pull per source so we never
// fetch unbounded (covers the deepest reachable page).
const PAGE_SIZE = 10;
const FETCH_CAP = 300;

const PropertiesManagement = () => {
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showMarkSoldModal, setShowMarkSoldModal] = useState(false);
  const [propertyToMarkSold, setPropertyToMarkSold] = useState(null);
  const [markingSold, setMarkingSold] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAnalyticsSidebar, setShowAnalyticsSidebar] = useState(false);
  const [propertyForAnalytics, setPropertyForAnalytics] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  // Bulk-select (page-scoped): set of `${_source}-${id}` keys.
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  // Sort: { key, dir } where dir is 'asc' | 'desc'.
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  // Per-row status dropdown open key (`${_source}-${id}`).
  const [openStatusKey, setOpenStatusKey] = useState(null);
  // Per-row live view counts keyed by `${_source}-${id}`.
  const [viewCounts, setViewCounts] = useState({});
  const statusMenuRef = useRef(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPropertyStatus, setFilterPropertyStatus] = useState('');
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [effectiveUserId, setEffectiveUserId] = useState(null);
  const [workspaceRole, setWorkspaceRole] = useState(null);
  const [workspacePerms, setWorkspacePerms] = useState(null);
  const [planType, setPlanType] = useState(null);
  const [showUTMModal, setShowUTMModal] = useState(false);
  const [propertyForUTM, setPropertyForUTM] = useState(null);
  const [selectedPropertyRaw, setSelectedPropertyRaw] = useState(null); // raw property for UTM (slug/id)
  const [subBlockMsg, setSubBlockMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const searchParams = useSearchParams();
  const viewFromUrl = searchParams.get('view') === 'trash' ? 'trash' : 'active';
  const [viewMode, setViewMode] = useState(viewFromUrl); // 'active' or 'trash'
  // Deep-link guard: open the analytics sidebar for ?analytics=<id> exactly once.
  const analyticsDeepLinkDone = useRef(false);

  // Keep viewMode in sync with URL (e.g. when opening "View Archived" from dashboard)
  useEffect(() => {
    setViewMode(viewFromUrl);
  }, [viewFromUrl]);

  // Deep-link from the Analytics page: ?analytics=<propertyId>. Once listings
  // are loaded, if the id matches a loaded property, open its analytics sidebar.
  // Runs once so it doesn't reopen on every render / after the user closes it.
  useEffect(() => {
    if (analyticsDeepLinkDone.current) return;
    const targetId = searchParams.get('analytics');
    if (!targetId || loading || properties.length === 0) return;
    const match = properties.find(p => String(p.id) === String(targetId));
    if (!match) return;
    analyticsDeepLinkDone.current = true;
    setPropertyForAnalytics(match);
    setShowAnalyticsSidebar(true);
  }, [searchParams, loading, properties]);

  useEffect(() => {
    const msg = sessionStorage.getItem('listingSuccess');
    if (msg) {
      setSuccessMsg(msg);
      sessionStorage.removeItem('listingSuccess');
    }
  }, []);

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
      // Resolve workspace effective ID and role
      fetch('/api/team/workspaces', { headers: { Authorization: `Bearer ${user.id}` } })
        .then(r => r.json())
        .then(data => {
          setEffectiveUserId(data.current?.effectiveSellerId || user.id)
          setWorkspaceRole(data.current?.role || 'admin')
          setWorkspacePerms(data.current?.permissions || null)
        })
        .catch(() => { setEffectiveUserId(user.id); setWorkspaceRole('admin'); });
    }
  }, []);

  useEffect(() => {
    if (effectiveUserId) {
      fetchProperties();
    }
  }, [effectiveUserId, viewMode]);

  // Plan type drives the enterprise-only Message button in the analytics sidebar.
  // For team members, effectiveUserId is the workspace owner, so this reflects
  // the workspace's plan (enterprise team members get the button too).
  useEffect(() => {
    if (!effectiveUserId) return;
    supabase
      .from('seller_plans')
      .select('plan_type')
      .eq('seller_id', effectiveUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPlanType(data?.plan_type || null));
  }, [effectiveUserId]);

  // ── Centralized lifecycle action caller ──────────────────────────────────
  // Every listing lifecycle action (activate, deactivate, mark_sold,
  // mark_available, archive, restore, delete) goes through the server route
  // POST /api/seller/listings/actions. The route is the SINGLE owner of the
  // billing counter (seller_plans.listings_used_this_period) — we never mutate
  // that counter client-side anymore. Returns the parsed JSON response (with
  // per-id `results` + optional `counterWarning`) or throws.
  const callListingAction = async (action, ids) => {
    const userStr = localStorage.getItem('seller_user');
    const sellerId = userStr ? JSON.parse(userStr).id : userId;
    const res = await fetch('/api/seller/listings/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerId}`,
      },
      body: JSON.stringify({ action, ids: ids.map(String) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Action failed');
    return data;
  };

  // Build a friendly summary line from the route's per-id `results` and surface
  // any counter warning. setActionMsg auto-clears after a few seconds.
  const summarizeResults = (data) => {
    const results = data?.results || [];
    const ok = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);
    let msg = '';
    if (ok > 0 && failed.length === 0) msg = `${ok} updated`;
    else if (ok > 0 && failed.length > 0) msg = `${ok} updated, ${failed.length} skipped`;
    else if (failed.length > 0) msg = failed[0].error || `${failed.length} skipped`;
    if (data?.counterWarning) msg = `${msg ? msg + '. ' : ''}${data.counterWarning}`;
    if (msg) {
      setActionMsg(msg);
      setTimeout(() => setActionMsg(''), 6000);
    }
    return { ok, failed };
  };

  // ── Effective listing state + valid transitions ──────────────────────────
  // Collapse (status, property_status) into ONE label shown by the status pill.
  const getEffectiveState = (property) => {
    const status = (property.status || '').toLowerCase();
    const propStatus = (property.property_status || 'available').toLowerCase();
    if (status === 'archived') return 'archived';
    if (status === 'draft' || status === '') {
      if (property._source === 'scraped' && status === '') return propStatus === 'sold' ? 'sold' : 'live';
      if (status === 'draft') return 'draft';
    }
    if (status === 'under_review') return 'under_review';
    if (status === 'rejected') return 'rejected';
    if (propStatus === 'sold') return 'sold';
    if (status === 'active' || status === 'published') return 'live';
    if (status === 'inactive') return 'paused';
    return propStatus === 'sold' ? 'sold' : 'paused';
  };

  const STATE_META = {
    live:         { label: 'Live',        cls: 'bg-green-50 text-green-700 border-green-200' },
    paused:       { label: 'Paused',      cls: 'bg-[#E8E8E4] text-[#737370] border-[#E8E8E4]' },
    sold:         { label: 'Sold',        cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    under_review: { label: 'In review',   cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    rejected:     { label: 'Update required', cls: 'bg-[#FEF3E2] text-[#B5620A] border-[#F3C97D]' },
    archived:     { label: 'Archived',    cls: 'bg-[#E8E8E4] text-[#737370] border-[#E8E8E4]' },
    draft:        { label: 'Draft',       cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  };

  // Valid next actions per effective state (label + route action key + destructive).
  // The route is the final authority; this just hides clearly-invalid options.
  const getValidActions = (property) => {
    const state = getEffectiveState(property);
    const canUpdate = workspaceRole === 'admin' || workspacePerms?.listings_update;
    const canDelete = workspaceRole === 'admin' || workspacePerms?.listings_delete;
    const out = [];
    if (state === 'live') {
      if (canUpdate) out.push({ key: 'deactivate', label: 'Pause' }, { key: 'mark_sold', label: 'Mark sold' });
      if (canDelete) out.push({ key: 'archive', label: 'Archive', destructive: true });
    } else if (state === 'paused') {
      if (canUpdate) out.push({ key: 'activate', label: 'Activate' }, { key: 'mark_sold', label: 'Mark sold' });
      if (canDelete) out.push({ key: 'archive', label: 'Archive', destructive: true });
    } else if (state === 'sold') {
      if (canUpdate) out.push({ key: 'mark_available', label: 'Mark available' });
      if (canDelete) out.push({ key: 'archive', label: 'Archive', destructive: true });
    } else if (state === 'archived') {
      if (canDelete) out.push({ key: 'restore', label: 'Restore' }, { key: 'delete', label: 'Delete', destructive: true });
    }
    // draft / under_review / rejected expose no lifecycle actions here
    // (those flows live on the dedicated Complete / Fix Issues buttons).
    return out;
  };

  // Run a single lifecycle action for one property (from the status dropdown).
  // Destructive actions (archive/delete) and mark_sold open the existing branded
  // confirm modals; the rest run immediately. All apply the route's result.
  const runRowAction = async (property, actionKey) => {
    setOpenStatusKey(null);
    if (actionKey === 'archive') { setSelectedProperty(property); setShowArchiveModal(true); return; }
    if (actionKey === 'delete') { setSelectedProperty(property); setShowDeleteModal(true); return; }
    if (actionKey === 'mark_sold') { setPropertyToMarkSold(property); setShowMarkSoldModal(true); return; }
    try {
      setStatusUpdatingId(`${property._source}-${property.id}`);
      const data = await callListingAction(actionKey, [property.id]);
      applyActionResults(actionKey, [property], data);
      summarizeResults(data);
    } catch (e) {
      alert('Action failed: ' + (e?.message || 'Unknown error'));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Apply a successful action's results to local `properties` state. Rows that
  // leave the current view (archive from Active, restore/delete from Trash) are
  // removed; status/property_status changes are merged in place.
  const applyActionResults = (actionKey, targetProps, data) => {
    const okIds = new Set((data.results || []).filter(r => r.ok).map(r => String(r.id)));
    if (okIds.size === 0) return;
    const targetBySrc = new Map(targetProps.map(p => [`${p._source}-${p.id}`, p]));
    setProperties(prev => {
      const next = [];
      for (const p of prev) {
        if (!okIds.has(String(p.id)) || !targetBySrc.has(`${p._source}-${p.id}`)) { next.push(p); continue; }
        // Leaves the list: archive (Active view) / restore + delete (Trash view).
        if (actionKey === 'delete') continue;
        if (actionKey === 'archive' && viewMode === 'active') continue;
        if (actionKey === 'restore' && viewMode === 'trash') continue;
        const isManual = p._source === 'manual';
        if (actionKey === 'mark_sold') { next.push({ ...p, property_status: 'sold' }); continue; }
        if (actionKey === 'mark_available') { next.push({ ...p, status: 'active', property_status: 'available' }); continue; }
        if (actionKey === 'activate') { next.push({ ...p, status: 'active', ...(isManual ? { property_status: 'available' } : {}) }); continue; }
        if (actionKey === 'deactivate') { next.push({ ...p, status: 'inactive', ...(isManual ? { property_status: 'unavailable' } : {}) }); continue; }
        next.push(p);
      }
      return next;
    });
    setSelectedKeys(prev => {
      const n = new Set(prev);
      for (const p of targetProps) n.delete(`${p._source}-${p.id}`);
      return n;
    });
  };

  // ── Bulk actions ─────────────────────────────────────────────────────────
  const runBulkAction = async (actionKey) => {
    if (bulkRunning) return;
    const targets = currentEntries.filter(p => selectedKeys.has(`${p._source}-${p.id}`));
    if (targets.length === 0) return;
    const destructive = ['archive', 'delete'].includes(actionKey);
    if (destructive) {
      const verb = actionKey === 'delete' ? 'permanently delete' : 'archive';
      if (!window.confirm(`Are you sure you want to ${verb} ${targets.length} listing${targets.length === 1 ? '' : 's'}?`)) return;
    }
    setBulkRunning(true);
    try {
      const data = await callListingAction(actionKey, targets.map(p => p.id));
      applyActionResults(actionKey, targets, data);
      summarizeResults(data);
    } catch (e) {
      alert('Bulk action failed: ' + (e?.message || 'Unknown error'));
    } finally {
      setBulkRunning(false);
    }
  };

  // ── Sorting (client-side, on the loaded+filtered rows) ───────────────────
  const toggleSort = (key) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'title' ? 'asc' : 'desc' });
    setCurrentPage(1);
  };

  // ── Live per-row view counts ─────────────────────────────────────────────
  // Batched: ONE query over property_analytics for the visible page's ids,
  // summing page_views per property (no N+1). We cap to the current page's rows
  // and skip ids we've already counted. Mirrors the analytics route's notion of
  // views (sum of page_views) closely enough for an at-a-glance row number.
  const viewCountKeysRef = useRef('');
  useEffect(() => {
    const rows = currentEntries;
    if (rows.length === 0) return;
    const need = rows.filter(p => viewCounts[`${p._source}-${p.id}`] === undefined);
    if (need.length === 0) return;
    const ids = need.map(p => p.id);
    const cacheKey = ids.join(',');
    if (viewCountKeysRef.current === cacheKey) return;
    viewCountKeysRef.current = cacheKey;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('property_analytics')
          .select('property_id, page_views')
          .in('property_id', ids);
        const totals = {};
        (data || []).forEach(r => {
          totals[String(r.property_id)] = (totals[String(r.property_id)] || 0) + (Number(r.page_views) || 1);
        });
        if (cancelled) return;
        setViewCounts(prev => {
          const next = { ...prev };
          for (const p of need) {
            next[`${p._source}-${p.id}`] = totals[String(p.id)] || 0;
          }
          return next;
        });
      } catch {
        // best-effort; leave counts undefined (rendered as —)
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEntries.map(p => `${p._source}-${p.id}`).join(',')]);

  // Close the per-row status dropdown on outside click / Escape.
  useEffect(() => {
    if (!openStatusKey) return;
    const onDocClick = (e) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) setOpenStatusKey(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpenStatusKey(null); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey); };
  }, [openStatusKey]);

  // Reset to page 1 when the result set changes (search/filter/tab/sort).
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, filterPropertyStatus, viewMode]);

  // Clear page-scoped selection whenever the page or tab changes.
  useEffect(() => { setSelectedKeys(new Set()); }, [currentPage, viewMode]);

  const fetchProperties = async () => {
    try {
      setLoading(true);

      // Get seller's temp_seller_id (for scraped deals); use maybeSingle so we don't fail if no row
      const { data: sellerData } = await supabase
        .from('seller_applications')
        .select('temp_seller_id')
        .eq('id', effectiveUserId)
        .maybeSingle();

      // 1) Manual listings: from properties table (seller_id = current seller)
      // NOTE: two-table union (see PAGE_SIZE/FETCH_CAP comment). We bound each
      // source with .range() so we never fetch unbounded; the union is then
      // paginated client-side.
      const { data: manualList, error: manualError } = await supabase
        .from('properties')
        .select('*')
        .eq('seller_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .range(0, FETCH_CAP - 1);

      if (manualError) {
        console.error('Error fetching manual properties:', manualError);
      }
      console.log('[Properties] Manual (properties table) query result:', { manualList: manualList ?? [], manualError: manualError ?? null });

      // Fetch property_images separately (avoids join failures if relation differs)
      let manualWithImages = manualList || [];
      if (manualWithImages.length > 0) {
        const ids = manualWithImages.map(p => p.id);
        const { data: imagesData } = await supabase
          .from('property_images')
          .select('id, image_url, sort_order, property_id')
          .in('property_id', ids)
          .order('sort_order');
        const imagesByProperty = {};
        (imagesData || []).forEach(img => {
          if (!imagesByProperty[img.property_id]) imagesByProperty[img.property_id] = [];
          imagesByProperty[img.property_id].push(img);
        });
        manualWithImages = manualWithImages.map(p => ({
          ...p,
          property_images: (imagesByProperty[p.id] || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        }));
      }

      const manual = manualWithImages.map(p => ({
        ...p,
        _source: 'manual',
        // Normalize for shared display (properties uses address, slug; no full_address in some schemas)
        full_address: p.address || p.full_address,
        property_status: p.property_status || 'available',
        slug: p.slug ?? p.id,
      }));

      // 2) Scraped listings: from wholesale_deals (email, URL import, SMS from call-and-sms)
      let scraped = [];
      if (sellerData?.temp_seller_id) {
        const { data: wholesaleList, error: wholesaleError } = await supabase
          .from('wholesale_deals')
          .select(`
            *,
            property_photos (
              id,
              photo_url,
              display_order,
              is_featured
            )
          `)
          .eq('temp_seller_id', sellerData.temp_seller_id)
          .order('created_at', { ascending: false })
          .range(0, FETCH_CAP - 1);

        if (wholesaleError) {
          console.error('Error fetching wholesale deals:', wholesaleError);
        }
        console.log('[Properties] Scraped (wholesale_deals) query result:', { wholesaleList: wholesaleList ?? [], wholesaleError: wholesaleError ?? null });
        if (!wholesaleError) {
          scraped = (wholesaleList || []).map(p => ({
            ...p,
            _source: 'scraped',
            slug: p.slug ?? p.id,
          }));
        }
      }

      // Combine and filter by view mode (archived vs active)
      const combined = [...manual, ...scraped];
      const filteredData = viewMode === 'trash'
        ? combined.filter(p => (p.status || '') === 'archived')
        : combined.filter(p => (p.status || '') !== 'archived');

      // Sort by created_at descending
      filteredData.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      // Auto-clear expired add-ons for manual properties
      const now = new Date()
      const expiredIds = filteredData
        .filter(p => p._source === 'manual')
        .filter(p =>
          (p.is_highlighted && p.highlight_ends_at && new Date(p.highlight_ends_at) < now) ||
          (p.is_boosted && p.boost_ends_at && new Date(p.boost_ends_at) < now) ||
          (p.is_homepage_featured && p.homepage_feature_ends_at && new Date(p.homepage_feature_ends_at) < now)
        )
      for (const p of expiredIds) {
        const clears = {}
        if (p.is_highlighted && p.highlight_ends_at && new Date(p.highlight_ends_at) < now) { clears.is_highlighted = false; clears.highlight_ends_at = null }
        if (p.is_boosted && p.boost_ends_at && new Date(p.boost_ends_at) < now) { clears.is_boosted = false; clears.boost_ends_at = null }
        if (p.is_homepage_featured && p.homepage_feature_ends_at && new Date(p.homepage_feature_ends_at) < now) { clears.is_homepage_featured = false; clears.homepage_feature_ends_at = null }
        supabase.from('properties').update(clears).eq('id', p.id).then(() => {})
        Object.assign(p, clears)
      }

      setProperties(filteredData);
    } catch (error) {
      console.error('Error fetching properties:', error);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter properties based on search term and filters (works for both manual + scraped)
  const filteredProperties = properties.filter(property => {
    const searchLower = searchTerm.toLowerCase();
    const title = property.slug?.replace(/-/g, ' ') || '';
    // Expanded search: title/location AND description, price, and contact fields.
    const priceStr = String(property.price ?? '');
    const matchesSearch = !searchTerm ||
      property.id?.toString().includes(searchTerm) ||
      title.toLowerCase().includes(searchLower) ||
      (property.address || '').toLowerCase().includes(searchLower) ||
      (property.full_address || '').toLowerCase().includes(searchLower) ||
      (property.city || '').toLowerCase().includes(searchLower) ||
      (property.state || '').toLowerCase().includes(searchLower) ||
      (property.zip_code || property.zip || '').toString().toLowerCase().includes(searchLower) ||
      (property.description || '').toLowerCase().includes(searchLower) ||
      priceStr.includes(searchTerm) ||
      priceStr.replace(/[^\d]/g, '').includes(searchTerm.replace(/[^\d]/g, '')) ||
      (property.contact_name || property.contact_person_name || '').toLowerCase().includes(searchLower) ||
      (property.contact_email || '').toLowerCase().includes(searchLower) ||
      (property.contact_phone || property.phone || '').toString().toLowerCase().includes(searchLower);

    // Status: normalize empty to 'active' for scraped; treat 'published' as 'active' when filtering Active
    const status = (property.status || 'active').toLowerCase();
    const filterStatusLower = (filterStatus || '').toLowerCase();
    const matchesStatus = !filterStatus ||
      status === filterStatusLower ||
      (filterStatusLower === 'active' && status === 'published');

    // Property Status: normalize null/undefined to 'available' (same fallback as display)
    const propStatus = (property.property_status || 'available').toLowerCase();
    const filterPropStatus = (filterPropertyStatus || '').toLowerCase();
    const matchesPropertyStatus = !filterPropertyStatus || propStatus === filterPropStatus;

    return matchesSearch && matchesStatus && matchesPropertyStatus;
  });

  // Sort the filtered rows (client-side) by the active column header.
  const sortedProperties = [...filteredProperties].sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    let av, bv;
    switch (sort.key) {
      case 'title':
        av = (a.full_address || a.address || a.slug || '').toLowerCase();
        bv = (b.full_address || b.address || b.slug || '').toLowerCase();
        return av.localeCompare(bv) * dir;
      case 'price':
        return ((parseFloat(a.price) || 0) - (parseFloat(b.price) || 0)) * dir;
      case 'views': {
        av = viewCounts[`${a._source}-${a.id}`] ?? -1;
        bv = viewCounts[`${b._source}-${b.id}`] ?? -1;
        return (av - bv) * dir;
      }
      case 'status':
        av = getEffectiveState(a);
        bv = getEffectiveState(b);
        return av.localeCompare(bv) * dir;
      case 'created_at':
      default:
        return (new Date(a.created_at || 0) - new Date(b.created_at || 0)) * dir;
    }
  });

  // Pagination (client-side over the sorted union; see PAGE_SIZE/FETCH_CAP note).
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = sortedProperties.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(sortedProperties.length / entriesPerPage);

  // ── Bulk-select (page-scoped) ────────────────────────────────────────────
  const pageKeys = currentEntries.map(p => `${p._source}-${p.id}`);
  const selectedCount = pageKeys.filter(k => selectedKeys.has(k)).length;
  const allPageSelected = pageKeys.length > 0 && selectedCount === pageKeys.length;
  const toggleSelectAll = () => {
    setSelectedKeys(prev => {
      const n = new Set(prev);
      if (allPageSelected) pageKeys.forEach(k => n.delete(k));
      else pageKeys.forEach(k => n.add(k));
      return n;
    });
  };
  const toggleSelectRow = (key) => {
    setSelectedKeys(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  // Valid bulk actions for the current tab. Trash exposes restore/delete;
  // Active exposes the live-listing lifecycle. The route still validates each
  // id individually (per-id partial success), so mixed-state selections are safe.
  const bulkActionDefs = viewMode === 'trash'
    ? [
        ...((workspaceRole === 'admin' || workspacePerms?.listings_delete) ? [{ key: 'restore', label: 'Restore' }] : []),
        ...((workspaceRole === 'admin' || workspacePerms?.listings_delete) ? [{ key: 'delete', label: 'Delete', destructive: true }] : []),
      ]
    : [
        ...((workspaceRole === 'admin' || workspacePerms?.listings_update) ? [
          { key: 'activate', label: 'Activate' },
          { key: 'deactivate', label: 'Pause' },
          { key: 'mark_sold', label: 'Mark sold' },
        ] : []),
        ...((workspaceRole === 'admin' || workspacePerms?.listings_delete) ? [{ key: 'archive', label: 'Archive', destructive: true }] : []),
      ];

  // Single status pill + valid-transition dropdown (desktop + mobile share it).
  const StatusPill = ({ property }) => {
    const state = getEffectiveState(property);
    const meta = STATE_META[state] || STATE_META.draft;
    const actions = getValidActions(property);
    const key = `${property._source}-${property.id}`;
    const open = openStatusKey === key;
    const busy = statusUpdatingId === key;
    return (
      <div className="relative inline-block" ref={open ? statusMenuRef : null}>
        <button
          type="button"
          onClick={() => actions.length > 0 && setOpenStatusKey(open ? null : key)}
          disabled={busy}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${meta.cls} ${actions.length > 0 ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} ${busy ? 'opacity-50' : ''}`}
          title={actions.length > 0 ? 'Change status' : meta.label}
        >
          {meta.label}
          {actions.length > 0 && <ChevronDown className="w-3 h-3" />}
        </button>
        {open && actions.length > 0 && (
          <div className="absolute left-0 mt-1 z-30 min-w-[150px] bg-white border border-[#E8E8E4] rounded shadow-lg py-1">
            {actions.map(a => (
              <button
                key={a.key}
                onClick={() => runRowAction(property, a.key)}
                className={`w-full text-left px-3 py-1.5 text-[12px] font-medium hover:bg-[#FAFAF8] transition-colors ${a.destructive ? 'text-[#D03839]' : 'text-[#1A1816]'}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Normalize property for view modal (modal expects property_images; scraped has property_photos)
  const getPropertyForModal = (property) => {
    if (!property) return null;
    if (property._source === 'scraped') {
      return {
        ...property,
        slug: property.slug || property.full_address || property.address || property.id,
        floor_area: property.floor_area ?? property.sqft ?? null,
        property_images: (property.property_photos || [])
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((p, i) => ({ image_url: p.photo_url, sort_order: p.display_order ?? i })),
      };
    }
    return property;
  };

  const handleViewClick = (property) => {
    setSelectedPropertyRaw(property);
    setSelectedProperty(getPropertyForModal(property));
    setShowViewModal(true);
  };

  const handleMarkSoldConfirm = async () => {
    if (!propertyToMarkSold || markingSold) return;
    setMarkingSold(true);
    try {
      // Route owns the counter + buyer notifications on sold.
      const data = await callListingAction('mark_sold', [propertyToMarkSold.id]);
      const r = (data.results || [])[0];
      if (r?.ok) {
        setProperties(prev => prev.map(p =>
          p.id === propertyToMarkSold.id && p._source === propertyToMarkSold._source
            ? { ...p, property_status: 'sold' }
            : p
        ));
      } else if (r) {
        alert('Failed to mark as sold: ' + (r.error || 'Unknown error'));
      }
      summarizeResults(data);
      setShowMarkSoldModal(false);
      setPropertyToMarkSold(null);
    } catch (e) {
      console.error('Error marking as sold:', e);
      alert('Failed to mark as sold: ' + (e?.message || 'Unknown error'));
    } finally {
      setMarkingSold(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!selectedProperty) return;
    try {
      // Route archives the listing AND decrements the counter (single owner).
      const data = await callListingAction('archive', [selectedProperty.id]);
      const r = (data.results || [])[0];
      if (r?.ok) {
        setProperties(prev => prev.filter(p => !(p.id === selectedProperty.id && p._source === selectedProperty._source)));
      } else if (r) {
        alert('Failed to archive property: ' + (r.error || 'Unknown error'));
      }
      summarizeResults(data);
      setShowArchiveModal(false);
      setSelectedProperty(null);
    } catch (error) {
      console.error('Error archiving property:', error);
      alert('Failed to archive property: ' + error.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProperty) return;
    try {
      // Route hard-deletes the listing (+ its images/photos) and adjusts the
      // counter if the deleted listing was still counted.
      const data = await callListingAction('delete', [selectedProperty.id]);
      const r = (data.results || [])[0];
      if (r?.ok) {
        setProperties(prev => prev.filter(p => !(p.id === selectedProperty.id && p._source === selectedProperty._source)));
      } else if (r) {
        alert('Failed to delete property: ' + (r.error || 'Unknown error'));
      }
      summarizeResults(data);
      setShowDeleteModal(false);
      setSelectedProperty(null);
    } catch (error) {
      console.error('Error deleting property:', error);
      alert('Failed to delete property: ' + error.message);
    }
  };

  const handleToggleActive = async (property, forceStatus) => {
    if (!property) return;
    const current = (property.status || 'active').toLowerCase();
    const nextStatus = forceStatus || (current === 'inactive' ? 'active' : 'inactive');
    const isManual = property._source === 'manual';
    const nextPropertyStatus = nextStatus === 'inactive' ? 'unavailable' : 'available';

    // Block activation if subscription has ended (UX gate; the route also
    // enforces permissions/transitions, but this gives a clearer message).
    if (nextStatus === 'active') {
      const { data: plan } = await supabase
        .from('seller_plans')
        .select('status')
        .eq('seller_id', effectiveUserId)
        .maybeSingle()

      if (!plan || plan.status === 'canceled') {
        setSubBlockMsg('Your subscription has ended. Renew your subscription to activate listings.')
        setTimeout(() => setSubBlockMsg(''), 5000)
        return
      }
      if (plan.status === 'past_due') {
        setSubBlockMsg('Your payment is overdue. Update your payment method on the Billing page to activate listings.')
        setTimeout(() => setSubBlockMsg(''), 5000)
        return
      }
    }

    try {
      setStatusUpdatingId(`${property._source}-${property.id}`);
      // Route owns the write + the counter (activate increments, pause decrements).
      const action = nextStatus === 'active' ? 'activate' : 'deactivate';
      const data = await callListingAction(action, [property.id]);
      const r = (data.results || [])[0];
      if (!r?.ok) {
        if (r) alert('Failed to update property status: ' + (r.error || 'Unknown error'));
        summarizeResults(data);
        return;
      }
      setProperties((prev) =>
        prev.map((p) =>
          p.id === property.id && p._source === property._source
            ? { ...p, status: nextStatus, ...(isManual ? { property_status: nextPropertyStatus } : {}) }
            : p
        )
      );
      if (data.counterWarning) summarizeResults(data);
    } catch (error) {
      console.error('Error updating property active status:', error);
      alert('Failed to update property status: ' + (error?.message || 'Unknown error'));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Clickable sortable column header.
  const SortHeader = ({ label, sortKey, align = 'left' }) => {
    const active = sort.key === sortKey;
    const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown;
    return (
      <th className={`px-4 py-3 text-${align} text-xs font-semibold text-[#444441] uppercase tracking-wider whitespace-nowrap`}>
        <button
          type="button"
          onClick={() => toggleSort(sortKey)}
          className={`inline-flex items-center gap-1 hover:text-[#1A1816] transition-colors ${active ? 'text-[#1A1816]' : ''}`}
        >
          {label}
          <Icon className="w-3 h-3" />
        </button>
      </th>
    );
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'published':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'draft':
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'under_review':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'rejected':
        return 'bg-[#FEF3E2] text-[#B5620A] border-[#F3C97D]';
      case 'archived':
      case 'inactive':
        return 'bg-[#E8E8E4] text-[#737370] border-[#E8E8E4]';
      default:
        return 'bg-[#E8E8E4] text-[#444441] border-[#E8E8E4]';
    }
  };

  const getPropertyStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'available':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'sold':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'under_contract':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-[#E8E8E4] text-[#444441] border-[#E8E8E4]';
    }
  };

  const clearFilters = () => {
    setFilterStatus('');
    setFilterPropertyStatus('');
    setSearchTerm('');
  };

  const getFeaturedImage = (property) => {
    if (property._source === 'manual') {
      const sorted = (property.property_images || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      return sorted[0]?.image_url || null;
    }
    const featuredImage = property.property_photos?.find(p => p.is_featured);
    if (featuredImage) return featuredImage.photo_url;
    const sorted = (property.property_photos || []).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    return sorted[0]?.photo_url || null;
  };

  const daysLeft = (endsAt) => {
    if (!endsAt) return null
    const diff = Math.ceil((new Date(endsAt) - new Date()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }

  const AddonTags = ({ property }) => {
    if (property._source !== 'manual') return null
    const isBundle = property.is_highlighted && property.is_boosted
    const tags = []
    if (isBundle) {
      const days = daysLeft(property.highlight_ends_at || property.boost_ends_at)
      tags.push({ label: days != null ? `Bundle · ${days}d` : 'Bundle', cls: 'bg-purple-50 text-purple-700 border-purple-200' })
    } else {
      if (property.is_highlighted) {
        const days = daysLeft(property.highlight_ends_at)
        tags.push({ label: days != null ? `Highlighted · ${days}d` : 'Highlighted', cls: 'bg-[#FEF0EF] text-[#D03839] border-[#F5C0BF]' })
      }
      if (property.is_boosted) {
        const days = daysLeft(property.boost_ends_at)
        tags.push({ label: days != null ? `Boosted · ${days}d` : 'Boosted', cls: 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE]' })
      }
    }
    if (property.is_homepage_featured) {
      const days = daysLeft(property.homepage_feature_ends_at)
      tags.push({ label: days != null ? `Featured · ${days}d` : 'Featured', cls: 'bg-[#E4F5EC] text-[#0F6E56] border-[#B6E4CE]' })
    }
    if (!tags.length) return <span className="text-[10px] text-[#A8A8A4]">—</span>
    // Surface a Renew link when any active add-on expires within 7 days.
    const soonDays = [property.highlight_ends_at, property.boost_ends_at, property.homepage_feature_ends_at]
      .map(d => daysLeft(d)).filter(d => d != null);
    const expiringSoon = soonDays.length > 0 && Math.min(...soonDays) <= 7;
    return (
      <div className="flex flex-wrap items-center gap-1">
        {tags.map(t => (
          <span key={t.label} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${t.cls}`}>
            {t.label}
          </span>
        ))}
        {expiringSoon && (
          <button onClick={() => router.push(`/properties/enhance?id=${property.id}`)}
            className="text-[10px] font-semibold text-[#D03839] hover:underline">
            Renew
          </button>
        )}
      </div>
    )
  }

  // Calculate stats (active = active or published)
  const totalProperties = properties.length;
  const activeProperties = properties.filter(p => (p.status || '') === 'active' || (p.status || '') === 'published').length;
  const draftProperties = properties.filter(p => (p.status || '') === 'draft').length;
  const availableProperties = properties.filter(p => (p.property_status || 'available').toLowerCase() === 'available').length;

  // Listings being moderated (under_review) usually flip to 'active' within a few
  // seconds via lib/moderateSellerProperty. Poll every 5s for up to 2 minutes
  // so the badge updates without the seller having to refresh the page.
  useEffect(() => {
    const pending = properties.filter(p => p._source === 'manual' && (p.status || '').toLowerCase() === 'under_review')
    if (pending.length === 0) return
    let cancelled = false
    let attempts = 0
    const MAX = 24 // 2 minutes at 5s
    const tick = async () => {
      attempts++
      if (cancelled || attempts > MAX) return
      const ids = pending.map(p => p.id)
      const { data, error } = await supabase
        .from('properties')
        .select('id, status, property_status, rejection_reason')
        .in('id', ids)
      if (!cancelled && !error && Array.isArray(data)) {
        const byId = new Map(data.map(r => [r.id, r]))
        setProperties(prev => prev.map(p => {
          const fresh = p._source === 'manual' ? byId.get(p.id) : null
          if (!fresh) return p
          return { ...p, status: fresh.status, property_status: fresh.property_status || p.property_status, rejection_reason: fresh.rejection_reason }
        }))
        // If all pending have transitioned (status !== under_review), we can stop.
        const stillPending = data.some(r => (r.status || '').toLowerCase() === 'under_review')
        if (!stillPending) return
      }
      setTimeout(tick, 5000)
    }
    const handle = setTimeout(tick, 5000)
    return () => { cancelled = true; clearTimeout(handle) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties.filter(p => p._source === 'manual' && (p.status||'').toLowerCase() === 'under_review').length])

  const setViewModeAndUrl = (mode) => {
    setViewMode(mode);
    if (mode === 'trash') {
      router.replace('/properties?view=trash');
    } else {
      router.replace('/properties');
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Top row: Title (left) | Active/Trash (center) | Add Property (right) — same on mobile and desktop */}
      <div className="grid grid-cols-3 items-center gap-3 md:gap-4">
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-[#1A1816] truncate">Properties</h1>
        </div>
        <div className="flex justify-center">
          <div className="flex items-center gap-0.5 p-1 rounded bg-[#E8E8E4] border border-[#E8E8E4]/80">
            <button
              onClick={() => setViewModeAndUrl('active')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-all duration-200 ${
                viewMode === 'active'
                  ? 'bg-white text-primary shadow-sm border border-[#E8E8E4]/80'
                  : 'text-[#444441] hover:text-[#1A1816] hover:bg-[#FAFAF8]/80'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setViewModeAndUrl('trash')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-all duration-200 ${
                viewMode === 'trash'
                  ? 'bg-white text-brandRed shadow-sm border border-[#E8E8E4]/80'
                  : 'text-[#444441] hover:text-[#1A1816] hover:bg-[#FAFAF8]/80'
              }`}
            >
              Trash
            </button>
          </div>
        </div>
        {(workspaceRole === 'admin' || workspacePerms?.listings_create) && (
          <div className="flex justify-end">
            <button
              onClick={() => router.push('/properties/new')}
              className="flex items-center gap-1.5 bg-[#D03839] hover:bg-[#E0493B] text-white px-3 py-2 rounded text-[13px] font-semibold transition-colors shrink-0"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Post a Deal</span>
              <span className="sm:hidden">Post</span>
            </button>
          </div>
        )}
      </div>

      {/* Stats: only on Active view; minimal and professional. Trash view shows a single summary line. */}
      {viewMode === 'active' ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded border border-[#E8E8E4] px-4 py-5 flex flex-col">
            <div className="flex items-start justify-between mb-5">
              <p className="text-[13px] font-medium text-[#737370]">Total listings</p>
              <div className="w-8 h-8 rounded-full bg-[#EBF3FC] flex items-center justify-center flex-shrink-0">
                <Home className="w-4 h-4 text-[#4A90E2]" />
              </div>
            </div>
            <p className="text-[36px] font-bold text-[#1A1816] leading-none tracking-tight">{totalProperties}</p>
          </div>
          <div className="bg-white rounded border border-[#E8E8E4] px-4 py-5 flex flex-col">
            <div className="flex items-start justify-between mb-5">
              <p className="text-[13px] font-medium text-[#737370]">Active</p>
              <div className="w-8 h-8 rounded-full bg-[#E4F5EC] flex items-center justify-center flex-shrink-0">
                <BarChart2 className="w-4 h-4 text-[#0F6E56]" />
              </div>
            </div>
            <p className="text-[36px] font-bold text-[#1A1816] leading-none tracking-tight">{activeProperties}</p>
          </div>
          <button
            type="button"
            onClick={() => setFilterStatus('draft')}
            className="bg-white rounded border border-[#E8E8E4] px-4 py-5 flex flex-col text-left hover:bg-[#FAFAF8] transition-colors"
          >
            <div className="flex items-start justify-between mb-5">
              <p className="text-[13px] font-medium text-[#737370]">Draft</p>
              <div className="w-8 h-8 rounded-full bg-[#FEF3E2] flex items-center justify-center flex-shrink-0">
                <FileEdit className="w-4 h-4 text-[#B5620A]" />
              </div>
            </div>
            <p className="text-[36px] font-bold text-[#1A1816] leading-none tracking-tight">{draftProperties}</p>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded border border-[#E8E8E4] px-4 py-3">
          <p className="text-sm text-[#444441]"><span className="font-semibold text-[#1A1816]">{totalProperties}</span> {totalProperties === 1 ? 'listing' : 'listings'} in trash</p>
        </div>
      )}

      {/* Publish success banner */}
      {successMsg && (
        <div className="flex items-center justify-between p-3 bg-[#E4F5EC] border border-[#A3D9B8] rounded text-[13px] text-[#0F6E56]">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="ml-3 text-[#0F6E56] hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {/* Subscription block message */}
      {subBlockMsg && (
        <div className="p-3 bg-[#FEF3E2] border border-[#F3C97D] rounded text-[13px] text-[#B5620A]">
          {subBlockMsg}
        </div>
      )}

      {/* Action result banner (bulk / single partial-success summaries) */}
      {actionMsg && (
        <div className="flex items-center justify-between p-3 bg-[#EBF3FC] border border-[#BBD6F5] rounded text-[13px] text-[#1A5FAE]">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="ml-3 text-[#1A5FAE] hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {/* Sticky bulk-action bar — shows valid actions for the current tab when
          one or more rows on the page are selected. */}
      {selectedCount > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 px-4 py-2.5 bg-white rounded border border-[#D4D4CF] shadow-card">
          <span className="text-[13px] font-semibold text-[#1A1816]">{selectedCount} selected</span>
          <div className="flex flex-wrap items-center gap-1.5 ml-1">
            {bulkActionDefs.map(a => (
              <button
                key={a.key}
                onClick={() => runBulkAction(a.key)}
                disabled={bulkRunning}
                className={`h-7 px-3 text-[12px] font-semibold rounded transition-colors disabled:opacity-50 ${
                  a.destructive
                    ? 'bg-[#FEF0EF] text-[#D03839] hover:bg-[#FCDEDE]'
                    : 'bg-[#E8E8E4] text-[#1A1816] hover:bg-[#D4D4CF]'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelectedKeys(new Set())}
            className="ml-auto text-[12px] font-medium text-[#737370] hover:text-[#1A1816]"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded border border-[#E8E8E4] overflow-hidden shadow-card">
        {/* Controls */}
        <div className="px-4 py-3 border-b border-[#E8E8E4] flex flex-col md:flex-row md:items-center gap-2">
          {/* Search — full width on mobile */}
          <div className="relative w-full md:flex-1 md:min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A8A8A4]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs border border-[#E8E8E4] rounded focus:outline-none focus:ring-1 focus:ring-[#D4D4CF] bg-white"
              placeholder="Search by title or location..."
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A8A8A4] hover:text-[#444441]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Filters row */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs border border-[#E8E8E4] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D03839]/20 focus:border-[#D03839] bg-white text-[#1A1816] shrink-0"
            >
              <option value="">Status</option>
              <option value="active">Active</option>
              <option value="under_review">Under Review</option>
              <option value="rejected">Update Required</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={filterPropertyStatus}
              onChange={(e) => setFilterPropertyStatus(e.target.value)}
              className="text-xs border border-[#E8E8E4] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D03839]/20 focus:border-[#D03839] bg-white text-[#1A1816] shrink-0"
            >
              <option value="">Property Status</option>
              <option value="available">Available</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
              <option value="under_contract">Under Contract</option>
            </select>
            <button
              onClick={clearFilters}
              className="text-xs bg-[#FEF0EF] hover:bg-[#FEE4E3] text-[#D03839] rounded px-3 py-1.5 transition-colors font-medium shrink-0"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[800px] table-auto">
            <thead className="bg-[#FAFAF8] border-b border-[#E8E8E4]">
              <tr>
                <th className="px-4 py-3 text-left w-[36px]">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all on page"
                    className="w-3.5 h-3.5 rounded border-[#D4D4CF] text-[#D03839] focus:ring-[#D03839]/20 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#444441] uppercase tracking-wider whitespace-nowrap w-[44px]">#</th>
                <SortHeader label="Property" sortKey="title" />
                <SortHeader label="Price" sortKey="price" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#444441] uppercase tracking-wider whitespace-nowrap">Type</th>
                <SortHeader label="Views" sortKey="views" />
                <SortHeader label="Status" sortKey="status" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#444441] uppercase tracking-wider whitespace-nowrap">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#444441] uppercase tracking-wider whitespace-nowrap">Enhancements</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#444441] uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E4] bg-white">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-3.5 w-3.5 bg-[#E8E8E4] rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-5 bg-[#E8E8E4] rounded" /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded bg-[#E8E8E4] shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3 w-3/4 bg-[#E8E8E4] rounded" />
                          <div className="h-2.5 w-1/2 bg-[#E8E8E4] rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-[#E8E8E4] rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-3/4 bg-[#E8E8E4] rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-8 bg-[#E8E8E4] rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-3/4 bg-[#E8E8E4] rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-3/4 bg-[#E8E8E4] rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-[#E8E8E4] rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-20 bg-[#E8E8E4] rounded" /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        {[...Array(5)].map((_, j) => (
                          <div key={j} className="w-8 h-8 rounded bg-[#E8E8E4]" />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              ) : currentEntries.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-10 text-center">
                    <Building2 className="w-10 h-10 text-[#D4D4CF] mx-auto mb-2" />
                    <p className="text-[#737370] text-sm font-medium">
                      {viewMode === 'active' ? 'No properties found' : 'No properties in trash'}
                    </p>
                    <p className="text-xs text-[#A8A8A4] mt-1">
                      {viewMode === 'active' ? 'Try adjusting your search or add a new property' : 'Deleted properties will appear here'}
                    </p>
                  </td>
                </tr>
              ) : (
                currentEntries.map((property, index) => (
                  <tr key={`${property._source}-${property.id}`} className={`transition-colors ${selectedKeys.has(`${property._source}-${property.id}`) ? 'bg-[#FEF7F6]' : 'hover:bg-[#FAFAF8]'}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(`${property._source}-${property.id}`)}
                        onChange={() => toggleSelectRow(`${property._source}-${property.id}`)}
                        aria-label="Select listing"
                        className="w-3.5 h-3.5 rounded border-[#D4D4CF] text-[#D03839] focus:ring-[#D03839]/20 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-medium text-[#A8A8A4]">{indexOfFirstEntry + index + 1}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getFeaturedImage(property) && (
                          <div className="w-10 h-10 rounded bg-[#E8E8E4] overflow-hidden shrink-0">
                            <img src={getFeaturedImage(property)} alt={property.full_address || property.address} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium text-[#1A1816] line-clamp-1">{property.full_address || property.address || property.slug?.replace(/-/g, ' ') || 'N/A'}</p>
                          <p className="text-[10px] text-[#A8A8A4]">ID: {String(property.id).split('-')[0]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-semibold text-[#1A1816]">${parseFloat(property.price || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-[#444441]">{property.property_type || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs text-[#444441]">
                        <Eye className="w-3.5 h-3.5 text-[#A8A8A4]" />
                        {viewCounts[`${property._source}-${property.id}`] ?? '—'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${property._source === 'manual' && property.status === 'rejected' ? '' : 'whitespace-nowrap'}`}>
                      <StatusPill property={property} />
                      {property._source === 'manual' && property.status === 'rejected' && property.rejection_reason && (
                        <p className="text-[10px] text-[#B5620A] mt-1 max-w-[140px] leading-tight line-clamp-2">
                          {property.rejection_reason.length > 70 ? property.rejection_reason.slice(0, 70) + '…' : property.rejection_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${property._source === 'manual' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {property._source === 'manual' ? 'Manual' : 'DeelScout'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AddonTags property={property} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Lifecycle actions (activate/pause/sold/archive/restore/delete)
                            live in the status pill dropdown. These buttons are
                            navigation/utility only. */}
                        {viewMode === 'trash' ? (
                          <button onClick={() => router.push(`/properties/preview/${property.id}`)} className="flex items-center justify-center w-8 h-8 rounded text-[#A8A8A4] hover:text-primary hover:bg-[#E8E8E4] transition-colors" title="View">
                            <Eye className="w-4 h-4" strokeWidth={2} />
                          </button>
                        ) : (
                          <>
                            {(workspaceRole === 'admin' || workspacePerms?.listings_create) && property._source === 'manual' && property.status === 'draft' && (
                              <button
                                onClick={() => router.push(`/properties/new?draft_id=${property.id}`)}
                                className="h-7 px-3 text-[11px] font-semibold bg-[#D03839] hover:bg-[#E0493B] text-white rounded transition-colors"
                              >
                                Complete
                              </button>
                            )}
                            {(workspaceRole === 'admin' || workspacePerms?.listings_update) && property._source === 'manual' && property.status === 'rejected' && (
                              <button
                                onClick={() => router.push(`/properties/edit/${property.id}`)}
                                className="h-7 px-3 text-[11px] font-semibold bg-[#D03839] hover:bg-[#E0493B] text-white rounded transition-colors"
                              >
                                Fix Issues
                              </button>
                            )}
                            {workspaceRole === 'admin' && property._source === 'manual' && ['active', 'published'].includes((property.status || '').toLowerCase()) && (
                              <button
                                onClick={() => router.push(`/properties/enhance?id=${property.id}`)}
                                className="h-7 px-3 text-[11px] font-semibold bg-[#D03839] hover:bg-[#E0493B] text-white rounded transition-colors"
                              >
                                Enhance
                              </button>
                            )}
                            <button onClick={() => router.push(`/properties/preview/${property.id}`)} className="flex items-center justify-center w-8 h-8 rounded text-[#A8A8A4] hover:text-primary hover:bg-[#E8E8E4] transition-colors" title="View">
                              <Eye className="w-4 h-4" strokeWidth={2} />
                            </button>
                            <button onClick={() => { setPropertyForUTM({ ...property, slug: property.slug || property.id, id: property.id }); setShowUTMModal(true); }} className="flex items-center justify-center w-8 h-8 rounded text-[#A8A8A4] hover:text-primary hover:bg-[#E8E8E4] transition-colors" title="Share links (UTM)">
                              <Link2 className="w-4 h-4" strokeWidth={2} />
                            </button>
                            {(workspaceRole === 'admin' || workspacePerms?.listings_update) && property.status !== 'rejected' && property.status !== 'draft' && (
                              <button onClick={() => router.push(`/properties/edit/${property.id}`)} className="flex items-center justify-center w-8 h-8 rounded text-[#A8A8A4] hover:text-primary hover:bg-[#E8E8E4] transition-colors" title="Edit">
                                <Edit2 className="w-4 h-4" strokeWidth={2} />
                              </button>
                            )}
                            <button onClick={() => { setPropertyForAnalytics(property); setShowAnalyticsSidebar(true); }} className="flex items-center justify-center w-8 h-8 rounded text-[#A8A8A4] hover:text-primary hover:bg-[#E8E8E4] transition-colors" title="Analytics">
                              <BarChart2 className="w-4 h-4" strokeWidth={2} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: Property cards */}
        <div className="md:hidden divide-y divide-[#E8E8E4]">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded bg-[#E8E8E4] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-[#E8E8E4] rounded" />
                    <div className="h-3 w-1/2 bg-[#E8E8E4] rounded" />
                    <div className="h-4 w-16 bg-[#E8E8E4] rounded" />
                    <div className="h-3 w-1/3 bg-[#E8E8E4] rounded" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-[#E8E8E4]">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="w-9 h-9 rounded bg-[#E8E8E4]" />
                  ))}
                </div>
              </div>
            ))
          ) : currentEntries.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Building2 className="w-10 h-10 text-[#D4D4CF] mx-auto mb-2" />
              <p className="text-[#737370] text-sm font-medium">
                {viewMode === 'active' ? 'No properties found' : 'No properties in trash'}
              </p>
              <p className="text-xs text-[#A8A8A4] mt-1">
                {viewMode === 'active' ? 'Try adjusting your search or add a new property' : 'Deleted properties will appear here'}
              </p>
            </div>
          ) : (
            currentEntries.map((property, index) => (
              <div key={`${property._source}-${property.id}`} className={`p-4 transition-colors ${selectedKeys.has(`${property._source}-${property.id}`) ? 'bg-[#FEF7F6]' : 'hover:bg-[#FAFAF8]/50'}`}>
                <div className="flex gap-3">
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(`${property._source}-${property.id}`)}
                    onChange={() => toggleSelectRow(`${property._source}-${property.id}`)}
                    aria-label="Select listing"
                    className="mt-1 w-4 h-4 rounded border-[#D4D4CF] text-[#D03839] focus:ring-[#D03839]/20 cursor-pointer shrink-0"
                  />
                  {getFeaturedImage(property) ? (
                    <div className="w-20 h-20 rounded bg-[#E8E8E4] overflow-hidden shrink-0">
                      <img src={getFeaturedImage(property)} alt={property.full_address || property.address} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded bg-[#E8E8E4] shrink-0 flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-[#A8A8A4]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1816] line-clamp-2">{property.full_address || property.address || property.slug?.replace(/-/g, ' ') || 'N/A'}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${property._source === 'manual' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {property._source === 'manual' ? 'Manual' : 'DeelScout'}
                      </span>
                      <StatusPill property={property} />
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#737370]">
                        <Eye className="w-3 h-3 text-[#A8A8A4]" />
                        {viewCounts[`${property._source}-${property.id}`] ?? '—'} views
                      </span>
                      <AddonTags property={property} />
                    </div>
                    <p className="text-xs text-[#444441] mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#A8A8A4] shrink-0" />
                      <span className="truncate">{property.city && property.state ? `${property.city}, ${property.state}` : property.address || 'N/A'}</span>
                    </p>
                    <p className="text-sm font-semibold text-[#1A1816] mt-0.5">
                      ${parseFloat(property.price || 0).toLocaleString()}
                      {property.property_type && <span className="text-[#737370] font-normal text-xs ml-1">· {property.property_type}</span>}
                    </p>
                  </div>
                </div>
                {property._source === 'manual' && property.status === 'rejected' && property.rejection_reason && (
                  <div className="mb-3 px-3 py-2.5 bg-[#FEF3E2] border border-[#F3C97D] rounded">
                    <p className="text-[10px] font-semibold text-[#B5620A] uppercase tracking-wide mb-1">Issues to fix</p>
                    <p className="text-[11px] text-[#B5620A] leading-relaxed">
                      {property.rejection_reason.length > 140 ? property.rejection_reason.slice(0, 140) + '…' : property.rejection_reason}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-around mt-3 pt-3 border-t border-[#E8E8E4]">
                  {/* Lifecycle actions live in the status pill above. */}
                  {viewMode === 'trash' ? (
                    <button onClick={() => router.push(`/properties/preview/${property.id}`)} className="flex-1 flex items-center justify-center h-9 rounded text-[#737370] hover:text-primary hover:bg-[#E8E8E4] transition-colors" title="View">
                      <Eye className="w-4 h-4" strokeWidth={2} />
                    </button>
                  ) : (
                    <>
                      {(workspaceRole === 'admin' || workspacePerms?.listings_create) && property._source === 'manual' && property.status === 'draft' && (
                        <button
                          onClick={() => router.push(`/properties/new?draft_id=${property.id}`)}
                          className="flex-1 flex flex-col items-center gap-1 py-1 text-white bg-[#D03839] hover:bg-[#E0493B] rounded transition-colors"
                        >
                          <span className="text-[10px] font-semibold">Complete</span>
                        </button>
                      )}
                      {(workspaceRole === 'admin' || workspacePerms?.listings_update) && property._source === 'manual' && property.status === 'rejected' && (
                        <button
                          onClick={() => router.push(`/properties/edit/${property.id}`)}
                          className="flex-1 flex flex-col items-center gap-1 py-1 text-[#D03839] bg-[#FEF0EF] hover:bg-[#FCDEDE] rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="text-[10px] font-medium">Fix Issues</span>
                        </button>
                      )}
                      {workspaceRole === 'admin' && property._source === 'manual' && ['active', 'published'].includes((property.status || '').toLowerCase()) && (
                        <button onClick={() => router.push(`/properties/enhance?id=${property.id}`)} className="flex-1 flex items-center justify-center h-9 rounded text-[#737370] hover:text-[#D03839] hover:bg-[#FEF0EF] transition-colors" title="Enhance listing">
                          <Zap className="w-4 h-4" strokeWidth={2} />
                        </button>
                      )}
                      <button onClick={() => router.push(`/properties/preview/${property.id}`)} className="flex-1 flex items-center justify-center h-9 rounded text-[#737370] hover:text-primary hover:bg-[#E8E8E4] transition-colors" title="View">
                        <Eye className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <button onClick={() => { setPropertyForUTM({ ...property, slug: property.slug || property.id, id: property.id }); setShowUTMModal(true); }} className="flex-1 flex items-center justify-center h-9 rounded text-[#737370] hover:text-primary hover:bg-[#E8E8E4] transition-colors" title="Share links">
                        <Link2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                      {(workspaceRole === 'admin' || workspacePerms?.listings_update) && property.status !== 'rejected' && property.status !== 'draft' && (
                        <button onClick={() => router.push(`/properties/edit/${property.id}`)} className="flex-1 flex items-center justify-center h-9 rounded text-[#737370] hover:text-primary hover:bg-[#E8E8E4] transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" strokeWidth={2} />
                        </button>
                      )}
                      <button onClick={() => { setPropertyForAnalytics(property); setShowAnalyticsSidebar(true); }} className="flex-1 flex items-center justify-center h-9 rounded text-[#737370] hover:text-primary hover:bg-[#E8E8E4] transition-colors" title="Analytics">
                        <BarChart2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer - Pagination */}
        <div className="px-4 py-3 bg-[#FAFAF8] border-t border-[#E8E8E4] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs text-[#737370]">
            Showing <span className="font-medium text-[#444441]">{sortedProperties.length > 0 ? indexOfFirstEntry + 1 : 0}</span> to{' '}
            <span className="font-medium text-[#444441]">{Math.min(indexOfLastEntry, sortedProperties.length)}</span> of{' '}
            <span className="font-medium text-[#444441]">{sortedProperties.length}</span> entries
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-[#E8E8E4] hover:bg-[#E8E8E4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-[28px] h-7 px-2 text-xs font-medium rounded transition-colors ${currentPage === pageNum
                      ? 'bg-primary text-white'
                      : 'border border-[#E8E8E4] text-[#444441] hover:bg-[#E8E8E4]'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-[#E8E8E4] hover:bg-[#E8E8E4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedProperty(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemName={selectedProperty?.full_address || selectedProperty?.address || selectedProperty?.slug || selectedProperty?.title || 'this property'}
        isPermanent={true}
      />

      <DeleteConfirmModal
        isOpen={showArchiveModal}
        onClose={() => {
          setShowArchiveModal(false);
          setSelectedProperty(null);
        }}
        onConfirm={handleArchiveConfirm}
        itemName={selectedProperty?.full_address || selectedProperty?.address || selectedProperty?.slug || 'this property'}
        isPermanent={false}
      />

      {showMarkSoldModal && propertyToMarkSold && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-[#1A1816]/40 transition-opacity" onClick={() => { if (!markingSold) { setShowMarkSoldModal(false); setPropertyToMarkSold(null) } }} aria-hidden="true" />
            <div className="relative bg-white rounded shadow-lg border border-[#E8E8E4] max-w-md w-full p-6 z-10">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded bg-[#E4F5EC] flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-[#0F6E56]" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] font-semibold text-[#1A1816] mb-1">Mark as sold?</h3>
                  <p className="text-[13px] text-[#737370]">This listing will display a Sold badge. You can change it back from the edit page anytime.</p>
                </div>
              </div>
              <div className="py-2.5 px-3 mb-5 bg-[#FAFAF8] border border-[#E8E8E4] rounded">
                <p className="text-[13px] text-[#1A1816] font-medium break-words">
                  {propertyToMarkSold.full_address || propertyToMarkSold.address || propertyToMarkSold.slug || 'this property'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setShowMarkSoldModal(false); setPropertyToMarkSold(null) }}
                  disabled={markingSold}
                  className="flex-1 h-10 px-4 text-[13px] font-semibold text-[#1A1816] bg-white border border-[#E8E8E4] rounded hover:bg-[#FAFAF8] transition-colors disabled:opacity-50"
                >Cancel</button>
                <button
                  type="button"
                  onClick={handleMarkSoldConfirm}
                  disabled={markingSold}
                  className="flex-1 h-10 px-4 text-[13px] font-semibold text-white bg-[#0F6E56] hover:bg-[#0C5A47] rounded transition-colors disabled:opacity-50"
                >{markingSold ? 'Marking…' : 'Mark as Sold'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedProperty && (
        <PropertyViewModal
          property={selectedProperty}
          onClose={() => {
            setShowViewModal(false);
            setSelectedProperty(null);
          }}
          onOpenUTMLinks={() => {
            const raw = selectedPropertyRaw || propertyForUTM;
            if (raw) setPropertyForUTM({ ...raw, slug: raw.slug || raw.id });
            setShowUTMModal(true);
          }}
        />
      )}

      {showUTMModal && propertyForUTM && (
        <UTMLinksModal
          isOpen={showUTMModal}
          onClose={() => {
            setShowUTMModal(false);
            setPropertyForUTM(null);
          }}
          property={{ ...propertyForUTM, slug: propertyForUTM.slug || propertyForUTM.id }}
          baseUrl={DEELMAP_VIEW_BASE_URL.replace(/\/$/, '')}
          userId={userId}
        />
      )}

      {showAnalyticsSidebar && propertyForAnalytics && (
        <div className="!mt-0">
          <PropertyAnalyticsSidebar
            propertyId={propertyForAnalytics.id}
            propertyName={propertyForAnalytics.full_address || propertyForAnalytics.address || propertyForAnalytics.slug}
            isEnterprise={planType === 'enterprise'}
            onClose={() => {
              setShowAnalyticsSidebar(false);
              setPropertyForAnalytics(null);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default PropertiesManagement;
