"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import Link from "next/link";
import { getCurrentCurrencySymbol } from "@/lib/currency";
import {
  Building2,
  PlusCircle,
  List,
  Archive,
  ArrowRight,
  ChevronRight,
  MessageCircle,
  Eye,
  Home,
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

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
    recentlyAdded: 0,
    totalViews: 0,
    totalInquiries: 0,
  });
  const [recentProperties, setRecentProperties] = useState([]);
  const [recentQueries, setRecentQueries] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [currency, setCurrency] = useState("$");
  const [trends, setTrends] = useState({
    activeListings: null,
    views: null,
    inquiries: null,
    portfolioValue: null,
  });

  useEffect(() => {
    const userStr = localStorage.getItem("seller_user");
    if (userStr) setUser(JSON.parse(userStr));
    setCurrency(getCurrentCurrencySymbol());
    fetchDashboardData();
  }, [dateRange.from, dateRange.to]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const userStr = localStorage.getItem("seller_user");
      if (!userStr) {
        setLoading(false);
        return;
      }
      const currentUser = JSON.parse(userStr);
      const currentUserId = currentUser.id;

      const { data: sellerData } = await supabase
        .from("seller_applications")
        .select("temp_seller_id")
        .eq("id", currentUserId)
        .maybeSingle();
      const tempSellerId = sellerData?.temp_seller_id ?? null;

      const { data: manualList = [] } = await supabase
        .from("properties")
        .select("*")
        .eq("seller_id", currentUserId)
        .order("created_at", { ascending: false });

      let manualWithImages = manualList || [];
      if (manualWithImages.length > 0) {
        const ids = manualWithImages.map((p) => p.id);
        const { data: imagesData } = await supabase
          .from("property_images")
          .select("id, image_url, sort_order, property_id")
          .in("property_id", ids)
          .order("sort_order");
        const imagesByProperty = {};
        (imagesData || []).forEach((img) => {
          if (!imagesByProperty[img.property_id]) imagesByProperty[img.property_id] = [];
          imagesByProperty[img.property_id].push(img);
        });
        manualWithImages = manualWithImages.map((p) => ({
          ...p,
          _source: "manual",
          property_photos: (imagesByProperty[p.id] || [])
            .map((img) => ({
              photo_url: img.image_url,
              display_order: img.sort_order,
              is_featured: false,
            }))
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
        }));
      } else {
        manualWithImages = (manualList || []).map((p) => ({ ...p, _source: "manual", property_photos: [] }));
      }

      let scrapedList = [];
      if (tempSellerId) {
        const { data: wholesaleList, error: wholesaleError } = await supabase
          .from("wholesale_deals")
          .select(
            `*,
            property_photos (id, photo_url, display_order, is_featured)`
          )
          .eq("temp_seller_id", tempSellerId)
          .order("created_at", { ascending: false });
        if (!wholesaleError && wholesaleList) {
          scrapedList = wholesaleList.map((p) => ({ ...p, _source: "scraped" }));
        }
      }

      const normalizeStatus = (p) => {
        const s = (p.status || "").toLowerCase();
        if (s === "archived") return "archived";
        if (s === "published" || s === "active") return "active";
        return "draft";
      };

      const combined = [
        ...manualWithImages.map((p) => ({
          ...p,
          _normalizedStatus: normalizeStatus(p),
          property_status: p.property_status || "available",
        })),
        ...scrapedList.map((p) => ({
          ...p,
          _normalizedStatus: normalizeStatus(p),
          property_status: p.property_status || (p.status === "active" ? "available" : "available"),
        })),
      ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      let allProperties = combined;
      if (dateRange.from && dateRange.to) {
        const fromStart = new Date(dateRange.from);
        fromStart.setHours(0, 0, 0, 0);
        const toEnd = new Date(dateRange.to);
        toEnd.setHours(23, 59, 59, 999);
        allProperties = combined.filter((p) => {
          const created = new Date(p.created_at);
          return created >= fromStart && created <= toEnd;
        });
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const activeList = allProperties.filter((p) => p._normalizedStatus !== "archived");
      const trashList = allProperties.filter((p) => p._normalizedStatus === "archived");
      const soldList = allProperties.filter((p) => (p.property_status || "").toLowerCase() === "sold");

      const totalValue = activeList.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);
      const totalRevenue = soldList.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);
      const availableCount = activeList.filter((p) => (p.property_status || "").toLowerCase() === "available").length;
      const underContractCount = activeList.filter(
        (p) => (p.property_status || "").toLowerCase() === "under_contract"
      ).length;
      const pendingCount = activeList.filter((p) => (p.property_status || "").toLowerCase() === "pending").length;
      const activeCount = activeList.length;
      const recentCount = allProperties.filter((p) => new Date(p.created_at) >= sevenDaysAgo).length;

      // Total views and period-over-period for trend
      let totalViews = 0;
      let viewsLast30Days = 0;
      let viewsPrevious30Days = 0;
      try {
        const res = await fetch(`/api/seller/dashboard-stats?userId=${encodeURIComponent(currentUserId)}`);
        const data = await res.json();
        totalViews = Number(data.totalViews) || 0;
        viewsLast30Days = Number(data.viewsLast30Days) || 0;
        viewsPrevious30Days = Number(data.viewsPrevious30Days) || 0;
      } catch (_) {}

      // Conversations = inquiries; keep full list for count and period trend
      let totalInquiries = 0;
      let inquiriesLast30Days = 0;
      let inquiriesPrevious30Days = 0;
      try {
        const res = await fetch("/api/seller/chat?action=get_conversations", {
          headers: { Authorization: `Bearer ${currentUserId}` },
        });
        const data = await res.json();
        const conversations = data.conversations || [];
        totalInquiries = conversations.length;
        setRecentQueries(conversations.slice(0, 6));
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
        conversations.forEach((c) => {
          const t = c.created_at ? new Date(c.created_at).getTime() : 0;
          if (t >= now - thirtyDaysMs) inquiriesLast30Days += 1;
          else if (t >= now - sixtyDaysMs && t < now - thirtyDaysMs) inquiriesPrevious30Days += 1;
        });
      } catch (_) {
        setRecentQueries([]);
      }

      // Previous stats from last visit (for active listings & portfolio value trend)
      const storageKey = "seller_dashboard_prev_stats";
      let prevActive = 0;
      let prevValue = 0;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const prev = JSON.parse(raw);
          prevActive = Number(prev.activeProperties) || 0;
          prevValue = Number(prev.totalValue) || 0;
        }
      } catch (_) {}
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            activeProperties: activeCount,
            totalValue,
            totalViews,
            totalInquiries,
          })
        );
      } catch (_) {}

      // Compute trend percentages
      const viewPct =
        viewsPrevious30Days > 0
          ? Math.round(((viewsLast30Days - viewsPrevious30Days) / viewsPrevious30Days) * 100)
          : viewsLast30Days > 0
          ? 100
          : null;
      const inquiryPct =
        inquiriesPrevious30Days > 0
          ? Math.round(((inquiriesLast30Days - inquiriesPrevious30Days) / inquiriesPrevious30Days) * 100)
          : inquiriesLast30Days > 0
          ? 100
          : null;
      const activePct = prevActive > 0 ? Math.round(((activeCount - prevActive) / prevActive) * 100) : null;
      const valuePct = prevValue > 0 ? Math.round(((totalValue - prevValue) / prevValue) * 100) : null;

      setTrends({
        activeListings: activePct != null ? { pct: Math.abs(activePct), isUp: activePct >= 0 } : null,
        views: viewPct != null ? { pct: Math.abs(viewPct), isUp: viewPct >= 0 } : null,
        inquiries: inquiryPct != null ? { pct: Math.abs(inquiryPct), isUp: inquiryPct >= 0 } : null,
        portfolioValue: valuePct != null ? { pct: Math.abs(valuePct), isUp: valuePct >= 0 } : null,
      });

      setStats({
        totalProperties: combined.length,
        activeProperties: activeCount,
        trashProperties: trashList.length,
        totalValue,
        soldProperties: soldList.length,
        totalRevenue,
        underContractProperties: underContractCount,
        availableProperties: availableCount,
        averagePrice:
          activeList.filter((p) => p.price).length > 0
            ? totalValue / activeList.filter((p) => p.price).length
            : 0,
        totalBedrooms: activeList.reduce((sum, p) => sum + (parseInt(p.bedrooms) || 0), 0),
        totalBathrooms: activeList.reduce((sum, p) => sum + (parseFloat(p.bathrooms) || 0), 0),
        recentlyAdded: recentCount,
        totalViews,
        totalInquiries,
      });

      setRecentProperties(combined.slice(0, 5));

      const statusData = [
        { name: "Available", count: availableCount, color: "bg-status-available" },
        { name: "Sold Out", count: soldList.length, color: "bg-status-sold" },
        { name: "Pending", count: pendingCount, color: "bg-status-pending" },
        { name: "Under Contract", count: underContractCount, color: "bg-status-contract" },
      ];
      const totalActive = availableCount + soldList.length + underContractCount + pendingCount;
      setStatusBreakdown(
        statusData.map((item) => ({
          ...item,
          percentage: totalActive > 0 ? Math.round((item.count / totalActive) * 100) : 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const firstName = (() => {
    const raw = user?.contactPersonName || user?.contact_person_name || user?.full_name || user?.name || "";
    return raw.trim().split(/\s+/)[0] || "Seller";
  })();

  const formatDateRangeLabel = (from, to) => {
    if (!from || !to) return "Custom dates";
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const opts = { month: "short", day: "numeric" };
    const sameYear = fromDate.getFullYear() === toDate.getFullYear();
    const fromStr = fromDate.toLocaleDateString("en-US", opts);
    const toStr = toDate.toLocaleDateString("en-US", sameYear ? opts : { ...opts, year: "numeric" });
    return `${fromStr} – ${toStr}`;
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return "Just now";
  };

  const presets = [
    { label: "All", from: null, to: null },
    {
      label: "7 days",
      from: (() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().slice(0, 10);
      })(),
      to: new Date().toISOString().slice(0, 10),
    },
    {
      label: "30 days",
      from: (() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().slice(0, 10);
      })(),
      to: new Date().toISOString().slice(0, 10),
    },
  ];

  const kpiCards = [
    { label: "Active listings", value: stats.activeProperties, sub: "live now", icon: Home, color: "bg-white border-slate-200 text-slate-900", trendKey: "activeListings" },
    { label: "Property views", value: stats.totalViews, sub: "total viewers", icon: Eye, color: "bg-white border-slate-200 text-slate-900", trendKey: "views" },
    { label: "Inquiries", value: stats.totalInquiries, sub: "people asked", icon: MessageCircle, color: "bg-white border-slate-200 text-slate-900", trendKey: "inquiries" },
    { label: "Portfolio value", value: `${currency}${(stats.totalValue || 0).toLocaleString()}`, sub: "active listings", icon: CircleDollarSign, color: "bg-white border-slate-200 text-slate-900", trendKey: "portfolioValue" },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Hero: minimal — welcome + CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-[#033d5c] text-white shadow-xl"
      >
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.14)_0%,transparent_55%)]"
          aria-hidden
        />
        <div className="relative px-5 py-6 sm:px-8 sm:py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome back, {firstName}</h1>
          <Link
            href="/properties/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-primary font-semibold rounded-xl hover:bg-white/95 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <PlusCircle className="w-5 h-5" />
            Add property
          </Link>
        </div>
      </motion.div>

      {/* Date filter — compact */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <p className="text-sm text-slate-500">
          {loading
            ? "Loading…"
            : dateRange.from && dateRange.to
            ? "Filtered by date range"
            : `All time${stats.recentlyAdded > 0 ? ` · ${stats.recentlyAdded} added in last 7 days` : ""}`}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {presets.map((preset) => {
            const active =
              (!dateRange.from && !dateRange.to && !preset.from) ||
              (dateRange.from === preset.from && dateRange.to === preset.to);
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setDateRange({ from: preset.from, to: preset.to });
                  setShowDatePicker(false);
                }}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active ? "bg-primary text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 min-w-[10.5rem] px-3.5 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700 text-left"
            >
              <span className="truncate min-w-0">
                {dateRange.from && dateRange.to
                  ? (() => {
                      const match = presets.find(
                        (p) => p.from && p.to && dateRange.from === p.from && dateRange.to === p.to
                      );
                      return match ? match.label : formatDateRangeLabel(dateRange.from, dateRange.to);
                    })()
                  : "Custom dates"}
              </span>
            </button>
            {showDatePicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDatePicker(false)} aria-hidden="true" />
                <div className="absolute right-0 top-full mt-2 z-20 bg-white rounded-xl border border-slate-200 shadow-xl p-4 min-w-[260px]">
                  <p className="text-xs font-medium text-slate-600 mb-3">Filter by date range</p>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">From</label>
                      <input
                        type="date"
                        value={dateRange.from || ""}
                        onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value || null }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">To</label>
                      <input
                        type="date"
                        value={dateRange.to || ""}
                        onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value || null }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setDateRange({ from: null, to: null });
                        setShowDatePicker(false);
                      }}
                      className="flex-1 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(false)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* KPI cards — prominent, animated */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
      >
        {kpiCards.map((card, i) => (
          <motion.div
            key={card.label}
            variants={item}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className={`rounded-2xl border ${card.color} p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300`}
          >
            <div className="flex items-start justify-between gap-3 w-full">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{card.label}</p>
                {loading ? (
                  <div className="h-9 w-24 bg-slate-100 rounded-lg mt-2 animate-pulse" />
                ) : (
                  <>
                    <div className="flex items-baseline gap-2 mt-2 flex-wrap">
                      <p
                        className="text-xl sm:text-2xl font-bold tabular-nums truncate"
                        title={typeof card.value === "string" ? card.value : String(card.value)}
                      >
                        {card.value}
                      </p>
                      {card.trendKey && trends[card.trendKey] && (
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums ${
                            trends[card.trendKey].isUp ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          }`}
                          title={trends[card.trendKey].isUp ? "Up from previous period" : "Down from previous period"}
                        >
                          {trends[card.trendKey].isUp ? <TrendingUp className="w-3 h-3 shrink-0" /> : <TrendingDown className="w-3 h-3 shrink-0" />}
                          {trends[card.trendKey].pct}%
                        </span>
                      )}
                    </div>
                    {card.sub && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{card.sub}</p>
                    )}
                  </>
                )}
              </div>
              {card.icon && (
                <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                  <card.icon className="w-5 h-5" />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Main content: Recent Properties + Queries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Recent Properties — responsive table / cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
        >
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent listings</h2>
            <Link
              href="/properties"
              className="text-sm font-medium text-primary hover:text-primary/80 inline-flex items-center gap-1 transition-colors"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {/* Desktop table */}
            <table className="w-full hidden sm:table">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Property
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading
                  ? [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 sm:px-6 py-4">
                          <div className="h-4 w-32 bg-slate-100 rounded" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-6 w-16 bg-slate-100 rounded-md" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-4 w-20 bg-slate-100 rounded ml-auto" />
                        </td>
                      </tr>
                    ))
                  : recentProperties.length === 0
                  ? (
                      <tr>
                        <td colSpan="3" className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                              <Building2 className="w-7 h-7 text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-700">No properties yet</p>
                            <p className="text-xs text-slate-500 max-w-xs">
                              Add your first listing to start reaching buyers.
                            </p>
                            <Link
                              href="/properties/new"
                              className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
                            >
                              <PlusCircle className="w-4 h-4" /> Add property
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  : recentProperties.map((property) => {
                      const sortedImages = [...(property.property_photos || [])].sort(
                        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
                      );
                      const firstImage = sortedImages?.[0]?.photo_url;
                      const displayAddress = property.full_address || property.address || "Property";
                      const ps = (property.property_status || "").toLowerCase();
                      const statusLabel =
                        property._normalizedStatus === "archived"
                          ? "Archived"
                          : property._normalizedStatus === "draft"
                          ? "Draft"
                          : ps === "sold"
                          ? "Sold"
                          : ps === "under_contract"
                          ? "Under Contract"
                          : ps === "pending"
                          ? "Pending"
                          : "Available";
                      const statusClass =
                        property._normalizedStatus === "archived"
                          ? "bg-slate-200 text-slate-600"
                          : property._normalizedStatus === "draft"
                          ? "bg-amber-100 text-amber-800"
                          : ps === "sold"
                          ? "bg-red-100 text-red-700"
                          : ps === "under_contract"
                          ? "bg-teal-100 text-teal-700"
                          : ps === "pending"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-emerald-100 text-emerald-700";
                      return (
                        <tr key={property.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-4 sm:px-6 py-4">
                            <Link
                              href={`/properties/edit/${property.id}`}
                              className="flex items-center gap-3 group-hover:text-primary transition-colors"
                            >
                              {firstImage ? (
                                <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                                  <img
                                    src={firstImage}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0 flex items-center justify-center">
                                  <Building2 className="w-6 h-6 text-slate-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">
                                  {displayAddress}
                                </p>
                                <p className="text-xs text-slate-500 truncate max-w-[200px]">
                                  {property.city && property.state
                                    ? `${property.city}, ${property.state}`
                                    : "—"}
                                </p>
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${statusClass}`}
                            >
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-sm font-semibold text-slate-900 tabular-nums">
                              {currency}
                              {parseFloat(property.price || 0).toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {loading
                ? [...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 animate-pulse">
                      <div className="h-4 w-3/4 bg-slate-100 rounded mb-2" />
                      <div className="h-6 w-1/2 bg-slate-100 rounded" />
                    </div>
                  ))
                : recentProperties.length === 0
                ? (
                    <div className="p-8 text-center">
                      <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-600">No properties yet</p>
                      <Link
                        href="/properties/new"
                        className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-primary"
                      >
                        Add property <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )
                : recentProperties.map((property) => {
                    const displayAddress = property.full_address || property.address || "Property";
                    const ps = (property.property_status || "").toLowerCase();
                    const statusLabel =
                      property._normalizedStatus === "archived"
                        ? "Archived"
                        : property._normalizedStatus === "draft"
                        ? "Draft"
                        : ps === "sold"
                        ? "Sold"
                        : ps === "under_contract"
                        ? "Under Contract"
                        : ps === "pending"
                        ? "Pending"
                        : "Available";
                    const statusClass =
                      property._normalizedStatus === "archived"
                        ? "bg-slate-200 text-slate-600"
                        : property._normalizedStatus === "draft"
                        ? "bg-amber-100 text-amber-800"
                        : ps === "sold"
                        ? "bg-red-100 text-red-700"
                        : ps === "under_contract"
                        ? "bg-teal-100 text-teal-700"
                        : ps === "pending"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-emerald-100 text-emerald-700";
                    return (
                      <Link
                        key={property.id}
                        href={`/properties/edit/${property.id}`}
                        className="block p-4 hover:bg-slate-50/80 transition-colors"
                      >
                        <p className="text-sm font-medium text-slate-900 truncate">{displayAddress}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
                            {statusLabel}
                          </span>
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">
                            {currency}
                            {parseFloat(property.price || 0).toLocaleString()}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
            </div>
          </div>
        </motion.div>

        {/* Recent queries (buyer conversations) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
        >
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Recent queries</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest buyer messages</p>
          </div>
          <div className="p-4 space-y-1 max-h-[380px] overflow-y-auto scrollbar-hide">
            {loading
              ? [...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 animate-pulse">
                    <div className="w-10 h-10 bg-slate-100 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="h-4 w-24 bg-slate-100 rounded mb-1.5" />
                      <div className="h-3 w-32 bg-slate-50 rounded mb-1" />
                      <div className="h-3 w-full max-w-[180px] bg-slate-50 rounded mb-1" />
                      <div className="h-3 w-12 bg-slate-50 rounded" />
                    </div>
                  </div>
                ))
              : recentQueries.length === 0
              ? (
                  <div className="text-center py-10 px-4">
                    <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">No recent queries</p>
                    <p className="text-xs text-slate-500 mt-1">Buyer messages will appear here.</p>
                  </div>
                )
              : recentQueries.map((q) => (
                  <Link
                    key={q.id}
                    href={`/messages?conversation=${q.id}`}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50/80 transition-colors group"
                  >
                    <div className="relative shrink-0">
                      {q.property_thumbnail_url ? (
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 ring-2 ring-white shadow-sm">
                          <img
                            src={q.property_thumbnail_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <MessageCircle className="w-5 h-5" />
                        </div>
                      )}
                      {q.has_unread && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {q.buyer_name || "Buyer"}
                      </p>
                      {q.property_address && (
                        <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1 truncate">
                          <Home className="w-3 h-3 shrink-0 text-primary/70" aria-hidden />
                          <span className="truncate">{q.property_address}</span>
                        </p>
                      )}
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {q.last_message_preview || "No message yet"}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatTimeAgo(q.last_message_at)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:text-primary transition-colors" />
                  </Link>
                ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-100">
            <Link
              href="/messages"
              className="block text-center text-sm font-medium text-slate-600 hover:text-primary transition-colors"
            >
              Open messages
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Status breakdown + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Listing status — modern donut chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
        >
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Listing status</h2>
            <p className="text-xs text-slate-500 mt-0.5">By availability</p>
          </div>
          <div className="p-5 sm:p-6">
            {loading ? (
              <div className="flex justify-center">
                <div className="w-40 h-40 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ) : statusBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No data yet</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="relative w-36 h-36 sm:w-40 sm:h-40 shrink-0"
                >
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm" aria-hidden>
                    <defs>
                      <filter id="listing-donut-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.08" />
                      </filter>
                      <linearGradient id="listing-donut-center" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor="#f1f5f9" />
                      </linearGradient>
                    </defs>
                    <g transform="rotate(-90 50 50)" filter="url(#listing-donut-shadow)">
                      {(() => {
                        const colors = {
                          Available: "#10B981",
                          "Sold Out": "#EF4444",
                          Pending: "#ea580c",
                          "Under Contract": "#0d9488",
                        };
                        const R = 40;
                        const r = 24;
                        const cx = 50;
                        const cy = 50;
                        const segments = statusBreakdown.filter((item) => (item.percentage || 0) > 0);
                        if (segments.length === 0) {
                          const o1 = cx + R;
                          const o2 = cx - R;
                          const i1 = cx + r;
                          const i2 = cx - r;
                          return (
                            <path
                              d={`M ${o1} ${cy} A ${R} ${R} 0 0 1 ${o2} ${cy} A ${R} ${R} 0 0 1 ${o1} ${cy} L ${i1} ${cy} A ${r} ${r} 0 0 1 ${i2} ${cy} A ${r} ${r} 0 0 1 ${i1} ${cy} Z`}
                              fill="#e2e8f0"
                              stroke="white"
                              strokeWidth="2"
                            />
                          );
                        }
                        let currentAngle = 0;
                        return segments.map((seg) => {
                          const pct = Math.min(100, Math.max(0, seg.percentage || 0));
                          let angle = (pct / 100) * 360;
                          if (angle < 0.5) return null;
                          if (angle >= 359.5) angle = 359.5;
                          const startAngle = currentAngle;
                          currentAngle += angle;
                          const startRad = (startAngle * Math.PI) / 180;
                          const endRad = (currentAngle * Math.PI) / 180;
                          const x1 = cx + R * Math.cos(startRad);
                          const y1 = cy + R * Math.sin(startRad);
                          const x2 = cx + R * Math.cos(endRad);
                          const y2 = cy + R * Math.sin(endRad);
                          const x3 = cx + r * Math.cos(endRad);
                          const y3 = cy + r * Math.sin(endRad);
                          const x4 = cx + r * Math.cos(startRad);
                          const y4 = cy + r * Math.sin(startRad);
                          const largeArc = angle > 180 ? 1 : 0;
                          const d = [
                            `M ${x1} ${y1}`,
                            `A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`,
                            `L ${x3} ${y3}`,
                            `A ${r} ${r} 0 ${largeArc} 0 ${x4} ${y4}`,
                            "Z",
                          ].join(" ");
                          return (
                            <path
                              key={seg.name}
                              d={d}
                              fill={colors[seg.name] || "#94a3b8"}
                              stroke="white"
                              strokeWidth="2"
                            />
                          );
                        });
                      })()}
                    </g>
                    <circle cx="50" cy="50" r="20" fill="url(#listing-donut-center)" stroke="#e2e8f0" strokeWidth="1" />
                    <text
                      x="50"
                      y="46"
                      textAnchor="middle"
                      fontSize="18"
                      fontWeight="700"
                      fill="#0f172a"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {stats.activeProperties}
                    </text>
                    <text
                      x="50"
                      y="58"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="500"
                      fill="#64748b"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      active
                    </text>
                  </svg>
                </motion.div>
                <div className="space-y-1 flex-1 min-w-0">
                  {statusBreakdown.map((seg, i) => {
                    const dotColors = {
                      Available: "bg-emerald-500",
                      "Sold Out": "bg-red-500",
                      Pending: "bg-orange-500",
                      "Under Contract": "bg-teal-500",
                    };
                    return (
                      <motion.div
                        key={seg.name}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.05, duration: 0.3 }}
                        className="flex items-center justify-between gap-3 py-2.5 px-2.5 rounded-lg hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`flex h-3.5 w-3.5 rounded-full shrink-0 ${dotColors[seg.name] || "bg-slate-400"} ring-2 ring-white shadow-sm`}
                            aria-hidden
                          />
                          <span className="text-sm font-medium text-slate-700 truncate">{seg.name}</span>
                        </div>
                        <div className="flex items-baseline gap-2 shrink-0">
                          <span className="text-base font-bold text-slate-900 tabular-nums">{seg.count}</span>
                          <span className="text-xs text-slate-500 tabular-nums">({seg.percentage || 0}%)</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Actions — spans 2 cols on lg so it's prominent */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
        >
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Quick actions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Shortcuts to manage your portfolio</p>
          </div>
          <div className="p-4 sm:p-6 flex flex-col gap-2">
            <Link
              href="/properties/new"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-semibold"
            >
              <PlusCircle className="w-5 h-5 shrink-0" />
              Add property
            </Link>
            <Link
              href="/properties"
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700"
            >
              <List className="w-5 h-5 shrink-0 text-slate-500" />
              Manage listings
            </Link>
            <Link
              href="/properties?view=trash"
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700"
            >
              <Archive className="w-5 h-5 shrink-0 text-slate-500" />
              Archived
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
