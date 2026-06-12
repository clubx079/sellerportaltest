"use client";

import React, { useEffect, useState } from 'react';
import { Users, Eye, Clock, Image as ImageIcon, Smartphone, Monitor, Tablet, X, ChevronDown, ChevronRight, BarChart2, Heart, FileText, MessageSquare, Flame, RefreshCw, Lightbulb, Download } from 'lucide-react';
import { downloadCSV, downloadPDF } from '@/lib/exportData';

function formatDuration(seconds) {
  if (seconds == null || seconds === 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const totalMinutes = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (totalMinutes >= 60) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
  return s ? `${totalMinutes}m ${s}s` : `${totalMinutes}m`;
}

function formatDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function displayName(row) {
  if (row.user_first_name || row.user_last_name) {
    return [row.user_first_name, row.user_last_name].filter(Boolean).join(' ').trim();
  }
  return row.user_email || 'Guest';
}

function getDeviceIcon(deviceType) {
  if (!deviceType) return null;
  const t = deviceType.toLowerCase();
  if (t === 'mobile') return <Smartphone className="w-3 h-3" />;
  if (t === 'tablet') return <Tablet className="w-3 h-3" />;
  return <Monitor className="w-3 h-3" />;
}

// Viewer list reveals this many rows at a time via "Show more".
const VIEWER_PAGE = 10;

const PERIOD_OPTIONS = [
  { value: 'last7days', label: '7 Days' },
  { value: 'last30days', label: '30 Days' },
  { value: 'all', label: 'All Time' }
];

const SORT_OPTIONS = [
  { value: 'last_visit', label: 'Last visit' },
  { value: 'time_spent', label: 'Time spent' },
  { value: 'page_views', label: 'Page views' }
];

const AVATAR_PAIRS = [
  { bg: '#FEF0EF', text: '#D03839' },
  { bg: '#E4F5EC', text: '#0F6E56' },
  { bg: '#FEF3E2', text: '#B5620A' },
  { bg: '#EBF3FC', text: '#4A90E2' },
  { bg: '#F3EEFF', text: '#7C3AED' },
];

function getAvatarPair(seed = '') {
  const str = String(seed || 'G');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_PAIRS[Math.abs(hash) % AVATAR_PAIRS.length];
}

// Engagement score for a buyer — what a wholesaler cares about: did they really
// look at the deal? Weighted by time, photos viewed, repairs read, scrolling,
// and repeat visits. Returns { score, temp } where temp is hot|warm|cold.
function scoreBuyer(b) {
  const duration = b.duration_seconds ?? b.active_time_seconds ?? 0;
  let score = 0;
  score += Math.min(duration / 30, 6);                 // up to 6 for time (>=3min caps)
  score += Math.min((b.images_viewed || 0) * 0.5, 4);  // up to 4 for photos
  score += (b.visit_count || 1) >= 2 ? 3 : 0;          // repeat visit = strong intent
  if (b.viewed_repairs) score += 2;                    // read the repairs = serious
  if (b.scrolled_to_bottom) score += 1;
  if (b.viewed_description) score += 1;
  if (b.offered) score += 6;                           // made an offer = hottest lead
  else if (b.saved) score += 3;                        // saved the deal = strong intent
  const temp = score >= 8 ? 'hot' : score >= 4 ? 'warm' : 'cold';
  return { score, temp };
}

// One actionable, plain-English read on the funnel — what a wholesaler should DO next.
function buildInsight(viewers, saves, offers) {
  if (offers > 0) return { cls: 'bg-[#E4F5EC] border-[#A8DFBA] text-[#0F6E56]', text: `You've received ${offers} offer${offers !== 1 ? 's' : ''} — follow up with your hot buyers below to push this to contract.` };
  if (saves > 0) return { cls: 'bg-[#FEF3E2] border-[#F5D9A0] text-[#B5620A]', text: `${saves} buyer${saves !== 1 ? 's' : ''} saved this but no offers yet — reach out to the hot buyers below before they cool off.` };
  if (viewers >= 10) return { cls: 'bg-[#FEF3E2] border-[#F5D9A0] text-[#B5620A]', text: `${viewers} buyers viewed but none saved or offered — your price may be too high, or the photos/description need strengthening.` };
  if (viewers > 0) return { cls: 'bg-[#F0F0EC] border-[#E8E8E4] text-[#737370]', text: 'Getting some early views — keep sharing the listing to build momentum.' };
  return { cls: 'bg-[#F0F0EC] border-[#E8E8E4] text-[#737370]', text: 'No views yet — share this listing to get it in front of buyers.' };
}

const TEMP_STYLE = {
  hot:  { label: 'Hot',  cls: 'bg-[#FEF0EF] text-[#D03839] border-[#F5C4C0]' },
  warm: { label: 'Warm', cls: 'bg-[#FEF3E2] text-[#B5620A] border-[#F5D9A0]' },
  cold: { label: 'Cold', cls: 'bg-[#F0F0EC] text-[#737370] border-[#E8E8E4]' },
};

function isRealBuyer(row) {
  // Drop guests — wholesalers only care about identified buyers they can follow up with.
  const email = (row.user_email || '').trim().toLowerCase();
  return !!row.user_id || (!!email && email !== 'guest');
}

export default function PropertyAnalyticsSidebar({ propertyId, propertyName, onClose, isEnterprise = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState('all');
  const [sortBy, setSortBy] = useState('last_visit');
  const [sortOpen, setSortOpen] = useState(false);
  // Viewer list is paginated client-side; reveal +VIEWER_PAGE at a time.
  const [visibleViewers, setVisibleViewers] = useState(VIEWER_PAGE);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setVisibleViewers(VIEWER_PAGE);
    const userId = (() => {
      try {
        const s = typeof window !== 'undefined' ? localStorage.getItem('seller_user') : null;
        return s ? JSON.parse(s).id : null;
      } catch {
        return null;
      }
    })();
    if (!userId) {
      setError('Please log in to view analytics.');
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ userId, period, sort: sortBy });
    fetch(`/api/properties/${propertyId}/analytics?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Access denied' : 'Failed to load analytics');
        return res.json();
      })
      .then((json) => { if (!cancelled) setData(json); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load analytics'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId, period, sortBy]);

  const agg = data?.aggregates || {};
  const rawSessions = data?.viewerSessions || [];
  // Wholesalers only follow up with identified buyers — drop guests entirely.
  const sessions = rawSessions.filter(isRealBuyer);

  // Funnel numbers — people-based so the conversion actually means something.
  const totalViews = agg.totalPageViews ?? agg.totalSessionViews ?? 0;
  const uniqueViewers = agg.uniqueViewerCount ?? totalViews;
  const savesCount = agg.savesCount ?? 0;
  const offersCount = agg.offersCount ?? 0;
  const insight = buildInsight(uniqueViewers, savesCount, offersCount);

  // Score + sort buyers hottest-first (unless the user picked an explicit sort)
  const scoredBuyers = sessions
    .map((b) => ({ ...b, _eng: scoreBuyer(b) }))
    .sort((a, b) => {
      if (sortBy === 'time_spent' || sortBy === 'page_views' || sortBy === 'last_visit') {
        // respect explicit sort from the API (already sorted), keep order
        return 0;
      }
      return b._eng.score - a._eng.score;
    });

  function messageBuyer(b) {
    if (!b.user_id) return;
    const params = new URLSearchParams({ buyer_id: b.user_id, property_id: String(propertyId) });
    if (propertyName) params.set('address', propertyName);
    window.location.href = `/messages?${params.toString()}`;
  }

  // Computed aggregates from sessions
  const totalPhotos = sessions.reduce((sum, s) => sum + (Number(s.images_viewed) || 0), 0);
  const durationsWithData = sessions.filter(s => (s.duration_seconds ?? s.active_time_seconds) != null);
  const avgDuration = durationsWithData.length > 0
    ? durationsWithData.reduce((sum, s) => sum + (s.duration_seconds ?? s.active_time_seconds ?? 0), 0) / durationsWithData.length
    : null;

  const sortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';

  // ── Buyer export ──────────────────────────────────────────────────────────
  // Respect enterprise gating: only enterprise sellers can see buyer contact
  // info (the "Message buyer" action is enterprise-only). For non-enterprise
  // sellers we export ONLY what's already visible in the UI — name (which the
  // UI itself derives from email as a fallback), tier/score and engagement —
  // and omit the dedicated email/phone columns entirely.
  function buildBuyerRows() {
    const baseCols = ['Buyer', 'Tier', 'Score', 'Time', 'Visits', 'Saved', 'Offered', 'Last seen'];
    const columns = isEnterprise
      ? [...baseCols.slice(0, 1), 'Email', 'Phone', ...baseCols.slice(1)]
      : baseCols;
    const rows = scoredBuyers.map((b) => {
      const name = displayName(b);
      const duration = b.duration_seconds ?? b.active_time_seconds;
      const tier = TEMP_STYLE[b._eng?.temp]?.label || 'Cold';
      const lastSeen = b.view_end_time || b.view_start_time || b.created_at;
      const base = [
        name,
        tier,
        b._eng ? String(Math.round(b._eng.score * 10) / 10) : '0',
        formatDuration(duration),
        String(b.visit_count || 1),
        b.saved ? 'Yes' : 'No',
        b.offered ? 'Yes' : 'No',
        lastSeen ? formatDateShort(lastSeen) : '—',
      ];
      if (isEnterprise) {
        base.splice(1, 0, b.user_email || '', b.user_phone || '');
      }
      return base;
    });
    return { columns, rows };
  }

  const buyerDateStr = new Date().toISOString().slice(0, 10);
  const buyerSlug = String(propertyName || propertyId || 'property')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'property';
  const buyerFileBase = `deelmap-${buyerSlug}-buyers-${buyerDateStr}`;

  function exportBuyersCSV() {
    const { columns, rows } = buildBuyerRows();
    downloadCSV(`${buyerFileBase}.csv`, { columns, data: rows });
  }

  function exportBuyersPDF() {
    const { columns, rows } = buildBuyerRows();
    downloadPDF(`${buyerFileBase}.pdf`, {
      title: `Interested Buyers — ${propertyName || ''}`.trim(),
      sections: [{ heading: `${rows.length} buyer${rows.length !== 1 ? 's' : ''}`, columns, rows }],
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ease-out ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 bottom-0 w-[480px] min-w-[320px] max-w-full z-50 flex flex-col overflow-hidden bg-white transition-transform duration-300 ease-out ${mounted ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ boxShadow: '-12px 0 40px rgba(0,0,0,0.10)' }}
        aria-label="Property analytics"
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 bg-[#D03839] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-white/70 uppercase tracking-[1.1px] mb-0.5">Property Analytics</p>
                {propertyName && (
                  <h2 className="text-[15px] font-bold text-white leading-snug truncate" title={propertyName}>
                    {propertyName}
                  </h2>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-white/20 hover:bg-white/30 text-white transition-colors duration-200 mt-0.5"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Period filter tabs ── */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-5 py-3 bg-white border-b border-[#E8E8E4]">
          <span className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[1px] mr-1">Period:</span>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`h-7 px-3 rounded text-[12px] font-semibold transition-colors duration-200 ${
                period === opt.value
                  ? 'bg-[#1A1816] text-white'
                  : 'bg-[#FAFAF8] text-[#737370] hover:bg-[#F0F0EC] hover:text-[#1A1816] border border-[#E8E8E4]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto bg-[#FAFAF8]">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-8 h-8 border-2 border-[#E8E8E4] border-t-[#D03839] rounded-full animate-spin" />
              <p className="text-[13px] font-medium text-[#737370]">Loading analytics…</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-5 mt-5 p-4 rounded bg-[#FEF0EF] border border-[#F5C4C0]" role="alert">
              <p className="text-[13px] text-[#D03839] font-semibold">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <div className="p-5 space-y-5">

              {/* ── Deal funnel: Views → Saves → Offers (reads as a pipeline) ── */}
              <div>
                <p className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[0.8px] mb-2">Deal Funnel</p>
                <div className="flex items-stretch">
                  {/* Viewers (unique people) */}
                  <div className="flex-1 bg-white border border-[#E8E8E4] rounded p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1.5">
                      <Eye className="w-3.5 h-3.5 text-[#737370]" />
                      <p className="text-[10px] font-semibold text-[#A8A8A4] uppercase tracking-[0.5px]">Viewers</p>
                    </div>
                    <p className="text-[24px] font-bold text-[#1A1816] leading-none">{uniqueViewers}</p>
                  </div>
                  {/* → */}
                  <div className="flex items-center justify-center px-1 shrink-0">
                    <ChevronRight className="w-4 h-4 text-[#C9C9C4]" />
                  </div>
                  {/* Saves */}
                  <div className="flex-1 bg-white border border-[#E8E8E4] rounded p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1.5">
                      <Heart className="w-3.5 h-3.5 text-[#D03839]" />
                      <p className="text-[10px] font-semibold text-[#A8A8A4] uppercase tracking-[0.5px]">Saves</p>
                    </div>
                    <p className="text-[24px] font-bold text-[#1A1816] leading-none">{savesCount}</p>
                  </div>
                  {/* → */}
                  <div className="flex items-center justify-center px-1 shrink-0">
                    <ChevronRight className="w-4 h-4 text-[#C9C9C4]" />
                  </div>
                  {/* Offers */}
                  <div className="flex-1 bg-white border border-[#E8E8E4] rounded p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#0F6E56]" />
                      <p className="text-[10px] font-semibold text-[#A8A8A4] uppercase tracking-[0.5px]">Offers</p>
                    </div>
                    <p className="text-[24px] font-bold text-[#1A1816] leading-none">{offersCount}</p>
                  </div>
                </div>
                {/* Conversion micro-line */}
                {uniqueViewers > 0 && (
                  <p className="text-[11px] text-[#A8A8A4] mt-2">
                    {savesCount > 0 ? `${Math.min(100, Math.round((savesCount / uniqueViewers) * 100))}% of viewers saved this deal` : 'No saves yet from these viewers'}
                    {totalViews > uniqueViewers ? ` · ${totalViews} total views` : ''}
                  </p>
                )}

                {/* Action insight — the "so what / do this next" line */}
                <div className={`mt-3 flex items-start gap-2 rounded border px-3 py-2.5 ${insight.cls}`}>
                  <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] font-medium leading-snug">{insight.text}</p>
                </div>
              </div>

              {/* ── Viewer Activity ── */}
              <div>
                {/* Section header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full bg-[#D03839] flex-shrink-0" />
                    <h3 className="text-[13px] font-bold text-[#1A1816]">Interested Buyers</h3>
                    <span className="text-[11px] font-semibold text-[#737370] bg-[#F0F0EC] px-2 py-0.5 rounded-full">
                      {scoredBuyers.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                  {/* Export buyers */}
                  {scoredBuyers.length > 0 && (
                    <>
                      <button
                        onClick={exportBuyersCSV}
                        title="Export buyers as CSV"
                        className="flex items-center gap-1 h-7 px-2 bg-white border border-[#E8E8E4] rounded text-[12px] font-semibold text-[#1A1816] hover:border-[#1A1816] transition-colors"
                      >
                        <Download className="w-3 h-3 text-[#737370]" /> CSV
                      </button>
                      <button
                        onClick={exportBuyersPDF}
                        title="Export buyers as PDF"
                        className="flex items-center gap-1 h-7 px-2 bg-white border border-[#E8E8E4] rounded text-[12px] font-semibold text-[#1A1816] hover:border-[#1A1816] transition-colors"
                      >
                        <Download className="w-3 h-3 text-[#737370]" /> PDF
                      </button>
                    </>
                  )}
                  {/* Sort dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setSortOpen(v => !v)}
                      className="flex items-center gap-1.5 h-7 px-2.5 bg-white border border-[#E8E8E4] rounded text-[12px] font-semibold text-[#1A1816] hover:border-[#1A1816] transition-colors"
                    >
                      {sortLabel}
                      <ChevronDown className={`w-3 h-3 text-[#737370] transition-transform duration-200 ${sortOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {sortOpen && (
                      <div className="absolute top-full right-0 mt-1.5 bg-white border border-[#E8E8E4] rounded shadow-lg z-10 w-36 overflow-hidden">
                        {SORT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-[12px] transition-colors hover:bg-[#FAFAF8] ${
                              sortBy === opt.value ? 'font-bold text-[#1A1816]' : 'text-[#444441]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>
                </div>

                {/* Empty state */}
                {scoredBuyers.length === 0 ? (
                  <div className="rounded border border-dashed border-[#E8E8E4] bg-white py-12 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#F0F0EC] flex items-center justify-center mx-auto mb-3">
                      <Eye className="w-5 h-5 text-[#A8A8A4]" />
                    </div>
                    <p className="text-[14px] font-semibold text-[#1A1816] mb-1">No activity yet</p>
                    <p className="text-[12px] text-[#737370] max-w-[200px] mx-auto">
                      When identified buyers view this listing, they'll appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {scoredBuyers.slice(0, visibleViewers).map((row, idx) => {
                      const name = displayName(row);
                      const initial = (name && name !== 'Guest' ? name.charAt(0) : (row.user_email || 'G').charAt(0)).toUpperCase();
                      const avatarPair = getAvatarPair(name);
                      const views = row.page_views != null ? Number(row.page_views) : 0;
                      const duration = row.duration_seconds ?? row.active_time_seconds;
                      const timing = duration != null ? formatDuration(duration) : null;
                      const images = row.images_viewed != null ? Number(row.images_viewed) : 0;
                      const lastSeen = row.view_end_time
                        ? formatDateShort(row.view_end_time)
                        : row.view_start_time
                        ? formatDateShort(row.view_start_time)
                        : row.created_at
                        ? formatDateShort(row.created_at)
                        : null;
                      const device = row.device_type
                        ? row.device_type.toLowerCase() === 'tablet' ? 'Tablet'
                          : row.device_type.toLowerCase() === 'mobile' ? 'Mobile'
                          : 'Desktop'
                        : null;
                      const engagementTags = [];
                      if (row.scrolled_to_bottom) engagementTags.push('Scrolled');
                      if (row.viewed_description) engagementTags.push('Description');
                      if (row.viewed_repairs) engagementTags.push('Repairs');

                      return (
                        <div
                          key={(row.user_email || 'guest') + (row.view_start_time || '') + idx}
                          className="bg-white border border-[#E8E8E4] rounded p-3.5 hover:border-[#D03839]/30 transition-colors duration-200"
                        >
                          <div className="flex gap-3">
                            {/* Avatar */}
                            <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: avatarPair.bg }}>
                              <span className="text-[13px] font-bold" style={{ color: avatarPair.text }}>{initial}</span>
                            </div>

                            <div className="min-w-0 flex-1">
                              {/* Name + lead temp + repeat + source row */}
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
                                <p className="text-[13px] font-bold text-[#1A1816] leading-none capitalize">
                                  {name}
                                </p>
                                {row.offered && (
                                  <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[#E4F5EC] text-[#0F6E56] text-[10px] font-semibold border border-[#A8DFBA]">
                                    <FileText className="w-2.5 h-2.5" /> Offered
                                  </span>
                                )}
                                {row.saved && !row.offered && (
                                  <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[#FEF0EF] text-[#D03839] text-[10px] font-semibold border border-[#F5C4C0]">
                                    <Heart className="w-2.5 h-2.5" /> Saved
                                  </span>
                                )}
                                {(row._eng?.temp === 'hot' || row._eng?.temp === 'warm') && (() => {
                                  const t = TEMP_STYLE[row._eng.temp];
                                  return (
                                    <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold border ${t.cls}`}>
                                      {row._eng.temp === 'hot' && <Flame className="w-2.5 h-2.5" />}
                                      {t.label}
                                    </span>
                                  );
                                })()}
                                {(row.visit_count || 1) > 1 && (
                                  <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[#F0F0EC] text-[#444441] text-[10px] font-semibold border border-[#E8E8E4]">
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    {row.visit_count}× visits
                                  </span>
                                )}
                                {row.utm_source && (
                                  <span className="inline-flex items-center h-5 px-2 rounded-full bg-[#FEF0EF] text-[#D03839] text-[10px] font-semibold capitalize border border-[#F5C4C0]">
                                    {row.utm_source}
                                  </span>
                                )}
                              </div>

                              {/* Stats row */}
                              <div className="flex items-center gap-3 text-[12px] text-[#737370] mb-1.5">
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {views} view{views !== 1 ? 's' : ''}
                                </span>
                                {images > 0 && (
                                  <span className="flex items-center gap-1">
                                    <ImageIcon className="w-3 h-3" />
                                    {images} photo{images !== 1 ? 's' : ''}
                                  </span>
                                )}
                                {timing && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {timing}
                                  </span>
                                )}
                              </div>

                              {/* Engagement tags */}
                              {engagementTags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-1.5">
                                  {engagementTags.map((t) => (
                                    <span
                                      key={t}
                                      className="inline-flex items-center h-5 px-2 rounded-full bg-[#E4F5EC] text-[#0F6E56] text-[10px] font-semibold"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Last seen */}
                              {lastSeen && (
                                <p className="text-[11px] text-[#A8A8A4]">
                                  Last seen: {lastSeen}
                                </p>
                              )}

                              {/* Message button — enterprise plan only, needs an identified buyer */}
                              {isEnterprise && row.user_id && (
                                <button
                                  onClick={() => messageBuyer(row)}
                                  className="mt-2 inline-flex items-center gap-1.5 h-7 px-3 rounded bg-[#1A1816] hover:bg-black text-white text-[11px] font-semibold transition-colors"
                                >
                                  <MessageSquare className="w-3 h-3" /> Message buyer
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {scoredBuyers.length > visibleViewers && (
                      <button
                        type="button"
                        onClick={() => setVisibleViewers(v => v + VIEWER_PAGE)}
                        className="w-full flex items-center justify-center gap-1 py-2.5 text-[12px] font-semibold text-[#D03839] hover:text-[#E0493B] transition-colors"
                      >
                        Show {Math.min(VIEWER_PAGE, scoredBuyers.length - visibleViewers)} more
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </aside>
    </>
  );
}
