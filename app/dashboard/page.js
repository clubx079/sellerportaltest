"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { getCurrentCurrencySymbol } from '@/lib/currency';
import {
  Calendar,
  Building2,
  TrendingUp,
  Home,
  CircleDollarSign,
  PlusCircle,
  List,
  Archive,
  FileEdit,
  Sparkles
} from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [stats, setStats] = useState({
    totalProperties: 0,
    activeProperties: 0,
    trashProperties: 0,
    totalValue: 0,
    soldProperties: 0,
    totalRevenue: 0,
    underContractProperties: 0,
    availableProperties: 0,
    averagePrice: 0,
    totalBedrooms: 0,
    totalBathrooms: 0,
    recentlyAdded: 0
  });
  const [recentProperties, setRecentProperties] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }

    setCurrency(getCurrentCurrencySymbol());

    fetchDashboardData();
  }, [dateRange.from, dateRange.to]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const userStr = localStorage.getItem('seller_user');
      if (!userStr) {
        setLoading(false);
        return;
      }
      const currentUser = JSON.parse(userStr);
      const currentUserId = currentUser.id;

      const { data: sellerData } = await supabase
        .from('seller_applications')
        .select('temp_seller_id')
        .eq('id', currentUserId)
        .maybeSingle();

      const tempSellerId = sellerData?.temp_seller_id ?? null;

      // 1) Manual properties (properties table)
      const { data: manualList = [] } = await supabase
        .from('properties')
        .select('*')
        .eq('seller_id', currentUserId)
        .order('created_at', { ascending: false });

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
          _source: 'manual',
          property_photos: (imagesByProperty[p.id] || []).map(img => ({
            photo_url: img.image_url,
            display_order: img.sort_order,
            is_featured: false
          })).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        }));
      } else {
        manualWithImages = (manualList || []).map(p => ({ ...p, _source: 'manual', property_photos: [] }));
      }

      // 2) Scraped deals (wholesale_deals)
      let scrapedList = [];
      if (tempSellerId) {
        const { data: wholesaleList, error: wholesaleError } = await supabase
          .from('wholesale_deals')
          .select(`
            *,
            property_photos (id, photo_url, display_order, is_featured)
          `)
          .eq('temp_seller_id', tempSellerId)
          .order('created_at', { ascending: false });
        if (!wholesaleError && wholesaleList) {
          scrapedList = wholesaleList.map(p => ({ ...p, _source: 'scraped' }));
        }
      }

      // Normalize status: manual uses 'published', scraped uses 'active'
      const normalizeStatus = (p) => {
        const s = (p.status || '').toLowerCase();
        if (s === 'archived') return 'archived';
        if (s === 'published' || s === 'active') return 'active';
        return 'draft';
      };

      const combined = [
        ...manualWithImages.map(p => ({
          ...p,
          _normalizedStatus: normalizeStatus(p),
          property_status: p.property_status || 'available'
        })),
        ...scrapedList.map(p => ({
          ...p,
          _normalizedStatus: normalizeStatus(p),
          property_status: p.property_status || (p.status === 'active' ? 'available' : 'available')
        }))
      ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      let allProperties = combined;
      if (dateRange.from && dateRange.to) {
        const fromStart = new Date(dateRange.from);
        fromStart.setHours(0, 0, 0, 0);
        const toEnd = new Date(dateRange.to);
        toEnd.setHours(23, 59, 59, 999);
        allProperties = combined.filter(p => {
          const created = new Date(p.created_at);
          return created >= fromStart && created <= toEnd;
        });
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const activeList = allProperties.filter(p => p._normalizedStatus !== 'archived');
      const trashList = allProperties.filter(p => p._normalizedStatus === 'archived');
      const soldList = allProperties.filter(p => (p.property_status || '').toLowerCase() === 'sold');

      const totalValue = activeList.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);
      const totalRevenue = soldList.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);
      const availableCount = activeList.filter(p => (p.property_status || '').toLowerCase() === 'available').length;
      const underContractCount = activeList.filter(p => (p.property_status || '').toLowerCase() === 'under_contract').length;
      const pendingCount = activeList.filter(p => (p.property_status || '').toLowerCase() === 'pending').length;
      const activeCount = activeList.length;
      const avgPrice = activeList.filter(p => p.price).length > 0
        ? totalValue / activeList.filter(p => p.price).length
        : 0;
      const totalBeds = activeList.reduce((sum, p) => sum + (parseInt(p.bedrooms) || 0), 0);
      const totalBaths = activeList.reduce((sum, p) => sum + (parseFloat(p.bathrooms) || 0), 0);
      const recentCount = allProperties.filter(p => new Date(p.created_at) >= sevenDaysAgo).length;

      setStats({
        totalProperties: combined.length,
        activeProperties: activeCount,
        trashProperties: trashList.length,
        totalValue,
        soldProperties: soldList.length,
        totalRevenue,
        underContractProperties: underContractCount,
        availableProperties: availableCount,
        averagePrice: avgPrice,
        totalBedrooms: totalBeds,
        totalBathrooms: totalBaths,
        recentlyAdded: recentCount
      });

      setRecentProperties(combined.slice(0, 5));

      const activities = combined.slice(0, 6).map(property => {
        const createdAt = new Date(property.created_at);
        const now = new Date();
        const diffMs = now - createdAt;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        let timeAgo;
        if (diffDays > 0) timeAgo = `${diffDays}d ago`;
        else if (diffHours > 0) timeAgo = `${diffHours}h ago`;
        else timeAgo = `${diffMins}m ago`;
        const title = property.slug?.replace(/-/g, ' ').replace(/\d+$/, '').trim()
          || property.full_address || property.address || 'Property';
        return {
          id: property.id,
          type: property._normalizedStatus === 'active' ? 'published' : 'draft',
          title,
          address: property.full_address || property.address || 'No address',
          price: `${currency}${parseFloat(property.price || 0).toLocaleString()}`,
          time: timeAgo
        };
      });
      setRecentActivities(activities);

      const statusData = [
        { name: 'Available', count: availableCount, color: 'bg-green-500' },
        { name: 'Sold Out', count: soldList.length, color: 'bg-pink-500' },
        { name: 'Pending', count: pendingCount, color: 'bg-blue-500' },
        { name: 'Under Contract', count: underContractCount, color: 'bg-purple-500' }
      ];
      const totalActive = availableCount + soldList.length + underContractCount + pendingCount;
      setStatusBreakdown(statusData.map(item => ({
        ...item,
        percentage: totalActive > 0 ? Math.round((item.count / totalActive) * 100) : 0
      })));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };


  const firstName = (() => {
    const raw = user?.contactPersonName || user?.contact_person_name || user?.full_name || user?.name || '';
    const first = raw.trim().split(/\s+/)[0];
    return first || 'Seller';
  })();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
        {/* Welcome hero – gradient card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-[#033d5c] text-white shadow-lg"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12)_0%,transparent_50%)]" aria-hidden />
          <div className="relative px-5 py-6 sm:px-8 sm:py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-white/80 uppercase tracking-wider">{getGreeting()}</p>
              <h1 className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">
                Welcome back, {firstName}
              </h1>
              <p className="text-sm text-white/90 mt-2 max-w-md">
                Here&apos;s an overview of your property portfolio. Add listings, track performance, and manage deals in one place.
              </p>
              <Link
                href="/properties/new"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 bg-white text-primary font-semibold rounded-lg hover:bg-white/95 transition-all shadow-md hover:shadow-lg"
              >
                <PlusCircle className="w-5 h-5" />
                Add property
              </Link>
            </div>
            {!loading && stats.totalProperties > 0 && (
              <div className="flex items-center gap-4 sm:gap-6 text-white/95">
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold tabular-nums">{stats.activeProperties}</p>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/70">Active</p>
                </div>
                <div className="w-px h-12 bg-white/30" />
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold tabular-nums">{currency}{(stats.totalValue || 0).toLocaleString()}</p>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/70">Portfolio value</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Date filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-gray-500">
            {loading ? 'Loading…' : `Showing ${dateRange.from && dateRange.to ? 'filtered' : 'all'} data${stats.recentlyAdded > 0 ? ` · ${stats.recentlyAdded} added in last 7 days` : ''}`}
          </p>
          <div className="flex items-center gap-2">
            {[
              { label: 'All', from: null, to: null },
              { label: 'Last 7 days', from: (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })(), to: new Date().toISOString().slice(0, 10) },
              { label: 'Last 30 days', from: (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })(), to: new Date().toISOString().slice(0, 10) }
            ].map((preset) => {
              const active = !dateRange.from && !dateRange.to && !preset.from
                || (dateRange.from === preset.from && dateRange.to === preset.to);
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => { setDateRange({ from: preset.from, to: preset.to }); setShowDatePicker(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {preset.label}
                </button>
              );
            })}
            <div className="relative">
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-medium text-gray-700">
                {dateRange.from && dateRange.to
                  ? `${new Date(dateRange.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(dateRange.to).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : 'Select Dates'}
              </span>
            </button>
            {showDatePicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDatePicker(false)} aria-hidden="true" />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg border border-gray-200 shadow-lg p-4 min-w-[260px]">
                  <p className="text-xs font-medium text-gray-600 mb-3">Filter dashboard by date range</p>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">From</label>
                      <input
                        type="date"
                        value={dateRange.from || ''}
                        onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value || null }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">To</label>
                      <input
                        type="date"
                        value={dateRange.to || ''}
                        onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value || null }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => { setDateRange({ from: null, to: null }); setShowDatePicker(false); }}
                      className="flex-1 px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(false)}
                      className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </>
            )}
            </div>
          </div>
        </div>

        {/* KPI cards row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Total portfolio value', value: `${currency}${(stats.totalValue || 0).toLocaleString()}`, icon: CircleDollarSign, color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200', iconBg: 'bg-emerald-500/20' },
            { label: 'Active listings', value: stats.activeProperties, icon: Home, color: 'bg-primary/10 text-[#022b41] border-primary/20', iconBg: 'bg-primary/20' },
            { label: 'Sold', value: stats.soldProperties, icon: TrendingUp, color: 'bg-rose-500/10 text-rose-700 border-rose-200', iconBg: 'bg-rose-500/20' },
            { label: 'Total revenue', value: `${currency}${(stats.totalRevenue || 0).toLocaleString()}`, icon: Sparkles, color: 'bg-amber-500/10 text-amber-800 border-amber-200', iconBg: 'bg-amber-500/20' }
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
              whileHover={{ y: -2 }}
              className={`rounded-xl border p-4 sm:p-5 ${item.color} hover:shadow-lg transition-shadow duration-200 cursor-default`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium opacity-90 uppercase tracking-wider truncate">{item.label}</p>
                  {loading ? (
                    <div className="h-8 w-20 bg-white/50 rounded mt-2 animate-pulse" />
                  ) : (
                    <p className="text-lg sm:text-xl font-bold mt-1 tabular-nums truncate" title={typeof item.value === 'string' ? item.value : String(item.value)}>
                      {item.value}
                    </p>
                  )}
                </div>
                <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${item.iconBg}`}>
                  <item.icon className="w-5 h-5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Merged hero stats — Portfolio + Value in one enhanced card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden border-l-4 border-l-primary hover:shadow-md transition-shadow duration-200"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
            {/* Left: Headline + strong value */}
            <div className="p-6 md:p-8 bg-gradient-to-r from-primary/[0.04] to-transparent">
              {loading ? (
                <div className="space-y-3 mt-3">
                  <div className="h-5 w-44 bg-gray-100 rounded animate-pulse" />
                  <div className="h-12 w-56 bg-gray-100 rounded-xl animate-pulse" />
                  <div className="h-4 w-52 bg-gray-50 rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <h2 className="mt-2 text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">Total Properties value</h2>
                  <p
                    className="mt-2 text-4xl md:text-5xl font-bold text-emerald-700 tabular-nums leading-tight"
                    title={`${currency}${stats.totalValue.toLocaleString()}`}
                  >
                    {currency}{stats.totalValue.toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">Live value across active seller listings</p>
                </>
              )}
            </div>

            {/* Right: clean stat rows (no boxes) */}
            <div className="p-6 md:p-8 border-t lg:border-t-0 lg:border-l border-gray-100 bg-white">
              {loading ? (
                <div className="space-y-4">
                  <div className="h-10 bg-gray-50 rounded animate-pulse" />
                  <div className="h-10 bg-gray-50 rounded animate-pulse" />
                  <div className="h-10 bg-gray-50 rounded animate-pulse" />
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-600">Total properties</span>
                    <span className="text-2xl font-semibold text-gray-900 tabular-nums">{stats.totalProperties}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-600">Active</span>
                    <span className="text-2xl font-semibold text-primary tabular-nums">{stats.activeProperties}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-600">Sold</span>
                    <span className="text-2xl font-semibold text-rose-600 tabular-nums">{stats.soldProperties}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-600">Total revenue</span>
                    <span
                      className="text-2xl font-semibold text-emerald-700 tabular-nums"
                      title={`${currency}${stats.totalRevenue.toLocaleString()}`}
                    >
                      {currency}{stats.totalRevenue.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recent Properties */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 bg-white rounded-xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300/80 transition-all duration-200"
          >
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50/80 to-white">
              <h2 className="text-sm font-semibold text-gray-900">Recent Properties</h2>
              <Link
                href="/properties"
                className="text-sm text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 transition-colors"
              >
                View All <span aria-hidden>→</span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Property</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Prop. Status</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><div className="h-3 w-28 bg-gray-100 rounded"></div></td>
                        <td className="px-4 py-3"><div className="h-3 w-16 bg-gray-100 rounded"></div></td>
                        <td className="px-4 py-3"><div className="h-3 w-14 bg-gray-100 rounded"></div></td>
                        <td className="px-4 py-3"><div className="h-3 w-16 bg-gray-100 rounded"></div></td>
                        <td className="px-4 py-3"><div className="h-3 w-14 bg-gray-100 rounded ml-auto"></div></td>
                      </tr>
                    ))
                  ) : recentProperties.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-gray-400" />
                          </div>
                          <p className="text-sm font-medium text-gray-700">No properties yet</p>
                          <p className="text-xs text-gray-500 max-w-xs">Add your first listing to see it here and start reaching buyers.</p>
                          <Link href="/properties/new" className="inline-flex items-center gap-1.5 mt-1 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
                            <PlusCircle className="w-4 h-4" /> Add property
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recentProperties.map((property) => {
                      const featuredImage = property.property_photos?.find(p => p.is_featured);
                      const sortedImages = [...(property.property_photos || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
                      const firstImage = featuredImage?.photo_url || sortedImages?.[0]?.photo_url;
                      const propertyType = property.property_type || 'Property';
                      const displayAddress = property.full_address || property.address || 'Property';
                      const statusLabel = property._normalizedStatus === 'active' ? 'Active' : property._normalizedStatus === 'archived' ? 'Archived' : 'Draft';

                      return (
                        <tr key={property.id} className="hover:bg-gray-50/80 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {firstImage ? (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                                  <img src={firstImage} alt="" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                                  <Building2 className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <Link href={`/properties/edit/${property.id}`} className="block group-hover:text-primary transition-colors">
                                  <p className="text-xs font-medium text-gray-900 truncate max-w-[180px] group-hover:text-primary transition-colors">{displayAddress}</p>
                                  <p className="text-xs text-gray-500 truncate max-w-[180px]">
                                    {property.city && property.state ? `${property.city}, ${property.state}` : (property.address || displayAddress)?.split(',')[0] || '—'}
                                  </p>
                                </Link>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700">{propertyType}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                              property._normalizedStatus === 'active'
                                ? 'bg-status-availableLight text-green-700'
                                : property._normalizedStatus === 'archived'
                                ? 'bg-gray-200 text-gray-700'
                                : 'bg-status-draftLight text-yellow-700'
                            }`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                              (property.property_status || '').toLowerCase() === 'available'
                                ? 'bg-status-availableLight text-green-700'
                                : (property.property_status || '').toLowerCase() === 'sold'
                                ? 'bg-status-soldLight text-red-700'
                                : (property.property_status || '').toLowerCase() === 'under_contract'
                                ? 'bg-status-contractLight text-purple-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {(property.property_status || 'Available').replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-gray-900 text-right tabular-nums">
                            {currency}{parseFloat(property.price || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Recent Activities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-white rounded-xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50">
              <h2 className="text-sm font-semibold text-gray-900">Recent Activities</h2>
            </div>

            <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto scrollbar-hide">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 w-24 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))
              ) : recentActivities.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                    <FileEdit className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">No recent activities</p>
                  <p className="text-xs text-gray-500 mt-1">When you add or edit properties, they’ll show up here.</p>
                </div>
              ) : (
                recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50/80 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {activity.type === 'published' ? 'Added a new property' : 'Edited a property'}{' '}
                        <Link href={`/properties/edit/${activity.id}`} className="text-primary hover:underline">
                          {activity.title}
                        </Link>
                      </p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-200">
              <Link
                href="/settings?tab=activities"
                className="block text-center text-sm text-gray-600 hover:text-primary transition-colors font-medium"
              >
                View All →
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Bottom Grid - Three Equal Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Property Status Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl border border-gray-200/80 overflow-hidden shadow-sm"
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Property status</h2>
              <p className="text-xs text-gray-500 mt-0.5">By listing status</p>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="w-44 h-44 bg-gray-100 rounded-full animate-pulse"></div>
                  </div>
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-3 w-20 bg-gray-200 rounded mb-2"></div>
                        <div className="h-2 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : statusBreakdown.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No properties to display</p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Donut chart — larger, prettier ring + big center total */}
                  <div className="flex-shrink-0">
                    <div className="relative w-44 h-44">
                      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                        <defs>
                          <filter id="donut-shadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.08" />
                          </filter>
                        </defs>
                        <g transform="rotate(-90 50 50)" filter="url(#donut-shadow)">
                          {(() => {
                            const colors = {
                              Available: '#10B981',
                              'Sold Out': '#DC2626',
                              Pending: '#3B82F6',
                              'Under Contract': '#8B5CF6'
                            };
                            const R = 40;
                            const r = 24;
                            const cx = 50;
                            const cy = 50;
                            const segments = statusBreakdown.filter((item) => (item.percentage || 0) > 0);
                            let currentAngle = 0;
                            return segments.map((item) => {
                              let pct = item.percentage || 0;
                              let angle = (pct / 100) * 360;
                              if (angle >= 360) angle = 360;
                              if (angle <= 0) return null;
                              const startAngle = currentAngle;
                              currentAngle += angle;
                              const startRad = (startAngle * Math.PI) / 180;
                              const endRad = (currentAngle * Math.PI) / 180;
                              let d;
                              if (angle >= 359.9) {
                                d = [
                                  `M ${cx + R} ${cy}`,
                                  `A ${R} ${R} 0 0 1 ${cx - R} ${cy}`,
                                  `A ${R} ${R} 0 0 1 ${cx + R} ${cy}`,
                                  `L ${cx + r} ${cy}`,
                                  `A ${r} ${r} 0 0 0 ${cx - r} ${cy}`,
                                  `A ${r} ${r} 0 0 0 ${cx + r} ${cy}`,
                                  'Z'
                                ].join(' ');
                              } else {
                                const x1 = cx + R * Math.cos(startRad);
                                const y1 = cy + R * Math.sin(startRad);
                                const x2 = cx + R * Math.cos(endRad);
                                const y2 = cy + R * Math.sin(endRad);
                                const x3 = cx + r * Math.cos(endRad);
                                const y3 = cy + r * Math.sin(endRad);
                                const x4 = cx + r * Math.cos(startRad);
                                const y4 = cy + r * Math.sin(startRad);
                                const largeArc = angle > 180 ? 1 : 0;
                                d = [
                                  `M ${x1} ${y1}`,
                                  `A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`,
                                  `L ${x3} ${y3}`,
                                  `A ${r} ${r} 0 ${largeArc} 0 ${x4} ${y4}`,
                                  'Z'
                                ].join(' ');
                              }
                              return (
                                <path
                                  key={item.name}
                                  d={d}
                                  fill={colors[item.name] || '#E5E7EB'}
                                  stroke="white"
                                  strokeWidth="1.2"
                                  className="transition-opacity hover:opacity-95"
                                />
                              );
                            });
                          })()}
                        </g>
                        <circle cx="50" cy="50" r="20" fill="white" />
                        <text x="50" y="48" textAnchor="middle" fontSize="14" fontWeight="700" className="fill-gray-900" fontFamily="system-ui, sans-serif">{stats.activeProperties}</text>
                        <text x="50" y="58" textAnchor="middle" fontSize="6" fontWeight="500" className="fill-gray-500" fontFamily="system-ui, sans-serif">total</text>
                      </svg>
                    </div>
                  </div>

                  {/* Legend — numeric value only, no percentage */}
                  <div className="space-y-2 flex-1 min-w-0">
                    {statusBreakdown.map((item) => {
                      const dotColors = {
                        Available: 'bg-emerald-500',
                        'Sold Out': 'bg-red-500',
                        Pending: 'bg-blue-500',
                        'Under Contract': 'bg-violet-500'
                      };
                      const dotColor = dotColors[item.name] || 'bg-gray-400';
                      return (
                        <div key={item.name} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                          <div className="flex items-center gap-2.5">
                            <span className={`flex h-3.5 w-3.5 rounded-full shrink-0 ${dotColor} ring-2 ring-white shadow-sm`} aria-hidden />
                            <span className="text-sm font-medium text-gray-700">{item.name}</span>
                          </div>
                          <span className="text-base font-bold text-gray-900 tabular-nums">{item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Property Summary — colors by value type */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-white rounded-xl border border-gray-200/80 overflow-hidden shadow-sm"
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Property Summary</h2>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200/80 bg-gray-50/50 px-4 py-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total</span>
                <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{stats.totalProperties}</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <span className="text-xs font-medium text-primary/80 uppercase tracking-wider">Active</span>
                <p className="text-2xl font-bold text-primary mt-1 tabular-nums">{stats.activeProperties}</p>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3">
                <span className="text-xs font-medium text-amber-700/90 uppercase tracking-wider">In trash</span>
                <p className="text-2xl font-bold text-amber-800 mt-1 tabular-nums">{stats.trashProperties}</p>
              </div>
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3">
                <span className="text-xs font-medium text-emerald-700/90 uppercase tracking-wider">Total value</span>
                <p className="text-xl font-bold text-emerald-800 mt-1 tabular-nums truncate" title={`${currency}${stats.totalValue.toLocaleString()}`}>
                  {currency}{stats.totalValue.toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white">
              <h2 className="text-sm font-semibold text-gray-900">Quick Actions</h2>
              <p className="text-xs text-gray-500 mt-0.5">Shortcuts to manage your portfolio</p>
            </div>

            <div className="p-4 space-y-2.5">
              <Link
                href="/properties/new"
                className="flex items-center justify-center gap-2 p-3.5 bg-primary text-white hover:bg-primary/90 rounded-xl transition-all text-sm font-semibold shadow-sm hover:shadow"
              >
                <PlusCircle className="w-5 h-5" />
                Add New Property
              </Link>

              <Link
                href="/properties"
                className="flex items-center justify-center gap-2 p-3 border border-gray-200 hover:border-primary/30 hover:bg-primary/5 rounded-xl transition-all text-sm font-medium text-gray-700"
              >
                <List className="w-5 h-5 text-gray-500" />
                Manage Properties
              </Link>

              <Link
                href="/properties?view=trash"
                className="flex items-center justify-center gap-2 p-3 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl transition-all text-sm font-medium text-gray-700"
              >
                <Archive className="w-5 h-5 text-gray-500" />
                View Archived
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
  );
}
