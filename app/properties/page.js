"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Search, X, Building2, ChevronLeft, ChevronRight, ChevronDown, MapPin, DollarSign, RotateCcw, BarChart2, Link2, Home, FileEdit, Eye, Zap, CheckCircle } from 'lucide-react';
import ToggleSwitch from '@/components/properties/ToggleSwitch';
import { useRouter, useSearchParams } from 'next/navigation';
import DeleteConfirmModal from '@/components/properties/DeleteConfirmModal';
import PropertyViewModal from '@/components/properties/PropertyViewModal';
import PropertyAnalyticsSidebar from '@/components/properties/PropertyAnalyticsSidebar';
import { UTMLinksModal } from '@/components/properties/UTMLinksModal';

const DEELMAP_VIEW_BASE_URL = process.env.NEXT_PUBLIC_DEELMAP_VIEW_BASE_URL || 'https://deelmap.com';

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
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
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

  // Keep viewMode in sync with URL (e.g. when opening "View Archived" from dashboard)
  useEffect(() => {
    setViewMode(viewFromUrl);
  }, [viewFromUrl]);

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
      const { data: manualList, error: manualError } = await supabase
        .from('properties')
        .select('*')
        .eq('seller_id', effectiveUserId)
        .order('created_at', { ascending: false });

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
          .order('created_at', { ascending: false });

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
    const matchesSearch = !searchTerm ||
      property.id?.toString().includes(searchTerm) ||
      title.toLowerCase().includes(searchLower) ||
      (property.address || '').toLowerCase().includes(searchLower) ||
      (property.full_address || '').toLowerCase().includes(searchLower) ||
      (property.city || '').toLowerCase().includes(searchLower) ||
      (property.state || '').toLowerCase().includes(searchLower);

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

  // Pagination
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredProperties.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredProperties.length / entriesPerPage);

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

  // Handle archive/restore
  const handleArchiveClick = (property) => {
    setSelectedProperty(property);
    setShowArchiveModal(true);
  };

  // Mark Listing as Sold — quick row-level action.
  // Only manual listings (not DeelScout-sourced) support this. Sets
  // property_status='sold' but keeps the listing visible in the seller's table
  // (it just gets a Sold badge). Doesn't archive or delete.
  const handleMarkSoldClick = (property) => {
    setPropertyToMarkSold(property);
    setShowMarkSoldModal(true);
  };

  const handleMarkSoldConfirm = async () => {
    if (!propertyToMarkSold || markingSold) return;
    setMarkingSold(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({ property_status: 'sold' })
        .eq('id', propertyToMarkSold.id)
        .eq('seller_id', effectiveUserId);
      if (error) throw error;
      setProperties(prev => prev.map(p =>
        p.id === propertyToMarkSold.id && p._source === 'manual'
          ? { ...p, property_status: 'sold' }
          : p
      ));
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
      if (selectedProperty._source === 'manual') {
        const { error } = await supabase
          .from('properties')
          .update({ status: 'archived', property_status: 'unavailable' })
          .eq('id', selectedProperty.id)
          .eq('seller_id', effectiveUserId);
        if (error) throw error;
      } else {
        const { data: sellerRow } = await supabase
          .from('seller_applications')
          .select('temp_seller_id')
          .eq('id', effectiveUserId)
          .maybeSingle();
        const tempSellerId = sellerRow?.temp_seller_id;
        if (!tempSellerId) {
          alert('Unable to verify ownership. Please try again.');
          return;
        }
        const { error } = await supabase
          .from('wholesale_deals')
          .update({ status: 'archived' })
          .eq('id', selectedProperty.id)
          .eq('temp_seller_id', tempSellerId);
        if (error) throw error;
      }
      // Decrement listings_used_this_period when moved to trash
      const { data: planRow } = await supabase
        .from('seller_plans')
        .select('id, listings_used_this_period')
        .eq('seller_id', effectiveUserId)
        .maybeSingle()
      if (planRow && planRow.listings_used_this_period > 0) {
        await supabase
          .from('seller_plans')
          .update({ listings_used_this_period: planRow.listings_used_this_period - 1 })
          .eq('id', planRow.id)
      }
      setProperties(prev => prev.filter(p => p.id !== selectedProperty.id));
      setShowArchiveModal(false);
      setSelectedProperty(null);
    } catch (error) {
      console.error('Error archiving property:', error);
      alert('Failed to archive property: ' + error.message);
    }
  };

  const handleRestore = async (property) => {
    try {
      if (property._source === 'manual') {
        const { error } = await supabase
          .from('properties')
          .update({ status: 'inactive', property_status: 'unavailable' })
          .eq('id', property.id)
          .eq('seller_id', effectiveUserId);
        if (error) throw error;
      } else {
        const { data: sellerRow } = await supabase
          .from('seller_applications')
          .select('temp_seller_id')
          .eq('id', effectiveUserId)
          .maybeSingle();
        const tempSellerId = sellerRow?.temp_seller_id;
        if (!tempSellerId) {
          alert('Unable to verify ownership. Please try again.');
          return;
        }
        const { error } = await supabase
          .from('wholesale_deals')
          .update({ status: 'inactive' })
          .eq('id', property.id)
          .eq('temp_seller_id', tempSellerId);
        if (error) throw error;
      }
      // Increment listings_used_this_period when restored from trash
      const { data: planRow } = await supabase
        .from('seller_plans')
        .select('id, listings_used_this_period')
        .eq('seller_id', effectiveUserId)
        .maybeSingle()
      if (planRow) {
        await supabase
          .from('seller_plans')
          .update({ listings_used_this_period: (planRow.listings_used_this_period ?? 0) + 1 })
          .eq('id', planRow.id)
      }
      setProperties(prev => prev.filter(p => p.id !== property.id));
    } catch (error) {
      console.error('Error restoring property:', error);
      alert('Failed to restore property: ' + error.message);
    }
  };

  const handleDeleteClick = (property) => {
    setSelectedProperty(property);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProperty) return;
    try {
      if (selectedProperty._source === 'manual') {
        const { error: imgErr } = await supabase
          .from('property_images')
          .delete()
          .eq('property_id', selectedProperty.id);
        if (imgErr) console.error('Error deleting property images:', imgErr);
        const { error } = await supabase
          .from('properties')
          .delete()
          .eq('id', selectedProperty.id)
          .eq('seller_id', effectiveUserId);
        if (error) throw error;
        // Decrement listings_used_this_period
        const { data: planRow } = await supabase
          .from('seller_plans')
          .select('id, listings_used_this_period')
          .eq('seller_id', effectiveUserId)
          .maybeSingle()
        if (planRow && planRow.listings_used_this_period > 0) {
          await supabase
            .from('seller_plans')
            .update({ listings_used_this_period: planRow.listings_used_this_period - 1 })
            .eq('id', planRow.id)
        }
      } else {
        const { data: sellerRow } = await supabase
          .from('seller_applications')
          .select('temp_seller_id')
          .eq('id', effectiveUserId)
          .maybeSingle();
        const tempSellerId = sellerRow?.temp_seller_id;
        if (!tempSellerId) {
          alert('Unable to verify ownership. Please try again.');
          return;
        }
        const { error: photosError } = await supabase
          .from('property_photos')
          .delete()
          .eq('deal_id', selectedProperty.id);
        if (photosError) console.error('Error deleting photos:', photosError);
        const { error } = await supabase
          .from('wholesale_deals')
          .delete()
          .eq('id', selectedProperty.id)
          .eq('temp_seller_id', tempSellerId);
        if (error) throw error;
      }
      setProperties(prev => prev.filter(p => p.id !== selectedProperty.id));
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

    // Block activation if subscription has ended
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
      if (isManual) {
        const { error } = await supabase
          .from('properties')
          .update({ status: nextStatus, property_status: nextPropertyStatus })
          .eq('id', property.id)
          .eq('seller_id', effectiveUserId);
        if (error) throw error;
      } else {
        const { data: sellerRow } = await supabase
          .from('seller_applications')
          .select('temp_seller_id')
          .eq('id', effectiveUserId)
          .maybeSingle();
        const tempSellerId = sellerRow?.temp_seller_id;
        if (!tempSellerId) {
          alert('Unable to verify ownership. Please try again.');
          return;
        }
        const { error } = await supabase
          .from('wholesale_deals')
          .update({ status: nextStatus })
          .eq('id', property.id)
          .eq('temp_seller_id', tempSellerId);
        if (error) throw error;
      }

      setProperties((prev) =>
        prev.map((p) =>
          p.id === property.id && p._source === property._source
            ? { ...p, status: nextStatus, ...(isManual ? { property_status: nextPropertyStatus } : {}) }
            : p
        )
      );
    } catch (error) {
      console.error('Error updating property active status:', error);
      alert('Failed to update property status: ' + (error?.message || 'Unknown error'));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Status is value-encoded, never hue: active=ink, draft/review=muted, sold/expired=mist.
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'published':
        return 'bg-ink text-white border-ink';
      case 'draft':
      case 'pending':
      case 'under_review':
      case 'rejected':
        return 'bg-muted text-white border-muted';
      case 'archived':
      case 'inactive':
        return 'bg-mist text-white border-mist';
      default:
        return 'bg-muted text-white border-muted';
    }
  };

  const getPropertyStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'available':
        return 'bg-ink text-white border-ink';
      case 'pending':
      case 'under_contract':
        return 'bg-muted text-white border-muted';
      case 'sold':
        return 'bg-mist text-white border-mist';
      default:
        return 'bg-muted text-white border-muted';
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
      tags.push({ label: days != null ? `Bundle · ${days}d` : 'Bundle', cls: 'bg-tint text-ink border-ink' })
    } else {
      if (property.is_highlighted) {
        const days = daysLeft(property.highlight_ends_at)
        tags.push({ label: days != null ? `Highlighted · ${days}d` : 'Highlighted', cls: 'bg-tint text-ink border-ink' })
      }
      if (property.is_boosted) {
        const days = daysLeft(property.boost_ends_at)
        tags.push({ label: days != null ? `Boosted · ${days}d` : 'Boosted', cls: 'bg-tint text-ink border-line' })
      }
    }
    if (property.is_homepage_featured) {
      const days = daysLeft(property.homepage_feature_ends_at)
      tags.push({ label: days != null ? `Featured · ${days}d` : 'Featured', cls: 'bg-tint text-ink border-line-2' })
    }
    if (!tags.length) return <span className="font-mono text-[10px] text-mist">—</span>
    // Surface a Renew link when any active add-on expires within 7 days.
    const soonDays = [property.highlight_ends_at, property.boost_ends_at, property.homepage_feature_ends_at]
      .map(d => daysLeft(d)).filter(d => d != null);
    const expiringSoon = soonDays.length > 0 && Math.min(...soonDays) <= 7;
    return (
      <div className="flex flex-wrap items-center gap-1">
        {tags.map(t => (
          <span key={t.label} className={`inline-flex items-center px-2 py-0.5 rounded-pill font-mono text-[10px] font-semibold uppercase tracking-[0.05em] border ${t.cls}`}>
            {t.label}
          </span>
        ))}
        {expiringSoon && (
          <button onClick={() => router.push(`/properties/enhance?id=${property.id}`)}
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-ink hover:underline">
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
          <h1 className="font-display font-bold text-lg md:text-xl tracking-[-0.01em] text-body truncate">Properties</h1>
        </div>
        <div className="flex justify-center">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewModeAndUrl('active')}
              className={`px-3.5 py-2 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase border-[1.5px] border-ink rounded-pill transition-colors duration-120 ${
                viewMode === 'active'
                  ? 'bg-ink text-white'
                  : 'bg-white text-ink hover:bg-tint'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setViewModeAndUrl('trash')}
              className={`px-3.5 py-2 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase border-[1.5px] border-ink rounded-pill transition-colors duration-120 ${
                viewMode === 'trash'
                  ? 'bg-ink text-white'
                  : 'bg-white text-ink hover:bg-tint'
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
              className="flex items-center gap-1.5 bg-ink hover:bg-smoke-2 text-white border-[1.5px] border-ink px-3.5 py-2 rounded-[10px] text-[13px] font-semibold shadow-soft-3 transition-all duration-120 shrink-0"
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
          <div className="bg-white rounded-[12px] border-[1.5px] border-ink shadow-offset-3 px-4 py-5 flex flex-col">
            <div className="flex items-start justify-between mb-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Total listings</p>
              <div className="w-8 h-8 rounded-[8px] bg-tint border-[1.5px] border-ink flex items-center justify-center flex-shrink-0">
                <Home className="w-4 h-4 text-ink" />
              </div>
            </div>
            <p className="font-display text-[36px] font-bold text-body leading-none tracking-[-0.025em]">{totalProperties}</p>
          </div>
          <div className="bg-white rounded-[12px] border-[1.5px] border-ink shadow-offset-3 px-4 py-5 flex flex-col">
            <div className="flex items-start justify-between mb-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Active</p>
              <div className="w-8 h-8 rounded-[8px] bg-tint border-[1.5px] border-ink flex items-center justify-center flex-shrink-0">
                <BarChart2 className="w-4 h-4 text-ink" />
              </div>
            </div>
            <p className="font-display text-[36px] font-bold text-body leading-none tracking-[-0.025em]">{activeProperties}</p>
          </div>
          <button
            type="button"
            onClick={() => setFilterStatus('draft')}
            className="bg-white rounded-[12px] border-[1.5px] border-ink shadow-offset-3 px-4 py-5 flex flex-col text-left hover:bg-tint transition-colors duration-120"
          >
            <div className="flex items-start justify-between mb-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Draft</p>
              <div className="w-8 h-8 rounded-[8px] bg-tint border-[1.5px] border-ink flex items-center justify-center flex-shrink-0">
                <FileEdit className="w-4 h-4 text-ink" />
              </div>
            </div>
            <p className="font-display text-[36px] font-bold text-body leading-none tracking-[-0.025em]">{draftProperties}</p>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-[12px] border-[1.5px] border-ink px-4 py-3">
          <p className="text-sm text-smoke-2"><span className="font-display font-bold text-body">{totalProperties}</span> {totalProperties === 1 ? 'listing' : 'listings'} in trash</p>
        </div>
      )}

      {/* Publish success banner */}
      {successMsg && (
        <div className="flex items-center justify-between p-3 bg-tint border-[1.5px] border-ink rounded-[10px] text-[13px] font-semibold text-ink">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="ml-3 text-ink hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {/* Subscription block message */}
      {subBlockMsg && (
        <div className="p-3 bg-tint border-[1.5px] border-ink rounded-[10px] text-[13px] font-semibold text-ink">
          {subBlockMsg}
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-[12px] border-[1.5px] border-ink overflow-hidden shadow-offset-4">
        {/* Controls */}
        <div className="px-4 py-3 border-b border-hairline flex flex-col md:flex-row md:items-center gap-2">
          {/* Search — full width on mobile */}
          <div className="relative w-full md:flex-1 md:min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mist" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs border-[1.5px] border-line rounded-[9px] focus:outline-none focus:border-ink focus:shadow-offset-2 bg-white"
              placeholder="Search by title or location..."
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mist hover:text-smoke-2"
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
              className="text-xs border-[1.5px] border-line rounded-[9px] px-2 py-1.5 focus:outline-none focus:border-ink bg-white text-body shrink-0"
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
              className="text-xs border-[1.5px] border-line rounded-[9px] px-2 py-1.5 focus:outline-none focus:border-ink bg-white text-body shrink-0"
            >
              <option value="">Property Status</option>
              <option value="available">Available</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
              <option value="under_contract">Under Contract</option>
            </select>
            <button
              onClick={clearFilters}
              className="text-xs bg-white hover:bg-tint text-ink border-[1.5px] border-ink rounded-[9px] px-3 py-1.5 transition-colors duration-120 font-semibold shrink-0"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[800px] table-auto">
            <thead className="bg-tint-3 border-b-[1.5px] border-ink">
              <tr>
                <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.12em] whitespace-nowrap w-[44px]">#</th>
                <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.12em] whitespace-nowrap">Property</th>
                <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.12em] whitespace-nowrap">Price</th>
                <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.12em] whitespace-nowrap">Type</th>
                <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.12em] whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.12em] whitespace-nowrap">Source</th>
                <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.12em] whitespace-nowrap">Enhancements</th>
                <th className="px-4 py-3 text-right font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.12em] whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline bg-white">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="motion-safe:animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 w-5 bg-tint rounded" /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-[8px] bg-stripes shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3 w-3/4 bg-tint rounded" />
                          <div className="h-2.5 w-1/2 bg-tint rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-tint rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-3/4 bg-tint rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-3/4 bg-tint rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-3/4 bg-tint rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-tint rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-20 bg-tint rounded" /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        {[...Array(5)].map((_, j) => (
                          <div key={j} className="w-8 h-8 rounded bg-tint" />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              ) : currentEntries.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-10 text-center">
                    <Building2 className="w-10 h-10 text-line-2 mx-auto mb-2" />
                    <p className="text-muted text-sm font-medium">
                      {viewMode === 'active' ? 'No properties found' : 'No properties in trash'}
                    </p>
                    <p className="text-xs text-mist mt-1">
                      {viewMode === 'active' ? 'Try adjusting your search or add a new property' : 'Deleted properties will appear here'}
                    </p>
                  </td>
                </tr>
              ) : (
                currentEntries.map((property, index) => (
                  <tr key={`${property._source}-${property.id}`} className="hover:bg-tint-3 transition-colors duration-120">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-medium text-mist">{indexOfFirstEntry + index + 1}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getFeaturedImage(property) && (
                          <div className="w-10 h-10 rounded-[8px] bg-stripes overflow-hidden shrink-0">
                            <img src={getFeaturedImage(property)} alt={property.full_address || property.address} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium text-body line-clamp-1">{property.full_address || property.address || property.slug?.replace(/-/g, ' ') || 'N/A'}</p>
                          <p className="font-mono text-[10px] text-mist">ID: {String(property.id).split('-')[0]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-display text-[15px] font-bold text-body">${parseFloat(property.price || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-smoke-2">{property.property_type || 'N/A'}</span>
                    </td>
                    <td className={`px-4 py-3 ${property._source === 'manual' && property.status === 'rejected' ? '' : 'whitespace-nowrap'}`}>
                      {viewMode === 'active' && ['active', 'inactive'].includes((property.status || '').toLowerCase()) ? (
                        <ToggleSwitch
                          value={(property.status || '').toLowerCase() === 'active'}
                          onChange={(next) => handleToggleActive(property, next ? 'active' : 'inactive')}
                          disabled={statusUpdatingId === `${property._source}-${property.id}`}
                          label="Listing visible to buyers"
                          onLabel="Active"
                          offLabel="Inactive"
                        />
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-pill font-mono text-[10px] font-semibold uppercase tracking-[0.05em] border ${getStatusColor(property.status)}`}>
                          {property.status === 'under_review' ? 'Under Review' : property.status === 'rejected' ? 'Update Required' : (property.status || 'draft')?.charAt(0).toUpperCase() + (property.status || '').slice(1) || 'Draft'}
                        </span>
                      )}
                      {property._source === 'manual' && property.status === 'rejected' && property.rejection_reason && (
                        <p className="text-[10px] text-smoke-3 mt-1 max-w-[140px] leading-tight line-clamp-2">
                          {property.rejection_reason.length > 70 ? property.rejection_reason.slice(0, 70) + '…' : property.rejection_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-pill font-mono text-[10px] font-semibold uppercase tracking-[0.05em] border border-ink bg-tint text-ink">
                        {property._source === 'manual' ? 'Manual' : 'DeelScout'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AddonTags property={property} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {viewMode === 'trash' ? (
                          <>
                            <button onClick={() => handleRestore(property)} className="flex items-center justify-center w-8 h-8 rounded-[8px] text-mist hover:text-ink hover:bg-tint transition-colors duration-120" title="Restore">
                              <RotateCcw className="w-4 h-4" strokeWidth={2} />
                            </button>
                            {(workspaceRole === 'admin' || workspacePerms?.listings_delete) && (
                              <button onClick={() => handleDeleteClick(property)} className="flex items-center justify-center w-8 h-8 rounded-[8px] text-mist hover:text-ink hover:bg-tint transition-colors duration-120" title="Delete Permanently">
                                <Trash2 className="w-4 h-4" strokeWidth={2} />
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {(workspaceRole === 'admin' || workspacePerms?.listings_create) && property._source === 'manual' && property.status === 'draft' && (
                              <button
                                onClick={() => router.push(`/properties/new?draft_id=${property.id}`)}
                                className="h-7 px-3 text-[11px] font-semibold bg-ink hover:bg-smoke-2 text-white border border-ink rounded-[8px] transition-colors duration-120"
                              >
                                Complete
                              </button>
                            )}
                            {(workspaceRole === 'admin' || workspacePerms?.listings_update) && property._source === 'manual' && property.status === 'rejected' && (
                              <button
                                onClick={() => router.push(`/properties/edit/${property.id}`)}
                                className="h-7 px-3 text-[11px] font-semibold bg-ink hover:bg-smoke-2 text-white border border-ink rounded-[8px] transition-colors duration-120"
                              >
                                Fix Issues
                              </button>
                            )}
                            {workspaceRole === 'admin' && property._source === 'manual' && ['active', 'published'].includes((property.status || '').toLowerCase()) && (
                              <button
                                onClick={() => router.push(`/properties/enhance?id=${property.id}`)}
                                className="h-7 px-3 text-[11px] font-semibold bg-ink hover:bg-smoke-2 text-white border border-ink rounded-[8px] transition-colors duration-120"
                              >
                                Enhance
                              </button>
                            )}
                            <button onClick={() => router.push(`/properties/preview/${property.id}`)} className="flex items-center justify-center w-8 h-8 rounded-[8px] text-mist hover:text-ink hover:bg-tint transition-colors duration-120" title="View">
                              <Eye className="w-4 h-4" strokeWidth={2} />
                            </button>
                            <button onClick={() => { setPropertyForUTM({ ...property, slug: property.slug || property.id, id: property.id }); setShowUTMModal(true); }} className="flex items-center justify-center w-8 h-8 rounded-[8px] text-mist hover:text-ink hover:bg-tint transition-colors duration-120" title="Share links (UTM)">
                              <Link2 className="w-4 h-4" strokeWidth={2} />
                            </button>
                            {(workspaceRole === 'admin' || workspacePerms?.listings_update) && property.status !== 'rejected' && property.status !== 'draft' && (
                              <button onClick={() => router.push(`/properties/edit/${property.id}`)} className="flex items-center justify-center w-8 h-8 rounded-[8px] text-mist hover:text-ink hover:bg-tint transition-colors duration-120" title="Edit">
                                <Edit2 className="w-4 h-4" strokeWidth={2} />
                              </button>
                            )}
                            {(workspaceRole === 'admin' || workspacePerms?.listings_update) && property._source === 'manual' && ['active','published'].includes((property.status||'').toLowerCase()) && (property.property_status||'').toLowerCase() !== 'sold' && (
                              <button onClick={() => handleMarkSoldClick(property)} className="flex items-center justify-center w-8 h-8 rounded-[8px] text-mist hover:text-ink hover:bg-tint transition-colors duration-120" title="Mark as Sold">
                                <CheckCircle className="w-4 h-4" strokeWidth={2} />
                              </button>
                            )}
                            <button onClick={() => { setPropertyForAnalytics(property); setShowAnalyticsSidebar(true); }} className="flex items-center justify-center w-8 h-8 rounded-[8px] text-mist hover:text-ink hover:bg-tint transition-colors duration-120" title="Analytics">
                              <BarChart2 className="w-4 h-4" strokeWidth={2} />
                            </button>
                            {(workspaceRole === 'admin' || workspacePerms?.listings_delete) && (
                              <button onClick={() => handleArchiveClick(property)} className="flex items-center justify-center w-8 h-8 rounded-[8px] text-mist hover:text-ink hover:bg-tint transition-colors duration-120" title="Move to Trash">
                                <Trash2 className="w-4 h-4" strokeWidth={2} />
                              </button>
                            )}
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
        <div className="md:hidden divide-y divide-hairline">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4 motion-safe:animate-pulse">
                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded-[8px] bg-stripes shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-tint rounded" />
                    <div className="h-3 w-1/2 bg-tint rounded" />
                    <div className="h-4 w-16 bg-tint rounded" />
                    <div className="h-3 w-1/3 bg-tint rounded" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-hairline">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="w-9 h-9 rounded bg-tint" />
                  ))}
                </div>
              </div>
            ))
          ) : currentEntries.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Building2 className="w-10 h-10 text-line-2 mx-auto mb-2" />
              <p className="text-muted text-sm font-medium">
                {viewMode === 'active' ? 'No properties found' : 'No properties in trash'}
              </p>
              <p className="text-xs text-mist mt-1">
                {viewMode === 'active' ? 'Try adjusting your search or add a new property' : 'Deleted properties will appear here'}
              </p>
            </div>
          ) : (
            currentEntries.map((property, index) => (
              <div key={`${property._source}-${property.id}`} className="p-4 hover:bg-tint-3 transition-colors duration-120">
                <div className="flex gap-3">
                  {getFeaturedImage(property) ? (
                    <div className="w-20 h-20 rounded-[8px] bg-stripes overflow-hidden shrink-0">
                      <img src={getFeaturedImage(property)} alt={property.full_address || property.address} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-[8px] bg-stripes shrink-0 flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-mist" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-body line-clamp-2">{property.full_address || property.address || property.slug?.replace(/-/g, ' ') || 'N/A'}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="inline-flex px-2 py-0.5 rounded-pill font-mono text-[10px] font-semibold uppercase tracking-[0.05em] border border-ink bg-tint text-ink">
                        {property._source === 'manual' ? 'Manual' : 'DeelScout'}
                      </span>
                      {viewMode === 'active' && ['active', 'inactive'].includes((property.status || '').toLowerCase()) ? (
                        <ToggleSwitch
                          value={(property.status || '').toLowerCase() === 'active'}
                          onChange={(next) => handleToggleActive(property, next ? 'active' : 'inactive')}
                          disabled={statusUpdatingId === `${property._source}-${property.id}`}
                          label="Listing visible to buyers"
                          onLabel="Active"
                          offLabel="Inactive"
                          size="sm"
                        />
                      ) : (
                        <span className={`inline-flex px-2 py-0.5 rounded-pill font-mono text-[10px] font-semibold uppercase tracking-[0.05em] border ${getStatusColor(property.status)}`}>
                          {property.status === 'under_review' ? 'Under Review' : property.status === 'rejected' ? 'Update Required' : (property.status || 'draft')?.charAt(0).toUpperCase() + (property.status || '').slice(1) || 'Draft'}
                        </span>
                      )}
                      <AddonTags property={property} />
                    </div>
                    <p className="font-mono text-xs text-smoke-2 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-mist shrink-0" />
                      <span className="truncate">{property.city && property.state ? `${property.city}, ${property.state}` : property.address || 'N/A'}</span>
                    </p>
                    <p className="font-display text-[15px] font-bold text-body mt-0.5">
                      ${parseFloat(property.price || 0).toLocaleString()}
                      {property.property_type && <span className="font-mono text-muted font-normal text-xs ml-1">· {property.property_type}</span>}
                    </p>
                  </div>
                </div>
                {property._source === 'manual' && property.status === 'rejected' && property.rejection_reason && (
                  <div className="mb-3 px-3 py-2.5 bg-tint border-[1.5px] border-ink rounded-[10px]">
                    <p className="font-mono text-[10px] font-semibold text-ink uppercase tracking-[0.08em] mb-1">Issues to fix</p>
                    <p className="text-[11px] text-smoke-3 leading-relaxed">
                      {property.rejection_reason.length > 140 ? property.rejection_reason.slice(0, 140) + '…' : property.rejection_reason}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-around mt-3 pt-3 border-t border-hairline">
                  {viewMode === 'trash' ? (
                    <>
                      <button onClick={() => handleRestore(property)} className="flex-1 flex items-center justify-center h-9 rounded-[8px] text-muted hover:text-ink hover:bg-tint transition-colors duration-120" title="Restore">
                        <RotateCcw className="w-4 h-4" strokeWidth={2} />
                      </button>
                      {(workspaceRole === 'admin' || workspacePerms?.listings_delete) && (
                        <button onClick={() => handleDeleteClick(property)} className="flex-1 flex items-center justify-center h-9 rounded-[8px] text-muted hover:text-ink hover:bg-tint transition-colors duration-120" title="Delete Permanently">
                          <Trash2 className="w-4 h-4" strokeWidth={2} />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {(workspaceRole === 'admin' || workspacePerms?.listings_create) && property._source === 'manual' && property.status === 'draft' && (
                        <button
                          onClick={() => router.push(`/properties/new?draft_id=${property.id}`)}
                          className="flex-1 flex flex-col items-center gap-1 py-1 text-white bg-ink hover:bg-smoke-2 border border-ink rounded-[8px] transition-colors duration-120"
                        >
                          <span className="text-[10px] font-semibold">Complete</span>
                        </button>
                      )}
                      {(workspaceRole === 'admin' || workspacePerms?.listings_update) && property._source === 'manual' && property.status === 'rejected' && (
                        <button
                          onClick={() => router.push(`/properties/edit/${property.id}`)}
                          className="flex-1 flex flex-col items-center gap-1 py-1 text-ink bg-white hover:bg-tint border border-ink rounded-[8px] transition-colors duration-120"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="text-[10px] font-medium">Fix Issues</span>
                        </button>
                      )}
                      {workspaceRole === 'admin' && property._source === 'manual' && ['active', 'published'].includes((property.status || '').toLowerCase()) && (
                        <button onClick={() => router.push(`/properties/enhance?id=${property.id}`)} className="flex-1 flex items-center justify-center h-9 rounded-[8px] text-muted hover:text-ink hover:bg-tint transition-colors duration-120" title="Enhance listing">
                          <Zap className="w-4 h-4" strokeWidth={2} />
                        </button>
                      )}
                      <button onClick={() => router.push(`/properties/preview/${property.id}`)} className="flex-1 flex items-center justify-center h-9 rounded-[8px] text-muted hover:text-ink hover:bg-tint transition-colors duration-120" title="View">
                        <Eye className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <button onClick={() => { setPropertyForUTM({ ...property, slug: property.slug || property.id, id: property.id }); setShowUTMModal(true); }} className="flex-1 flex items-center justify-center h-9 rounded-[8px] text-muted hover:text-ink hover:bg-tint transition-colors duration-120" title="Share links">
                        <Link2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                      {(workspaceRole === 'admin' || workspacePerms?.listings_update) && property.status !== 'rejected' && property.status !== 'draft' && (
                        <button onClick={() => router.push(`/properties/edit/${property.id}`)} className="flex-1 flex items-center justify-center h-9 rounded-[8px] text-muted hover:text-ink hover:bg-tint transition-colors duration-120" title="Edit">
                          <Edit2 className="w-4 h-4" strokeWidth={2} />
                        </button>
                      )}
                      <button onClick={() => { setPropertyForAnalytics(property); setShowAnalyticsSidebar(true); }} className="flex-1 flex items-center justify-center h-9 rounded-[8px] text-muted hover:text-ink hover:bg-tint transition-colors duration-120" title="Analytics">
                        <BarChart2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                      {(workspaceRole === 'admin' || workspacePerms?.listings_delete) && (
                        <button onClick={() => handleArchiveClick(property)} className="flex-1 flex items-center justify-center h-9 rounded-[8px] text-muted hover:text-ink hover:bg-tint transition-colors duration-120" title="Move to Trash">
                          <Trash2 className="w-4 h-4" strokeWidth={2} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer - Pagination */}
        <div className="px-4 py-3 bg-tint-3 border-t-[1.5px] border-ink flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="font-mono text-xs text-muted">
            Showing <span className="font-semibold text-ink">{filteredProperties.length > 0 ? indexOfFirstEntry + 1 : 0}</span> to{' '}
            <span className="font-semibold text-ink">{Math.min(indexOfLastEntry, filteredProperties.length)}</span> of{' '}
            <span className="font-semibold text-ink">{filteredProperties.length}</span> entries
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-[8px] border-[1.5px] border-ink bg-white hover:bg-tint disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-120"
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
                    className={`min-w-[28px] h-7 px-2 font-mono text-xs font-semibold rounded-[8px] transition-colors duration-120 ${currentPage === pageNum
                      ? 'bg-ink text-white border-[1.5px] border-ink'
                      : 'border-[1.5px] border-ink bg-white text-ink hover:bg-tint'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-[8px] border-[1.5px] border-ink bg-white hover:bg-tint disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-120"
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
            <div className="fixed inset-0 bg-ink/40 transition-opacity" onClick={() => { if (!markingSold) { setShowMarkSoldModal(false); setPropertyToMarkSold(null) } }} aria-hidden="true" />
            <div className="relative bg-white rounded-[14px] border-[1.5px] border-ink shadow-offset-6 max-w-md w-full p-6 z-10">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-[10px] bg-tint border-[1.5px] border-ink flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-ink" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-[16.5px] font-semibold tracking-[-0.01em] text-body mb-1">Mark as sold?</h3>
                  <p className="text-[13px] text-muted">This listing will display a Sold badge. You can change it back from the edit page anytime.</p>
                </div>
              </div>
              <div className="py-2.5 px-3 mb-5 bg-tint-3 border border-hairline rounded-[10px]">
                <p className="text-[13px] text-body font-medium break-words">
                  {propertyToMarkSold.full_address || propertyToMarkSold.address || propertyToMarkSold.slug || 'this property'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setShowMarkSoldModal(false); setPropertyToMarkSold(null) }}
                  disabled={markingSold}
                  className="flex-1 h-10 px-4 text-[13px] font-semibold text-ink bg-white border-[1.5px] border-ink rounded-[10px] shadow-offset-3 hover:bg-tint transition-all duration-120 disabled:opacity-50"
                >Cancel</button>
                <button
                  type="button"
                  onClick={handleMarkSoldConfirm}
                  disabled={markingSold}
                  className="flex-1 h-10 px-4 text-[13px] font-semibold text-white bg-ink border-[1.5px] border-ink rounded-[10px] shadow-soft-3 hover:bg-smoke-2 transition-all duration-120 disabled:opacity-50"
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
