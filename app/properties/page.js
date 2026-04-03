"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, Building2, ChevronLeft, ChevronRight, MapPin, DollarSign, RotateCcw, BarChart2, Link2, Home, FileEdit } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import DeleteConfirmModal from '@/components/properties/DeleteConfirmModal';
import PropertyViewModal from '@/components/properties/PropertyViewModal';
import PropertyAnalyticsSidebar from '@/components/properties/PropertyAnalyticsSidebar';
import { UTMLinksModal } from '@/components/properties/UTMLinksModal';

const DEELMAP_VIEW_BASE_URL = process.env.NEXT_PUBLIC_DEELMAP_VIEW_BASE_URL || 'https://deelmap-production-16a1.up.railway.app';

const PropertiesManagement = () => {
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
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
  const [showUTMModal, setShowUTMModal] = useState(false);
  const [propertyForUTM, setPropertyForUTM] = useState(null);
  const [selectedPropertyRaw, setSelectedPropertyRaw] = useState(null); // raw property for UTM (slug/id)
  const searchParams = useSearchParams();
  const viewFromUrl = searchParams.get('view') === 'trash' ? 'trash' : 'active';
  const [viewMode, setViewMode] = useState(viewFromUrl); // 'active' or 'trash'

  // Keep viewMode in sync with URL (e.g. when opening "View Archived" from dashboard)
  useEffect(() => {
    setViewMode(viewFromUrl);
  }, [viewFromUrl]);

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchProperties();
    }
  }, [userId, viewMode]);

  const fetchProperties = async () => {
    try {
      setLoading(true);

      // Get seller's temp_seller_id (for scraped deals); use maybeSingle so we don't fail if no row
      const { data: sellerData } = await supabase
        .from('seller_applications')
        .select('temp_seller_id')
        .eq('id', userId)
        .maybeSingle();

      // 1) Manual listings: from properties table (seller_id = current seller)
      const { data: manualList, error: manualError } = await supabase
        .from('properties')
        .select('*')
        .eq('seller_id', userId)
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

  const handleArchiveConfirm = async () => {
    if (!selectedProperty) return;
    try {
      if (selectedProperty._source === 'manual') {
        const { error } = await supabase
          .from('properties')
          .update({ status: 'archived', property_status: 'unavailable' })
          .eq('id', selectedProperty.id)
          .eq('seller_id', userId);
        if (error) throw error;
      } else {
        const { data: sellerRow } = await supabase
          .from('seller_applications')
          .select('temp_seller_id')
          .eq('id', userId)
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
          .update({ status: 'draft', property_status: 'available' })
          .eq('id', property.id)
          .eq('seller_id', userId);
        if (error) throw error;
      } else {
        const { data: sellerRow } = await supabase
          .from('seller_applications')
          .select('temp_seller_id')
          .eq('id', userId)
          .maybeSingle();
        const tempSellerId = sellerRow?.temp_seller_id;
        if (!tempSellerId) {
          alert('Unable to verify ownership. Please try again.');
          return;
        }
        const { error } = await supabase
          .from('wholesale_deals')
          .update({ status: 'active' })
          .eq('id', property.id)
          .eq('temp_seller_id', tempSellerId);
        if (error) throw error;
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
          .eq('seller_id', userId);
        if (error) throw error;
      } else {
        const { data: sellerRow } = await supabase
          .from('seller_applications')
          .select('temp_seller_id')
          .eq('id', userId)
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

  const handleToggleActive = async (property) => {
    if (!property) return;
    const current = (property.status || 'active').toLowerCase();
    const nextStatus = current === 'inactive' ? 'active' : 'inactive';
    const isManual = property._source === 'manual';
    const nextPropertyStatus = nextStatus === 'inactive' ? 'unavailable' : 'available';

    try {
      setStatusUpdatingId(`${property._source}-${property.id}`);
      if (isManual) {
        const { error } = await supabase
          .from('properties')
          .update({ status: nextStatus, property_status: nextPropertyStatus })
          .eq('id', property.id)
          .eq('seller_id', userId);
        if (error) throw error;
      } else {
        const { data: sellerRow } = await supabase
          .from('seller_applications')
          .select('temp_seller_id')
          .eq('id', userId)
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

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'published':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'draft':
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'archived':
      case 'inactive':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
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
        return 'bg-gray-100 text-gray-700 border-gray-200';
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

  // Calculate stats (active = active or published)
  const totalProperties = properties.length;
  const activeProperties = properties.filter(p => (p.status || '') === 'active' || (p.status || '') === 'published').length;
  const draftProperties = properties.filter(p => (p.status || '') === 'draft').length;
  const availableProperties = properties.filter(p => (p.property_status || 'available').toLowerCase() === 'available').length;

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
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-gray-900 truncate">Properties</h1>
        </div>
        <div className="flex justify-center">
          <div className="flex items-center gap-0.5 p-1 rounded-xl bg-gray-100 border border-gray-200/80">
            <button
              onClick={() => setViewModeAndUrl('active')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                viewMode === 'active'
                  ? 'bg-white text-primary shadow-sm border border-gray-200/80'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setViewModeAndUrl('trash')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                viewMode === 'trash'
                  ? 'bg-white text-brandRed shadow-sm border border-gray-200/80'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
              }`}
            >
              Trash
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => router.push('/properties/new')}
            className="flex items-center gap-1.5 bg-[#D03839] hover:bg-[#E0493B] text-white px-3 py-2 rounded text-[13px] font-semibold transition-colors shrink-0"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Add Property</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
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
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-sm text-gray-600"><span className="font-semibold text-gray-900">{totalProperties}</span> {totalProperties === 1 ? 'listing' : 'listings'} in trash</p>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-card">
        {/* Controls — single row */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
              placeholder="Search by title or location..."
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-[#E8E8E4] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D03839]/20 focus:border-[#D03839] bg-white text-[#1A1816] shrink-0"
          >
            <option value="">Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="published">Published</option>
            <option value="incomplete">Incomplete</option>
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
          <select
            value={entriesPerPage}
            onChange={(e) => {
              setEntriesPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white text-gray-700 shrink-0"
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
          <button
            onClick={clearFilters}
            className="text-xs bg-[#FEF0EF] hover:bg-[#FEE4E3] text-[#D03839] rounded px-3 py-1.5 transition-colors font-medium shrink-0"
          >
            Clear
          </button>
        </div>

        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Property</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Property Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[240px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 w-6 bg-gray-100 rounded"></div></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-100 rounded"></div></td>
                    <td className="px-4 py-3"><div className="h-4 w-14 bg-gray-100 rounded"></div></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-100 rounded"></div></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-100 rounded"></div></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-100 rounded"></div></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-100 rounded"></div></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-100 rounded"></div></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-100 rounded ml-auto"></div></td>
                  </tr>
                ))
              ) : currentEntries.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-10 text-center">
                    <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm font-medium">
                      {viewMode === 'active' ? 'No properties found' : 'No properties in trash'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {viewMode === 'active' ? 'Try adjusting your search or add a new property' : 'Deleted properties will appear here'}
                    </p>
                  </td>
                </tr>
              ) : (
                currentEntries.map((property, index) => (
                  <tr key={`${property._source}-${property.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-400">{indexOfFirstEntry + index + 1}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getFeaturedImage(property) && (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                            <img src={getFeaturedImage(property)} alt={property.full_address || property.address} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium text-gray-900 line-clamp-1">{property.full_address || property.address || property.slug?.replace(/-/g, ' ') || 'N/A'}</p>
                          <p className="text-[10px] text-gray-400">ID: {String(property.id).split('-')[0]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${property._source === 'manual' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {property._source === 'manual' ? 'Manual' : 'DeelScout'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-700 line-clamp-1">{property.city && property.state ? `${property.city}, ${property.state}` : property.address || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-semibold text-gray-900">${parseFloat(property.price || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-700">{property.property_type || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(property.status)}`}>
                          {(property.status || 'draft')?.charAt(0).toUpperCase() + (property.status || '').slice(1) || 'Draft'}
                        </span>
                        {viewMode === 'active' && (property.status || '').toLowerCase() !== 'archived' && (
                          <button
                            type="button"
                            disabled={statusUpdatingId === `${property._source}-${property.id}`}
                            onClick={() => handleToggleActive(property)}
                            className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-colors ${
                              (property.status || 'active').toLowerCase() === 'inactive'
                                ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                                : 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {statusUpdatingId === `${property._source}-${property.id}` ? 'Saving...' : (property.status || 'active').toLowerCase() === 'inactive' ? 'Activate' : 'Deactivate'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getPropertyStatusColor(property.property_status)}`}>
                        {(property.property_status || 'available')?.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Available'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap min-w-[240px]">
                      <div className="flex items-center justify-end gap-0.5">
                        {viewMode === 'trash' ? (
                          <>
                            <button onClick={() => handleRestore(property)} className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 transition-colors" title="Restore">
                              <RotateCcw className="w-4 h-4" strokeWidth={2} />
                            </button>
                            <button onClick={() => handleDeleteClick(property)} className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete Permanently">
                              <Trash2 className="w-4 h-4" strokeWidth={2} />
                            </button>
                          </>
                        ) : (
                          <>
                            <a href={`${DEELMAP_VIEW_BASE_URL.replace(/\/$/, '')}/${property.slug || property.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 transition-colors" title="View on site">
                              <Eye className="w-4 h-4" strokeWidth={2} />
                            </a>
                            <button onClick={() => { setPropertyForUTM({ ...property, slug: property.slug || property.id, id: property.id }); setShowUTMModal(true); }} className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 transition-colors" title="Share links (UTM)">
                              <Link2 className="w-4 h-4" strokeWidth={2} />
                            </button>
                            <button onClick={() => router.push(`/properties/edit/${property.id}`)} className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 transition-colors" title="Edit">
                              <Edit2 className="w-4 h-4" strokeWidth={2} />
                            </button>
                            <button onClick={() => { setPropertyForAnalytics(property); setShowAnalyticsSidebar(true); }} className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 transition-colors" title="Analytics">
                              <BarChart2 className="w-4 h-4" strokeWidth={2} />
                            </button>
                            <button onClick={() => handleArchiveClick(property)} className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Move to Trash">
                              <Trash2 className="w-4 h-4" strokeWidth={2} />
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
        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded-xl bg-gray-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-gray-100 rounded" />
                    <div className="h-3 w-1/2 bg-gray-100 rounded" />
                    <div className="h-4 w-16 bg-gray-100 rounded" />
                  </div>
                </div>
              </div>
            ))
          ) : currentEntries.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm font-medium">
                {viewMode === 'active' ? 'No properties found' : 'No properties in trash'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {viewMode === 'active' ? 'Try adjusting your search or add a new property' : 'Deleted properties will appear here'}
              </p>
            </div>
          ) : (
            currentEntries.map((property, index) => (
              <div key={`${property._source}-${property.id}`} className="p-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex gap-3">
                  {getFeaturedImage(property) ? (
                    <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                      <img src={getFeaturedImage(property)} alt={property.full_address || property.address} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{property.full_address || property.address || property.slug?.replace(/-/g, ' ') || 'N/A'}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${property._source === 'manual' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {property._source === 'manual' ? 'Manual' : 'DeelScout'}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(property.status)}`}>
                        {(property.status || 'draft')?.charAt(0).toUpperCase() + (property.status || '').slice(1) || 'Draft'}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${getPropertyStatusColor(property.property_status)}`}>
                        {(property.property_status || 'available')?.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Available'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="truncate">{property.city && property.state ? `${property.city}, ${property.state}` : property.address || 'N/A'}</span>
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      ${parseFloat(property.price || 0).toLocaleString()}
                      {property.property_type && <span className="text-gray-500 font-normal text-xs ml-1">· {property.property_type}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
                  {viewMode === 'trash' ? (
                    <>
                      <button onClick={() => handleRestore(property)} className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-primary hover:bg-gray-100 transition-colors" title="Restore">
                        <RotateCcw className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <button onClick={() => handleDeleteClick(property)} className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete Permanently">
                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </>
                  ) : (
                    <>
                      <a href={`${DEELMAP_VIEW_BASE_URL.replace(/\/$/, '')}/${property.slug || property.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-primary hover:bg-gray-100 transition-colors" title="View on site">
                        <Eye className="w-4 h-4" strokeWidth={2} />
                      </a>
                      <button onClick={() => { setPropertyForUTM({ ...property, slug: property.slug || property.id, id: property.id }); setShowUTMModal(true); }} className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-primary hover:bg-gray-100 transition-colors" title="Share links">
                        <Link2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <button onClick={() => router.push(`/properties/edit/${property.id}`)} className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-primary hover:bg-gray-100 transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <button onClick={() => { setPropertyForAnalytics(property); setShowAnalyticsSidebar(true); }} className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-primary hover:bg-gray-100 transition-colors" title="Analytics">
                        <BarChart2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <button onClick={() => handleArchiveClick(property)} className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Move to Trash">
                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer - Pagination */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs text-gray-500">
            Showing <span className="font-medium text-gray-700">{filteredProperties.length > 0 ? indexOfFirstEntry + 1 : 0}</span> to{' '}
            <span className="font-medium text-gray-700">{Math.min(indexOfLastEntry, filteredProperties.length)}</span> of{' '}
            <span className="font-medium text-gray-700">{filteredProperties.length}</span> entries
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                    className={`min-w-[28px] h-7 px-2 text-xs font-medium rounded-lg transition-colors ${currentPage === pageNum
                      ? 'bg-primary text-white'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
