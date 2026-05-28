"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { getCurrentCurrencySymbol } from "@/lib/currency";
import {
  Building2, PlusCircle, ChevronRight, ChevronLeft, MessageCircle,
  Eye, Home, CircleDollarSign, FileText, BarChart3, Megaphone, ScrollText,
  Edit3, Bed, Bath, Square, Bell, TrendingUp, TrendingDown, CheckCircle2,
  MapPin, Heart
} from "lucide-react";

// Design system avatar colors
// Light pastel backgrounds + darker text pairs from design system
const AVATAR_PAIRS = [
  { bg: '#FEF0EF', text: '#D03839' },  // primary-surface / primary
  { bg: '#E4F5EC', text: '#0F6E56' },  // success-surface / success
  { bg: '#FEF3E2', text: '#B5620A' },  // warning-surface / warning
  { bg: '#F0F0EC', text: '#444441' },  // neutral surface / body
  { bg: '#FAFAF8', text: '#1A1816' },  // light surface / primary text
];
function getAvatarPair(seed = '') {
  const str = String(seed || 'u');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_PAIRS[Math.abs(hash) % AVATAR_PAIRS.length];
}
function getInitials(name) {
  if (!name) return 'B';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

function uuidToNumericConvId(uuid) {
  if (!uuid) return null;
  const match = String(uuid).match(/00000000-0000-0000-0000-([0-9a-f]{12})$/i);
  if (match) return parseInt(match[1], 16);
  return null;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    activeProperties: 0, totalViews: 0, offersReceived: 0, dealsClosed: 0,
    recentlyAdded: 0, viewsThisWeek: 0, offersThisWeek: 0, closedThisMonth: 0,
    trashProperties: 0,
  });
  const [recentProperties, setRecentProperties] = useState([]);
  const [recentQueries, setRecentQueries] = useState([]);
  const [currency, setCurrency] = useState("$");
  const scrollRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const userStr = localStorage.getItem("seller_user");
    if (userStr) setUser(JSON.parse(userStr));
    setCurrency(getCurrentCurrencySymbol());
    fetchDashboardData();
  }, []);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    if (notifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  // Fetch notifications on mount and every 30s
  useEffect(() => {
    const userStr = localStorage.getItem("seller_user");
    const sellerId = userStr ? JSON.parse(userStr)?.id : null;
    if (!sellerId) return;
    let mounted = true, timer = null;
    const fetchNotifs = async () => {
      try {
        const res = await fetch('/api/seller/notifications', { headers: { Authorization: `Bearer ${sellerId}` } });
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data?.notifications)) setNotifications(data.notifications);
        if (data?.unreadCount != null) setNotifUnread(data.unreadCount);
      } catch {}
    };
    fetchNotifs();
    timer = setInterval(() => { if (document.visibilityState === 'visible') fetchNotifs(); }, 30000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const userStr = localStorage.getItem("seller_user");
      if (!userStr) { setLoading(false); return; }
      const currentUser = JSON.parse(userStr);
      const currentUserId = currentUser.id;

      // Resolve effective seller_id for active workspace
      let effectiveUserId = currentUserId;
      try {
        const wsRes = await fetch('/api/team/workspace', { headers: { Authorization: `Bearer ${currentUserId}` } });
        const wsData = await wsRes.json();
        if (wsData?.effectiveId) effectiveUserId = wsData.effectiveId;
      } catch {}

      const { data: sellerData } = await supabase.from("seller_applications").select("temp_seller_id, contact_person_name").eq("id", effectiveUserId).maybeSingle();
      const tempSellerId = sellerData?.temp_seller_id;

      // Backfill contactPersonName if missing (e.g. users who signed up via onboarding)
      if (sellerData?.contact_person_name && !currentUser.contactPersonName) {
        const updated = { ...currentUser, contactPersonName: sellerData.contact_person_name };
        localStorage.setItem("seller_user", JSON.stringify(updated));
        setUser(updated);
      }

      // Manual properties
      const { data: manualList = [] } = await supabase.from("properties").select("*").eq("seller_id", effectiveUserId).order("created_at", { ascending: false });
      let manualWithImages = manualList || [];
      if (manualWithImages.length > 0) {
        const ids = manualWithImages.map(p => p.id);
        const { data: imagesData } = await supabase.from("property_images").select("id, image_url, sort_order, property_id").in("property_id", ids).order("sort_order");
        const imagesByProperty = {};
        (imagesData || []).forEach(img => { if (!imagesByProperty[img.property_id]) imagesByProperty[img.property_id] = []; imagesByProperty[img.property_id].push(img); });
        manualWithImages = manualWithImages.map(p => ({ ...p, _source: "manual", property_photos: (imagesByProperty[p.id] || []).map(img => ({ photo_url: img.image_url, display_order: img.sort_order })).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)) }));
      } else {
        manualWithImages = (manualList || []).map(p => ({ ...p, _source: "manual", property_photos: [] }));
      }

      // Scraped properties
      let scrapedList = [];
      if (tempSellerId) {
        const { data: wholesaleList, error: wholesaleError } = await supabase.from("wholesale_deals").select(`*, property_photos (id, photo_url, display_order, is_featured)`).eq("temp_seller_id", tempSellerId).order("created_at", { ascending: false });
        if (!wholesaleError && wholesaleList) scrapedList = wholesaleList.map(p => ({ ...p, _source: "scraped" }));
      }

      const normalizeStatus = p => { const s = (p.status || "").toLowerCase(); if (s === "archived") return "archived"; if (s === "published" || s === "active") return "active"; return "draft"; };
      const combined = [
        ...manualWithImages.map(p => ({ ...p, _normalizedStatus: normalizeStatus(p), property_status: p.property_status || "available" })),
        ...scrapedList.map(p => ({ ...p, _normalizedStatus: normalizeStatus(p), property_status: p.property_status || "available" })),
      ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const activeList = combined.filter(p => p._normalizedStatus !== "archived");
      const soldList = combined.filter(p => (p.property_status || "").toLowerCase() === "sold");
      const recentCount = combined.filter(p => new Date(p.created_at) >= sevenDaysAgo).length;

      // Views
      let totalViews = 0, viewsThisWeek = 0;
      try {
        const res = await fetch(`/api/seller/dashboard-stats?userId=${encodeURIComponent(effectiveUserId)}`);
        const data = await res.json();
        totalViews = Number(data.totalViews) || 0;
        viewsThisWeek = Number(data.viewsLast7Days || data.viewsLast30Days) || 0;
      } catch {}

      // Conversations
      let totalInquiries = 0;
      try {
        const res = await fetch("/api/seller/chat?action=get_conversations", { headers: { Authorization: `Bearer ${effectiveUserId}` } });
        const data = await res.json();
        const conversations = data.conversations || [];
        totalInquiries = conversations.length;
        setRecentQueries(conversations.slice(0, 5));
      } catch { setRecentQueries([]); }

      // Offers
      let offersReceived = 0, offersThisWeek = 0;
      try {
        const oRes = await fetch('/api/seller/offers', { headers: { Authorization: `Bearer ${effectiveUserId}` } });
        const oData = await oRes.json();
        const allOffers = oData.offers || [];
        offersReceived = allOffers.length;
        offersThisWeek = allOffers.filter(o => new Date(o.created_at) >= sevenDaysAgo).length;
      } catch {}

      setStats({
        activeProperties: activeList.length,
        totalViews,
        offersReceived,
        dealsClosed: soldList.length,
        recentlyAdded: recentCount,
        viewsThisWeek,
        offersThisWeek,
        closedThisMonth: 0,
        trashProperties: combined.filter(p => p._normalizedStatus === "archived").length,
      });

      // Enrich top 8 listings with per-property views, saves, offers
      const top8 = activeList.slice(0, 8);
      let enrichedListings = top8;
      if (top8.length > 0) {
        const ids = top8.map(p => p.id);
        const [analyticsRes, favRes, offersRes] = await Promise.all([
          supabase.from('property_analytics').select('property_id, page_views').in('property_id', ids),
          supabase.from('user_favorites').select('property_id').in('property_id', ids),
          supabase.from('offers').select('property_id').in('property_id', ids),
        ]);
        const viewsMap = {}, savesMap = {}, offersMap = {};
        for (const r of analyticsRes.data || []) viewsMap[r.property_id] = (viewsMap[r.property_id] || 0) + (Number(r.page_views) || 0);
        for (const r of favRes.data || []) savesMap[r.property_id] = (savesMap[r.property_id] || 0) + 1;
        for (const r of offersRes.data || []) offersMap[r.property_id] = (offersMap[r.property_id] || 0) + 1;
        enrichedListings = top8.map(p => ({
          ...p,
          view_count: viewsMap[p.id] || 0,
          saves_count: savesMap[p.id] || 0,
          offers_count: offersMap[p.id] || 0,
        }));
      }
      setRecentProperties(enrichedListings);
    } catch (error) { console.error("Error fetching dashboard data:", error); }
    finally { setLoading(false); }
  };

  const firstName = (() => {
    const raw = user?.contactPersonName || user?.contact_person_name || user?.full_name || user?.name || "";
    return raw.trim().split(/\s+/)[0] || "Seller";
  })();

  const getCurrentDate = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const formatTimeAgo = (ds) => {
    if (!ds) return "";
    const diff = Date.now() - new Date(ds).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const formatCurrency = (amount) => !amount ? `${currency}0` : `${currency}${Number(amount).toLocaleString()}`;

  const scrollListings = (dir) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
  };

  const getFeatureImage = (property) => {
    const photos = property?.property_photos || [];
    const sorted = [...photos].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    return sorted[0]?.photo_url || null;
  };

  const kpiCards = [
    {
      label: "Active listings", value: stats.activeProperties,
      sub: stats.recentlyAdded > 0 ? `+${stats.recentlyAdded} this week` : null, subUp: true,
      icon: <Home className="w-4 h-4 text-[#D03839]" />, iconBg: "#FEF0EF"
    },
    {
      label: "Total views", value: stats.totalViews.toLocaleString(),
      sub: stats.viewsThisWeek > 0 ? `+${stats.viewsThisWeek} this week` : null, subUp: true,
      icon: <Eye className="w-4 h-4 text-[#B5620A]" />, iconBg: "#FEF3E2"
    },
    {
      label: "Offers received", value: stats.offersReceived,
      sub: stats.offersThisWeek > 0 ? `+${stats.offersThisWeek} this week` : null, subUp: true,
      icon: <FileText className="w-4 h-4 text-[#B5620A]" />, iconBg: "#FEF3E2"
    },
    {
      label: "Deals closed", value: stats.dealsClosed,
      sub: stats.closedThisMonth !== 0 ? `${stats.closedThisMonth > 0 ? '+' : ''}${stats.closedThisMonth} this month` : null,
      subUp: stats.closedThisMonth >= 0,
      icon: <CheckCircle2 className="w-4 h-4 text-[#0F6E56]" />, iconBg: "#E4F5EC"
    },
  ];

  const manageItems = [
    { label: "Post a new deal", desc: "Create a listing", icon: <PlusCircle className="w-5 h-5 text-[#737370]" />, href: "/properties/new" },
    { label: "Edit Listings", desc: "Update your deals", icon: <Edit3 className="w-5 h-5 text-[#D03839]" />, href: "/properties" },
    { label: "View Offers", desc: `${stats.offersReceived} pending offers`, icon: <FileText className="w-5 h-5 text-[#B5620A]" />, href: "/offers" },
    { label: "Create Contract", desc: "Send a deal to a buyer", icon: <ScrollText className="w-5 h-5 text-[#0F6E56]" />, href: "/contracts/new" },
  ];

  return (
    <div className="min-h-full bg-[#FAFAF8]" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      {/* Header */}
      <div className="px-2 lg:px-4 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-bold text-[#1A1816] tracking-[-0.56px]">Welcome Back, {firstName}</h1>
            <p className="text-[14px] text-[#737370] mt-0.5">{getCurrentDate()}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Notification Bell — desktop only (mobile bell is in DashboardLayout navbar) */}
            <div className="relative hidden lg:block" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(prev => !prev)}
                className="relative p-2.5 rounded border border-[#E8E8E4] hover:bg-[#FAFAF8] transition-colors duration-200"
              >
                <Bell className="w-4 h-4 text-[#444441]" />
                {notifUnread > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-[#D03839] rounded-full leading-none">
                    {notifUnread > 99 ? '99+' : notifUnread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="fixed top-[70px] left-3 right-3 lg:absolute lg:top-full lg:left-auto lg:right-0 lg:mt-2 lg:w-[380px] bg-white border border-[#E8E8E4] rounded shadow-xl z-[200] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E4]">
                    <span className="text-[13px] font-semibold text-[#1A1816]">Notifications</span>
                    {notifUnread > 0 && (
                      <button
                        onClick={async () => {
                          const sellerId = user?.id;
                          if (!sellerId) return;
                          await fetch('/api/seller/notifications', { method: 'POST', headers: { Authorization: `Bearer ${sellerId}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_all_read' }) });
                          setNotifUnread(0);
                          setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                        }}
                        className="text-[11px] text-[#D03839] font-medium hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex items-center justify-center h-16 text-[13px] text-[#737370]">No notifications yet</div>
                    ) : (
                      notifications.map(n => {
                        const convNumeric = uuidToNumericConvId(n.related_conversation_id);
                        const href = (n.type === 'listing_approved' || n.type === 'listing_rejected')
                          ? '/properties'
                          : convNumeric ? `/messages?conversation=${convNumeric}` : '/messages';
                        return (
                          <Link
                            key={n.id}
                            href={href}
                            onClick={async () => {
                              setNotifOpen(false);
                              if (!n.is_read) {
                                const sellerId = user?.id;
                                if (sellerId) {
                                  await fetch('/api/seller/notifications', { method: 'POST', headers: { Authorization: `Bearer ${sellerId}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_read', notification_id: n.id }) });
                                  setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
                                  setNotifUnread(prev => Math.max(0, prev - 1));
                                }
                              }
                            }}
                            className={`flex items-start gap-3 px-4 py-3 border-l-2 transition-colors hover:bg-[#FAFAF8] ${n.is_read ? 'border-l-transparent bg-white' : 'border-l-[#D03839] bg-[#FAFAF8]'}`}
                          >
                            <Bell className="w-4 h-4 text-[#737370] flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className={`text-[13px] truncate ${n.is_read ? 'text-[#444441]' : 'font-semibold text-[#1A1816]'}`}>{n.title}</p>
                              <p className="text-[11px] text-[#737370] truncate mt-0.5">{n.body}</p>
                              <p className="text-[10px] text-[#A8A8A4] mt-1">{n.created_at ? new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</p>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <Link href="/properties/new" className="hidden lg:flex items-center gap-2 px-4 py-2.5 bg-[#1A1816] text-white text-[14px] font-semibold rounded hover:bg-[#2a2826] transition-colors duration-200">
              <PlusCircle className="w-4 h-4" />
              Post a Deal
            </Link>
          </div>
        </div>
      </div>

      <div className="px-2 lg:px-4 py-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {kpiCards.map(card => (
            <div key={card.label} className="bg-white rounded border border-[#E8E8E4] px-4 py-5 flex flex-col">
              {/* Top row — label + icon */}
              <div className="flex items-start justify-between mb-5">
                <p className="text-[13px] font-medium text-[#737370]">{card.label}</p>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: card.iconBg }}>
                  {card.icon}
                </div>
              </div>
              {/* Number + trend */}
              {loading ? (
                <div className="h-9 w-16 bg-[#FAFAF8] rounded animate-pulse" />
              ) : (
                <div>
                  <p className="text-[36px] font-bold text-[#1A1816] leading-none tracking-tight">{card.value}</p>
                  {card.sub && (
                    <p className={`text-[12px] font-medium mt-2 flex items-center gap-1 ${card.subUp ? 'text-[#0F6E56]' : 'text-[#D03839]'}`}>
                      {card.subUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {card.sub}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* My Listings + Recent Messages */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 mb-8">
          {/* My Listings */}
          <div className="xl:col-span-3 bg-white rounded border border-[#E8E8E4] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E4]">
              <h2 className="text-[14px] font-normal text-[#1A1816]">My Listings</h2>
              <Link href="/properties" className="text-[13px] font-medium text-[#737370] hover:text-[#1A1816] transition-colors duration-200">View all</Link>
            </div>

            {loading ? (
              <div className="min-h-[340px] flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E8E8E4] border-t-[#1A1816]"></div>
                <p className="text-[13px] text-[#A8A8A4]">Loading listings...</p>
              </div>
            ) : recentProperties.length === 0 ? (
              <div className="p-8 text-center min-h-[340px] flex flex-col items-center justify-center">
                <Building2 className="w-8 h-8 text-[#A8A8A4] mx-auto mb-3" />
                <p className="text-[14px] font-medium text-[#444441] mb-3">No listings yet</p>
                <Link href="/properties/new" className="inline-flex items-center gap-2 px-4 py-2 bg-[#D03839] text-white text-[13px] font-semibold rounded hover:bg-[#E0493B] transition-colors duration-200">
                  <PlusCircle className="w-4 h-4" /> Post a Deal
                </Link>
              </div>
            ) : (
              <div className="flex gap-4 p-4 overflow-x-auto">
                {recentProperties.map(property => {
                  const image = getFeatureImage(property);
                  const title = property.title || property.full_address || property.address || 'Property';
                  const city = property.city || '';
                  const state = property.state || '';
                  const location = [city, state].filter(Boolean).join(', ');
                  const ps = (property.property_status || 'active').toLowerCase();
                  const statusLabel = ps === 'active' ? 'Active' : ps === 'under_review' ? 'Under review' : ps === 'sold' ? 'Sold' : 'Active';
                  const statusStyle = ps === 'active'
                    ? 'bg-[#E4F5EC] text-[#0F6E56]'
                    : ps === 'sold'
                    ? 'bg-[#FEF0EF] text-[#D03839]'
                    : 'bg-[#F3F3F0] text-[#737370]';

                  return (
                    <div key={property.id} className="bg-white rounded border border-[#E8E8E4] overflow-hidden flex-shrink-0 w-[85vw] sm:w-[calc(50%-8px)]">
                      {/* Image */}
                      <div className="relative h-[220px] bg-[#FAFAF8]">
                        {image ? (
                          <img src={image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Building2 className="w-8 h-8 text-[#A8A8A4]" /></div>
                        )}
                        <span className={`absolute top-3 left-3 px-2.5 py-1 text-[12px] font-semibold rounded-full ${statusStyle}`}>
                          {statusLabel}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <p className="text-[16px] font-semibold text-[#1A1816] mb-1.5 line-clamp-1">{title}</p>
                        <div className="flex items-center gap-1.5 text-[13px] text-[#737370] mb-3">
                          {location && <><MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span>{location}</span></>}
                          {property.bedrooms && <><span className="text-[#E8E8E4]">•</span><span>{property.bedrooms} bed</span></>}
                          {property.bathrooms && <><span className="text-[#E8E8E4]">•</span><span>{property.bathrooms} bath</span></>}
                        </div>
                        <p className="text-[28px] font-bold text-[#1A1816] leading-none mb-3">{formatCurrency(property.price)}</p>
                        {/* Stats */}
                        <div className="flex items-center gap-3 text-[12px] text-[#737370] mb-4">
                          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {property.view_count ?? 0} views</span>
                          <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {property.saves_count ?? 0} saves</span>
                          <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {property.offers_count ?? 0} offers</span>
                        </div>
                        {/* Buttons */}
                        <div className="flex gap-2">
                          <Link href={`/properties/edit/${property.id}`} className="flex-1 py-2.5 text-center border border-[#1A1816] text-[#1A1816] text-[13px] font-semibold rounded hover:bg-[#FAFAF8] transition-colors duration-200">
                            Edit
                          </Link>
                          <Link href={`/properties/preview/${property.id}`} className="flex-1 py-2.5 text-center bg-[#FEF0EF] text-[#D03839] text-[13px] font-semibold rounded border border-[#D03839] hover:bg-[#fde4e3] transition-colors duration-200">
                            View Deal
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Messages */}
          <div className="xl:col-span-2 bg-white rounded border border-[#E8E8E4] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[#E8E8E4] flex items-center justify-between">
              <h2 className="text-[14px] font-normal text-[#1A1816]">Recent messages</h2>
              <Link href="/messages" className="text-[13px] font-medium text-[#737370] hover:text-[#1A1816] transition-colors duration-200">View all</Link>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-[#FAFAF8] rounded animate-pulse" />)}</div>
            ) : recentQueries.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="w-8 h-8 text-[#A8A8A4] mx-auto mb-3" />
                <p className="text-[14px] font-medium text-[#444441]">No messages yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E8E8E4]">
                {recentQueries.map(q => (
                  <Link key={q.id} href={`/messages?conversation=${q.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-[#FAFAF8] transition-colors duration-200">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getAvatarPair(q.buyer_name || q.id).bg }}>
                      <span className="text-[12px] font-semibold" style={{ color: getAvatarPair(q.buyer_name || q.id).text }}>{getInitials(q.buyer_name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold text-[#1A1816] truncate">{q.buyer_name || "Buyer"}</p>
                        <span className="text-[11px] text-[#A8A8A4] flex-shrink-0">{formatTimeAgo(q.last_message_at)}</span>
                      </div>
                      <p className="text-[12px] text-[#737370] truncate mt-0.5">{q.last_message_preview || "No message yet"}</p>
                    </div>
                    {(q.unread_count ?? 0) > 0 && <span className="w-2.5 h-2.5 rounded-full bg-[#D03839] flex-shrink-0 mt-1.5"></span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Manage Listings */}
        <div>
          <h2 className="text-[18px] font-bold text-[#1A1816] tracking-[-0.56px] mb-3">Manage Listings</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {manageItems.map(item => (
              <Link key={item.label} href={item.href} className="flex items-center gap-3 bg-white rounded border border-[#E8E8E4] px-4 py-4 hover:bg-[#FAFAF8] transition-colors duration-200 group">
                <div className="w-10 h-10 rounded-full bg-[#FAFAF8] flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1A1816]">{item.label}</p>
                  <p className="text-[11px] text-[#A8A8A4]">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#A8A8A4] flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
