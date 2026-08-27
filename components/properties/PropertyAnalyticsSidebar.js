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
  { bg: '#f2f2f2', text: '#111111' },
  { bg: '#f2f2f2', text: '#111111' },
  { bg: '#f2f2f2', text: '#555555' },
  { bg: '#f2f2f2', text: '#757575' },
  { bg: '#f2f2f2', text: '#444444' },
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
  if (offers > 0) return { cls: 'bg-tint border-ink text-ink', text: `You've received ${offers} offer${offers !== 1 ? 's' : ''} — follow up with your hot buyers below to push this to contract.` };
  if (saves > 0) return { cls: 'bg-tint border-ink text-ink', text: `${saves} buyer${saves !== 1 ? 's' : ''} saved this but no offers yet — reach out to the hot buyers below before they cool off.` };
  if (viewers >= 10) return { cls: 'bg-tint border-line text-smoke-3', text: `${viewers} buyers viewed but none saved or offered — your price may be too high, or the photos/description need strengthening.` };
  if (viewers > 0) return { cls: 'bg-tint-2 border-hairline text-muted', text: 'Getting some early views — keep sharing the listing to build momentum.' };
  return { cls: 'bg-tint-2 border-hairline text-muted', text: 'No views yet — share this listing to get it in front of buyers.' };
}

