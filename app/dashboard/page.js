"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { getCurrentCurrencySymbol } from "@/lib/currency";
import {
  Building2, PlusCircle, ChevronRight, ChevronLeft, MessageCircle,
  Eye, Home, CircleDollarSign, FileText, BarChart3, Megaphone, ScrollText,
  Edit3, Bed, Bath, Square, Bell, TrendingUp, TrendingDown, CheckCircle2,
  MapPin, Heart, MessageSquare
} from "lucide-react";

// Design system avatar colors
// Light pastel backgrounds + darker text pairs from design system
const AVATAR_PAIRS = [
  { bg: '#f2f2f2', text: '#111111' },  // primary-surface / primary
  { bg: '#f2f2f2', text: '#111111' },  // success-surface / success
  { bg: '#f2f2f2', text: '#555555' },  // warning-surface / warning
  { bg: '#ececec', text: '#444444' },  // neutral surface / body
  { bg: '#fafafa', text: '#171717' },  // light surface / primary text
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
  const [perms, setPerms] = useState({ isOwner: true, listings_create: true, listings_update: true, contracts_create: true });
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

      // Single server-side aggregation endpoint — stats, listings, permissions, sellerName.
      try {
        const res = await fetch('/api/seller/dashboard', { headers: { Authorization: `Bearer ${currentUserId}` } });
        const data = await res.json();

        if (data?.stats) {
          setStats({
            activeProperties: data.stats.activeProperties || 0,
            totalViews: data.stats.totalViews || 0,
            offersReceived: data.stats.offersReceived || 0,
            dealsClosed: data.stats.dealsClosed || 0,
            recentlyAdded: data.stats.recentlyAdded || 0,
            viewsThisWeek: data.stats.viewsThisWeek || 0,
            viewsLast30Days: data.stats.viewsLast30Days || 0,
            hasSevenDayViews: !!data.stats.hasSevenDayViews,
            offersThisWeek: data.stats.offersThisWeek || 0,
            closedThisMonth: data.stats.closedThisMonth,
            trashProperties: data.stats.trashProperties || 0,
          });
        }

        if (Array.isArray(data?.listings)) {
          setRecentProperties(data.listings.map(p => ({
            ...p,
            property_photos: p.feature_image ? [{ photo_url: p.feature_image, display_order: 0 }] : [],
          })));
        }

        if (data?.permissions) setPerms(data.permissions);

        // Backfill contactPersonName if missing (e.g. users who signed up via onboarding)
        if (data?.sellerName && !currentUser.contactPersonName) {
          const updated = { ...currentUser, contactPersonName: data.sellerName };
          localStorage.setItem("seller_user", JSON.stringify(updated));
          setUser(updated);
        }
      } catch (e) { console.error("Error fetching dashboard data:", e); }

      // Recent messages (separate workspace-scoped API).
      try {
        const res = await fetch("/api/seller/chat?action=get_conversations", { headers: { Authorization: `Bearer ${currentUserId}` } });
        const data = await res.json();
        const conversations = data.conversations || [];
        setRecentQueries(conversations.slice(0, 5));
      } catch { setRecentQueries([]); }
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
      icon: <Home className="w-4 h-4 text-ink" />, iconBg: "#f2f2f2"
    },
    {
      label: "Total views",
      value: stats.totalViews.toLocaleString(),
      // Use the real 7-day number when available; only fall back to 30-day data
      // when there's no 7-day signal, and relabel the sub so it's never wrong.
      sub: stats.viewsThisWeek > 0
        ? `+${stats.viewsThisWeek} this week`
        : (!stats.hasSevenDayViews && stats.viewsLast30Days > 0 ? `+${stats.viewsLast30Days} last 30 days` : null),
      subUp: true,
      icon: <Eye className="w-4 h-4 text-smoke-3" />, iconBg: "#f2f2f2"
    },
    {
      label: "Offers received", value: stats.offersReceived,
      sub: stats.offersThisWeek > 0 ? `+${stats.offersThisWeek} this week` : null, subUp: true,
      icon: <FileText className="w-4 h-4 text-smoke-3" />, iconBg: "#f2f2f2"
    },
    {
      label: "Deals closed", value: stats.dealsClosed,
      // closedThisMonth is null when there's no reliable sold-date signal → omit the sub
      // entirely rather than show a fake 0. Otherwise show the honest count.
      sub: (stats.closedThisMonth != null && stats.closedThisMonth > 0) ? `+${stats.closedThisMonth} this month` : null,
      subUp: true,
      icon: <CheckCircle2 className="w-4 h-4 text-ink" />, iconBg: "#f2f2f2"
    },
  ];

  const manageItems = [
    { label: "Post a new deal", desc: "Create a listing", icon: <PlusCircle className="w-5 h-5 text-muted" />, href: "/properties/new", show: perms.isOwner || perms.listings_create },
    { label: "Edit Listings", desc: "Update your deals", icon: <Edit3 className="w-5 h-5 text-ink" />, href: "/properties", show: perms.isOwner || perms.listings_update },
    { label: "View Offers", desc: `${stats.offersReceived} pending offers`, icon: <FileText className="w-5 h-5 text-smoke-3" />, href: "/offers", show: true },
    // 4th slot: Create Contract when allowed, otherwise swap in Messages so the row stays full.
    (perms.isOwner || perms.contracts_create)
      ? { label: "Create Contract", desc: "Send a deal to a buyer", icon: <ScrollText className="w-5 h-5 text-ink" />, href: "/contracts/new", show: true }
      : { label: "Messages", desc: "Chat with buyers", icon: <MessageSquare className="w-5 h-5 text-ink" />, href: "/messages", show: true },
  ].filter(item => item.show);

  return (
    <div className="min-h-full bg-tint-3" style={{ fontFamily: 'var(--font-instrument), sans-serif' }}>
      {/* Header */}
      <div className="px-2 lg:px-4 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-[26px] md:text-[29px] leading-[1.1] tracking-[-0.025em] text-ink">Welcome Back, {firstName}</h1>
            <p className="font-mono text-[11.5px] text-muted uppercase tracking-[0.08em] mt-1">{getCurrentDate()}</p>
          </div>
          <div className="flex items-center gap-3">
            {(perms.isOwner || perms.listings_create) && (
              <Link href="/properties/new" className="hidden lg:flex items-center gap-2 px-[18px] py-2.5 bg-ink text-white text-[14px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 hover:bg-smoke-2 transition-all duration-[120ms]">
                <PlusCircle className="w-4 h-4" />
                Post a Deal
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="px-2 lg:px-4 py-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {kpiCards.map(card => (
            <div key={card.label} className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 px-4 py-5 flex flex-col">
              {/* Top row — label + icon */}
              <div className="flex items-start justify-between mb-5">
                <p className="font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.12em]">{card.label}</p>
                <div className="w-8 h-8 rounded-[8px] bg-tint flex items-center justify-center flex-shrink-0">
                  {card.icon}
                </div>
              </div>
              {/* Number + trend */}
              {loading ? (
                <div className="h-9 w-16 bg-tint rounded motion-safe:animate-pulse" />
              ) : (
                <div>
                  <p className="font-display font-bold text-[34px] text-ink leading-none tracking-[-0.02em]">{card.value}</p>
                  {card.sub && (
                    <p className="font-mono text-[11px] font-semibold text-ink mt-2 flex items-center gap-1">
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
          <div className="xl:col-span-3 bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
              <h2 className="font-display font-semibold text-[16.5px] tracking-[-0.01em] text-ink">My Listings</h2>
              <Link href="/properties" className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-ink transition-colors duration-[120ms]">View all</Link>
            </div>

            {loading ? (
              <div className="min-h-[340px] flex flex-col items-center justify-center gap-3">
                <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-2 border-hairline border-t-ink"></div>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Loading listings...</p>
              </div>
            ) : recentProperties.length === 0 ? (
              <div className="p-8 text-center min-h-[340px] flex flex-col items-center justify-center">
                <Building2 className="w-8 h-8 text-mist mx-auto mb-3" />
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted mb-4">No listings yet</p>
                {(perms.isOwner || perms.listings_create) && (
                  <Link href="/properties/new" className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-white text-[13px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 hover:bg-smoke-2 transition-all duration-[120ms]">
                    <PlusCircle className="w-4 h-4" /> Post a Deal
                  </Link>
                )}
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
                    ? 'bg-body text-white'
                    : ps === 'sold'
                    ? 'bg-white text-ink border-[1.5px] border-ink'
                    : 'bg-white text-muted border-[1.5px] border-line';

                  return (
                    <div key={property.id} className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-3 overflow-hidden flex-shrink-0 w-[85vw] sm:w-[calc(50%-8px)]">
                      {/* Image */}
                      <div className="relative h-[220px] border-b-[1.5px] border-ink bg-[repeating-linear-gradient(45deg,#f2f2f2_0px,#f2f2f2_10px,#fafafa_10px,#fafafa_20px)]">
                        {image ? (
                          <img src={image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Building2 className="w-8 h-8 text-mist" /></div>
                        )}
                        <span className={`absolute top-3 left-3 px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] rounded-pill ${statusStyle}`}>
                          {statusLabel}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <p className="font-display font-semibold text-[16.5px] tracking-[-0.01em] text-ink mb-1.5 line-clamp-1">{title}</p>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted mb-3">
                          {location && <><MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span>{location}</span></>}
                          {property.bedrooms && <><span className="text-hairline">•</span><span>{property.bedrooms} bed</span></>}
                          {property.bathrooms && <><span className="text-hairline">•</span><span>{property.bathrooms} bath</span></>}
                        </div>
                        <p className="font-display font-bold text-[21px] text-ink leading-none mb-3">{formatCurrency(property.price)}</p>
                        {/* Stats */}
                        <div className="flex items-center gap-3 font-mono text-[11px] text-muted mb-4">
                          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {property.view_count ?? 0} views</span>
                          <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {property.saves_count ?? 0} saves</span>
                          <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {property.offers_count ?? 0} offers</span>
                        </div>
                        {/* Buttons */}
                        <div className="flex gap-2">
                          {(perms.isOwner || perms.listings_update) && (
                            <Link href={`/properties/edit/${property.id}`} className="flex-1 py-2.5 text-center bg-white text-ink text-[13px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-offset-2 hover:bg-tint transition-all duration-[120ms]">
                              Edit
                            </Link>
                          )}
                          <Link href={`/properties/preview/${property.id}`} className="flex-1 py-2.5 text-center bg-ink text-white text-[13px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 hover:bg-smoke-2 transition-all duration-[120ms]">
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
          <div className="xl:col-span-2 bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-hairline flex items-center justify-between">
              <h2 className="font-display font-semibold text-[16.5px] tracking-[-0.01em] text-ink">Recent messages</h2>
              <Link href="/messages" className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-ink transition-colors duration-[120ms]">View all</Link>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-tint rounded motion-safe:animate-pulse" />)}</div>
            ) : recentQueries.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="w-8 h-8 text-mist mx-auto mb-3" />
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">No messages yet</p>
              </div>
            ) : (
              <div className="divide-y divide-hairline-2">
                {recentQueries.map(q => (
                  <Link key={q.id} href={`/messages?conversation=${q.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-tint transition-colors duration-[120ms]">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getAvatarPair(q.buyer_name || q.id).bg }}>
                      <span className="font-mono text-[12px] font-semibold" style={{ color: getAvatarPair(q.buyer_name || q.id).text }}>{getInitials(q.buyer_name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold text-ink truncate">{q.buyer_name || "Buyer"}</p>
                        <span className="font-mono text-[10.5px] text-muted flex-shrink-0">{formatTimeAgo(q.last_message_at)}</span>
                      </div>
                      <p className="text-[12px] text-muted truncate mt-0.5">{q.last_message_preview || "No message yet"}</p>
                    </div>
                    {(q.unread_count ?? 0) > 0 && <span className="w-2.5 h-2.5 rounded-full bg-ink flex-shrink-0 mt-1.5"></span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Manage Listings */}
        <div>
          <h2 className="font-display font-bold text-[19px] tracking-[-0.02em] text-ink mb-3">Manage Listings</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {manageItems.map(item => (
              <Link key={item.label} href={item.href} className="flex items-center gap-3 bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-3 px-4 py-4 hover:bg-tint transition-all duration-[120ms] group">
                <div className="w-10 h-10 rounded-[10px] bg-tint flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{item.label}</p>
                  <p className="font-mono text-[10.5px] text-muted">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-mist flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