const TEMP_STYLE = {
  hot:  { label: 'Hot',  cls: 'bg-ink text-white border-ink' },
  warm: { label: 'Warm', cls: 'bg-muted text-white border-muted' },
  cold: { label: 'Cold', cls: 'bg-mist text-white border-mist' },
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
        className="fixed inset-0 z-40 bg-ink/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className="fixed top-0 right-0 bottom-0 w-[480px] min-w-[320px] max-w-full z-50 flex flex-col overflow-hidden bg-white border-l-[1.5px] border-ink"
        aria-label="Property analytics"
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 bg-ink px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold text-mist uppercase tracking-[0.14em] mb-0.5">Property Analytics</p>
                {propertyName && (
                  <h2 className="font-display text-[15px] font-bold tracking-[-0.01em] text-white leading-snug truncate" title={propertyName}>
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
        <div className="flex-shrink-0 flex items-center gap-1.5 px-5 py-3 bg-white border-b-[1.5px] border-ink">
          <span className="font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.12em] mr-1">Period:</span>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`h-7 px-3 rounded-pill font-mono text-[11px] font-semibold tracking-[0.06em] border-[1.5px] border-ink transition-colors duration-120 ${
                period === opt.value
                  ? 'bg-ink text-white'
                  : 'bg-white text-ink hover:bg-tint'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto bg-tint-3">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-8 h-8 border-2 border-hairline border-t-ink rounded-full motion-safe:animate-spin" />
              <p className="text-[13px] font-medium text-muted">Loading analytics…</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-5 mt-5 p-4 rounded-[10px] bg-tint border-[1.5px] border-ink" role="alert">
              <p className="text-[13px] text-ink font-semibold">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <div className="p-5 space-y-5">

              {/* ── Deal funnel: Views → Saves → Offers (reads as a pipeline) ── */}
              <div>
                <p className="font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.14em] mb-2">Deal Funnel</p>
                <div className="flex items-stretch">
                  {/* Viewers (unique people) */}
                  <div className="flex-1 bg-white border-[1.5px] border-ink rounded-[12px] p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1.5">
                      <Eye className="w-3.5 h-3.5 text-muted" />
                      <p className="font-mono text-[10px] font-semibold text-muted uppercase tracking-[0.08em]">Viewers</p>
                    </div>
                    <p className="font-display text-[24px] font-bold text-body leading-none">{uniqueViewers}</p>
                  </div>
                  {/* → */}
                  <div className="flex items-center justify-center px-1 shrink-0">
                    <ChevronRight className="w-4 h-4 text-mist" />
                  </div>
                  {/* Saves */}
                  <div className="flex-1 bg-white border-[1.5px] border-ink rounded-[12px] p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1.5">
                      <Heart className="w-3.5 h-3.5 text-ink" />
                      <p className="font-mono text-[10px] font-semibold text-muted uppercase tracking-[0.08em]">Saves</p>
                    </div>
                    <p className="font-display text-[24px] font-bold text-body leading-none">{savesCount}</p>
                  </div>
                  {/* → */}
                  <div className="flex items-center justify-center px-1 shrink-0">
                    <ChevronRight className="w-4 h-4 text-mist" />
                  </div>
                  {/* Offers */}
                  <div className="flex-1 bg-white border-[1.5px] border-ink rounded-[12px] p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-ink" />
                      <p className="font-mono text-[10px] font-semibold text-muted uppercase tracking-[0.08em]">Offers</p>
                    </div>
                    <p className="font-display text-[24px] font-bold text-body leading-none">{offersCount}</p>
                  </div>
                </div>
                {/* Conversion micro-line */}
                {uniqueViewers > 0 && (
                  <p className="font-mono text-[11px] text-mist mt-2">
                    {savesCount > 0 ? `${Math.min(100, Math.round((savesCount / uniqueViewers) * 100))}% of viewers saved this deal` : 'No saves yet from these viewers'}
                    {totalViews > uniqueViewers ? ` · ${totalViews} total views` : ''}
                  </p>
                )}

                {/* Action insight — the "so what / do this next" line */}
                <div className={`mt-3 flex items-start gap-2 rounded-[10px] border-[1.5px] px-3 py-2.5 ${insight.cls}`}>
                  <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] font-medium leading-snug">{insight.text}</p>
                </div>
              </div>

              {/* ── Viewer Activity ── */}
              <div>
                {/* Section header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-4 rounded-pill bg-ink flex-shrink-0" />
                    <h3 className="font-display text-[13px] font-bold text-body">Interested Buyers</h3>
                    <span className="font-mono text-[11px] font-semibold text-ink bg-tint px-2 py-0.5 rounded-pill">
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
                        className="flex items-center gap-1 h-7 px-2 bg-white border-[1.5px] border-ink rounded-[8px] font-mono text-[11px] font-semibold text-ink hover:bg-tint transition-colors duration-120"
                      >
                        <Download className="w-3 h-3 text-muted" /> CSV
                      </button>
                      <button
                        onClick={exportBuyersPDF}
                        title="Export buyers as PDF"
                        className="flex items-center gap-1 h-7 px-2 bg-white border-[1.5px] border-ink rounded-[8px] font-mono text-[11px] font-semibold text-ink hover:bg-tint transition-colors duration-120"
                      >
                        <Download className="w-3 h-3 text-muted" /> PDF
                      </button>
                    </>
                  )}
                  {/* Sort dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setSortOpen(v => !v)}
                      className="flex items-center gap-1.5 h-7 px-2.5 bg-white border-[1.5px] border-ink rounded-[8px] text-[12px] font-semibold text-ink hover:bg-tint transition-colors duration-120"
                    >
                      {sortLabel}
                      <ChevronDown className={`w-3 h-3 text-muted transition-transform duration-120 ${sortOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {sortOpen && (
                      <div className="absolute top-full right-0 mt-1.5 bg-white border-[1.5px] border-ink rounded-[10px] shadow-offset-3 z-10 w-36 overflow-hidden">
                        {SORT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-[12px] transition-colors duration-120 hover:bg-tint ${
                              sortBy === opt.value ? 'font-bold text-ink' : 'text-smoke-2'
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
                  <div className="rounded-[12px] border-[1.5px] border-dashed border-line bg-white py-12 text-center">
                    <div className="w-10 h-10 rounded-pill bg-tint flex items-center justify-center mx-auto mb-3">
                      <Eye className="w-5 h-5 text-mist" />
                    </div>
                    <p className="text-[14px] font-semibold text-body mb-1">No activity yet</p>
                    <p className="text-[12px] text-muted max-w-[200px] mx-auto">
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
                          className="bg-white border-[1.5px] border-ink rounded-[12px] p-3.5 hover:bg-tint-3 transition-colors duration-120"
                        >
                          <div className="flex gap-3">
                            {/* Avatar */}
                            <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: avatarPair.bg }}>
                              <span className="text-[13px] font-bold" style={{ color: avatarPair.text }}>{initial}</span>
                            </div>

                            <div className="min-w-0 flex-1">
                              {/* Name + lead temp + repeat + source row */}
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
                                <p className="text-[13px] font-bold text-body leading-none capitalize">
                                  {name}
                                </p>
                                {row.offered && (
                                  <span className="inline-flex items-center gap-1 h-5 px-2 rounded-pill bg-ink text-white font-mono text-[10px] font-semibold uppercase tracking-[0.05em] border border-ink">
                                    <FileText className="w-2.5 h-2.5" /> Offered
                                  </span>
                                )}
                                {row.saved && !row.offered && (
                                  <span className="inline-flex items-center gap-1 h-5 px-2 rounded-pill bg-tint text-ink font-mono text-[10px] font-semibold uppercase tracking-[0.05em] border border-ink">
                                    <Heart className="w-2.5 h-2.5" /> Saved
                                  </span>
                                )}
                                {(row._eng?.temp === 'hot' || row._eng?.temp === 'warm') && (() => {
                                  const t = TEMP_STYLE[row._eng.temp];
                                  return (
                                    <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-pill font-mono text-[10px] font-semibold uppercase tracking-[0.05em] border ${t.cls}`}>
                                      {row._eng.temp === 'hot' && <Flame className="w-2.5 h-2.5" />}
                                      {t.label}
                                    </span>
                                  );
                                })()}
                                {(row.visit_count || 1) > 1 && (
                                  <span className="inline-flex items-center gap-1 h-5 px-2 rounded-pill bg-tint text-smoke-2 font-mono text-[10px] font-semibold border border-line">
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    {row.visit_count}× visits
                                  </span>
                                )}
                                {row.utm_source && (
                                  <span className="inline-flex items-center h-5 px-2 rounded-pill bg-tint text-ink font-mono text-[10px] font-semibold capitalize border border-line">
                                    {row.utm_source}
                                  </span>
                                )}
                              </div>

                              {/* Stats row */}
                              <div className="flex items-center gap-3 font-mono text-[11px] text-muted mb-1.5">
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
                                      className="inline-flex items-center h-5 px-2 rounded-pill bg-tint text-ink font-mono text-[10px] font-semibold"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Last seen */}
                              {lastSeen && (
                                <p className="font-mono text-[10.5px] text-mist">
                                  Last seen: {lastSeen}
                                </p>
                              )}

                              {/* Message button — enterprise plan only, needs an identified buyer */}
                              {isEnterprise && row.user_id && (
                                <button
                                  onClick={() => messageBuyer(row)}
                                  className="mt-2 inline-flex items-center gap-1.5 h-7 px-3 rounded-[8px] bg-ink hover:bg-smoke-2 text-white border border-ink text-[11px] font-semibold transition-colors duration-120"
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
                        className="w-full flex items-center justify-center gap-1 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-ink hover:text-smoke-2 transition-colors duration-120"
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
