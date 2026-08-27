'use client';

import { useState, useEffect } from 'react';
import {
  Eye, Users, Clock, TrendingUp, TrendingDown, Smartphone, Monitor,
  BarChart2, Link2, MapPin, ArrowUpRight, Minus, Activity, Image, FileText,
  ChevronDown, Loader2, Check, Download
} from 'lucide-react';
import { downloadCSV, downloadPDF } from '@/lib/exportData';

function formatDuration(s) {
  if (!s || s === 0) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min ? `${h}h ${min}m` : `${h}h`;
  }
  return sec ? `${m}m ${sec}s` : `${m}m`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function truncate(str, n = 32) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function getPeriodDateRange(period) {
  const now = new Date();
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const day = 86400000;
  if (period === 'last7days') return `${fmt(new Date(now - 7 * day))} – ${fmt(now)}`;
  if (period === 'last30days') return `${fmt(new Date(now - 30 * day))} – ${fmt(now)}`;
  if (period === 'thisMonth') return `${fmt(new Date(now.getFullYear(), now.getMonth(), 1))} – ${fmt(now)}`;
  if (period === 'lastMonth') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return `${fmt(first)} – ${fmt(last)}`;
  }
  return null;
}

// How many top listings to show before the "Show more" toggle.
const TOP_VISIBLE = 6;

const PERIOD_OPTIONS = [
  { value: 'last7days', label: 'Last 7 days' },
  { value: 'last30days', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'all', label: 'All time' },
];

// Monochrome source icons — BW-retro system allows no hue, ever.
const UTM_ICONS = {
  facebook: 'https://cdn.simpleicons.org/facebook/111111',
  fb: 'https://cdn.simpleicons.org/facebook/111111',
  mailchimp: 'https://cdn.simpleicons.org/mailchimp/111111',
  mc: 'https://cdn.simpleicons.org/mailchimp/111111',
  twitter: 'https://cdn.simpleicons.org/x/111111',
  x: 'https://cdn.simpleicons.org/x/111111',
  instagram: 'https://cdn.simpleicons.org/instagram/111111',
  ig: 'https://cdn.simpleicons.org/instagram/111111',
};

function BarChart({ data, valueKey = 'count', labelKey = 'date', height = 120 }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className="flex gap-0.5 w-full" style={{ height }}>
      {data.map((d, i) => {
        const pct = (d[valueKey] / max) * 100;
        const isToday = i === data.length - 1;
        return (
          <div key={i} className="flex-1 h-full flex flex-col justify-end group relative">
            <div
              className={`w-full rounded-t transition-all duration-[120ms] ${isToday ? 'bg-ink' : 'bg-hairline group-hover:bg-smoke-4'}`}
              style={{ height: `${Math.max(pct, 2)}%` }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-ink text-white font-mono text-[10px] px-1.5 py-0.5 rounded-[6px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
              {d[valueKey]} views · {d[labelKey]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ title, value, sub, subUp, icon, iconBg, loading }) {
  return (
    <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 px-4 py-5 flex flex-col">
      <div className="flex items-start justify-between mb-5">
        <p className="font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.12em]">{title}</p>
        <div className="w-8 h-8 rounded-[8px] bg-tint flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      </div>
      {loading ? (
        <div className="h-9 w-20 bg-tint rounded motion-safe:animate-pulse" />
      ) : (
        <>
          <p className="font-display font-bold text-[34px] text-ink leading-none tracking-[-0.02em]">{value}</p>
          {sub != null && (
            <p className={`font-mono text-[11px] font-semibold mt-2 flex items-center gap-1 ${subUp === true ? 'text-ink' : subUp === false ? 'text-ink' : 'text-muted'}`}>
              {subUp === true ? <TrendingUp className="w-3 h-3" /> : subUp === false ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {sub}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function EngagementBar({ label, pct, icon }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-36 shrink-0">
        {icon}
        <span className="text-[12px] text-muted">{label}</span>
      </div>
      <div className="flex-1 h-2 bg-hairline-2 rounded-pill overflow-hidden">
        <div className="h-full bg-ink rounded-pill" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] font-semibold text-ink w-9 text-right shrink-0">{pct}%</span>
    </div>
  );
}

export default function SellerAnalyticsPage() {
  const [period, setPeriod] = useState('last30days');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showAllTop, setShowAllTop] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem('seller_user');
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed?.id) {
          fetch('/api/team/workspaces', { headers: { Authorization: `Bearer ${parsed.id}` } })
            .then(r => r.json())
            .then(ws => {
              const isOwner = !ws?.current?.id || ws?.current?.role === 'admin'
              const hasAccess = isOwner || ws?.current?.permissions?.analytics_view
              if (!hasAccess) { setAccessDenied(true); setLoading(false); return }
              setUserId(parsed.id)
            })
            .catch(() => setUserId(parsed.id))
          return
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!periodOpen) return;
    const handler = () => setPeriodOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [periodOpen]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setShowAllTop(false);
    fetch(`/api/seller/analytics?userId=${encodeURIComponent(userId)}&period=${period}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, period]);

  const s = data?.summary || {};
  const daily = data?.dailyViews || [];
  const topProps = data?.topProperties || [];
  const devices = data?.deviceBreakdown || {};
  const utms = data?.utmBreakdown || [];
  const eng = data?.engagement || {};
  const recent = data?.recentViewers || [];

  // Engagement card empty-state: only show bars when at least one metric is > 0.
  const hasEngagement = (eng.scrolled || 0) > 0 || (eng.viewedPhotos || 0) > 0
    || (eng.viewedDescription || 0) > 0 || (eng.viewedRepairs || 0) > 0;

  const mobileCount = (devices.mobile || 0) + (devices.tablet || 0);
  const totalDevice = mobileCount + (devices.desktop || 0);
  const devicePct = (n) => totalDevice > 0 ? Math.round((n / totalDevice) * 100) : 0;

  // "New": no prior-period views but views this period — show an up-trend "New"
  // instead of nothing. Falls back to "vs prev period" when there's nothing to compare.
  const isNewTrend = s.viewTrend == null && s.prevViews === 0 && (s.totalViews || 0) > 0;
  const trendLabel = s.viewTrend != null
    ? `${s.viewTrend >= 0 ? '+' : ''}${s.viewTrend}% vs prev period`
    : isNewTrend
    ? 'New vs prev period'
    : 'vs prev period';
  const trendUp = s.viewTrend != null ? s.viewTrend >= 0 : isNewTrend ? true : null;

  const maxPropViews = topProps[0]?.views || 1;

  const periodLabel = PERIOD_OPTIONS.find(o => o.value === period)?.label || 'Last 30 days';
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileBase = `deelmap-analytics-${dateStr}`;

  // Shared export sections: KPIs, traffic sources, top listings.
  const kpiRows = [
    ['Total views', (s.totalViews || 0).toLocaleString()],
    ['Unique buyers', (s.uniqueViewers || 0).toLocaleString()],
    ['Total sessions', (s.totalSessions || 0).toLocaleString()],
    ['Avg. time on page', formatDuration(s.avgDuration)],
    ['View trend vs prev period', s.viewTrend != null ? `${s.viewTrend >= 0 ? '+' : ''}${s.viewTrend}%` : isNewTrend ? 'New' : '—'],
    ['Total listings', (data?.totalListings || 0).toLocaleString()],
  ];
  const sourceRows = utms.map(u => [u.source, String(u.count)]);
  const topListingRows = topProps.map((p, i) => [String(i + 1), p.name, String(p.views), String(p.uniqueViewers)]);

  function handleExportCSV() {
    const lines = [];
    const push = (cols) => lines.push(cols);
    push(['DeelMap Analytics', periodLabel]);
    push([]);
    push(['KPIs']);
    push(['Metric', 'Value']);
    kpiRows.forEach(r => push(r));
    push([]);
    push(['Traffic Sources']);
    push(['Source', 'Sessions']);
    (sourceRows.length ? sourceRows : [['No UTM traffic tracked', '']]).forEach(r => push(r));
    push([]);
    push(['Top Listings']);
    push(['Rank', 'Listing', 'Views', 'Unique buyers']);
    (topListingRows.length ? topListingRows : [['', 'No data', '', '']]).forEach(r => push(r));
    downloadCSV(`${fileBase}.csv`, { columns: lines[0], data: lines.slice(1) });
  }

  function handleExportPDF() {
    downloadPDF(`${fileBase}.pdf`, {
      title: `Analytics — ${periodLabel}`,
      sections: [
        { heading: 'KPIs', columns: ['Metric', 'Value'], rows: kpiRows },
        { heading: 'Traffic Sources', columns: ['Source', 'Sessions'], rows: sourceRows.length ? sourceRows : [['No UTM traffic tracked', '—']] },
        { heading: 'Top Listings', columns: ['#', 'Listing', 'Views', 'Unique buyers'], rows: topListingRows.length ? topListingRows : [['', 'No data', '', '']] },
      ],
    });
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-tint-3 flex items-center justify-center p-6">
        <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 p-10 text-center max-w-sm">
          <div className="w-12 h-12 bg-tint rounded-[10px] flex items-center justify-center mx-auto mb-4">
            <BarChart2 className="w-6 h-6 text-mist" />
          </div>
          <h2 className="font-display font-bold text-[17px] tracking-[-0.01em] text-ink mb-2">Admin access required</h2>
          <p className="text-[13px] text-muted leading-relaxed">Analytics is only available to workspace admins. Contact your team admin for access.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-tint-3 p-4 lg:p-6" style={{ fontFamily: 'var(--font-instrument), sans-serif' }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 text-ink mb-1">
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em]">Reporting</span>
          </div>
          <h1 className="font-display font-bold text-[26px] md:text-[29px] leading-[1.1] tracking-[-0.025em] text-ink">Analytics</h1>
          <p className="text-[13px] text-muted mt-0.5">Buyer engagement across all your listings</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loading && <Loader2 className="w-4 h-4 text-mist motion-safe:animate-spin" />}
          {/* Export controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={loading || !data}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border-[1.5px] border-ink rounded-[10px] shadow-offset-2 text-[13px] font-semibold text-ink hover:bg-tint transition-all duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5 text-muted" />
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={loading || !data}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border-[1.5px] border-ink rounded-[10px] shadow-offset-2 text-[13px] font-semibold text-ink hover:bg-tint transition-all duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5 text-muted" />
              PDF
            </button>
          </div>
          {/* Custom period dropdown */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPeriodOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-white border-[1.5px] border-ink rounded-[10px] shadow-offset-2 text-left hover:bg-tint transition-all duration-[120ms]"
            >
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-ink leading-tight whitespace-nowrap">
                  {PERIOD_OPTIONS.find(o => o.value === period)?.label || 'Last 30 days'}
                </p>
                {getPeriodDateRange(period) && (
                  <p className="font-mono text-[10px] text-muted leading-tight whitespace-nowrap mt-0.5">
                    {getPeriodDateRange(period)}
                  </p>
                )}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-mist shrink-0 transition-transform ${periodOpen ? 'rotate-180' : ''}`} />
            </button>
            {periodOpen && (
              <div className="absolute right-0 top-full mt-1.5 bg-white border-[1.5px] border-ink rounded-[10px] shadow-offset-4 z-20 overflow-hidden min-w-[180px]">
                {PERIOD_OPTIONS.map(o => {
                  const range = getPeriodDateRange(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => { setPeriod(o.value); setPeriodOpen(false); }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-[120ms] ${
                        period === o.value
                          ? 'bg-hairline-2 text-ink'
                          : 'text-ink hover:bg-tint'
                      }`}
                    >
                      <div>
                        <p className={`text-[13px] leading-tight ${period === o.value ? 'font-semibold' : 'font-medium'}`}>{o.label}</p>
                        {range && <p className={`font-mono text-[10px] leading-tight mt-0.5 ${period === o.value ? 'text-smoke-3' : 'text-muted'}`}>{range}</p>}
                      </div>
                      {period === o.value && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          title="Total views"
          value={loading ? '—' : (s.totalViews || 0).toLocaleString()}
          sub={trendLabel}
          subUp={trendUp}
          icon={<Eye className="w-4 h-4 text-ink" />}
          iconBg="#f2f2f2"
          loading={loading}
        />
        <StatCard
          title="Unique buyers"
          value={loading ? '—' : (s.uniqueViewers || 0).toLocaleString()}
          sub={`${s.totalSessions || 0} total sessions`}
          subUp={null}
          icon={<Users className="w-4 h-4 text-muted" />}
          iconBg="#f2f2f2"
          loading={loading}
        />
        <StatCard
          title="Avg. time on page"
          value={loading ? '—' : formatDuration(s.avgDuration)}
          sub="Per session"
          subUp={null}
          icon={<Clock className="w-4 h-4 text-smoke-3" />}
          iconBg="#f2f2f2"
          loading={loading}
        />
        <StatCard
          title="Total listings"
          value={loading ? '—' : (data?.totalListings || 0).toLocaleString()}
          sub={`${topProps.length} with view activity`}
          subUp={null}
          icon={<Activity className="w-4 h-4 text-ink" />}
          iconBg="#f2f2f2"
          loading={loading}
        />
      </div>

      {/* Row 2: Daily chart + Top properties */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">

        {/* Daily views chart */}
        <div className="lg:col-span-3 bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-[15px] tracking-[-0.01em] text-ink">Views over time</h2>
              <p className="font-mono text-[10.5px] text-muted uppercase tracking-[0.06em]">
                {PERIOD_OPTIONS.find(o => o.value === period)?.label || 'Last 30 days'}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display font-bold text-[22px] text-ink leading-none">{(s.totalViews || 0).toLocaleString()}</p>
              {s.viewTrend != null ? (
                <p className="font-mono text-[11px] font-semibold flex items-center gap-0.5 justify-end mt-0.5 text-ink">
                  {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {trendUp ? '+' : ''}{s.viewTrend}%
                </p>
              ) : isNewTrend ? (
                <p className="font-mono text-[11px] font-semibold flex items-center gap-0.5 justify-end mt-0.5 text-ink">
                  <TrendingUp className="w-3 h-3" />
                  New
                </p>
              ) : null}
            </div>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="h-[120px] bg-tint rounded motion-safe:animate-pulse" />
            ) : daily.length === 0 || daily.every(d => d.count === 0) ? (
              <div className="h-[120px] flex items-center justify-center">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">No views recorded for this period</p>
              </div>
            ) : (
              <>
                <BarChart data={daily} valueKey="count" labelKey="date" height={120} />
                <div className="flex items-center justify-between mt-2">
                  <p className="font-mono text-[10.5px] text-muted">{formatDateShort(daily[0]?.date)}</p>
                  <p className="font-mono text-[10.5px] text-muted">Today</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Top properties */}
        <div className="lg:col-span-2 bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline">
            <h2 className="font-display font-semibold text-[15px] tracking-[-0.01em] text-ink">Top listings</h2>
            <p className="font-mono text-[10.5px] text-muted uppercase tracking-[0.06em]">By views this period</p>
          </div>
          <div className="p-4 space-y-3">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-tint rounded motion-safe:animate-pulse" />
              ))
            ) : topProps.length === 0 ? (
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted py-6 text-center">No data yet</p>
            ) : (showAllTop ? topProps : topProps.slice(0, TOP_VISIBLE)).map((p, i) => {
              const pct = Math.round((p.views / maxPropViews) * 100);
              return (
                <a
                  key={p.id}
                  href={`/properties?analytics=${encodeURIComponent(p.id)}`}
                  className="block -mx-2 px-2 py-1 rounded-[8px] group cursor-pointer hover:bg-tint transition-colors duration-[120ms]"
                  title={`View analytics for ${p.name}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-[11px] font-semibold text-muted w-4 shrink-0">{i + 1}</span>
                      <p className="text-[12px] font-medium text-ink truncate transition-colors duration-[120ms]" title={p.name}>{truncate(p.name, 28)}</p>
                      <ArrowUpRight className="w-3 h-3 text-mist shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="font-mono text-[12px] font-semibold text-ink shrink-0">{p.views}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-5">
                    <div className="flex-1 h-1.5 bg-hairline-2 rounded-pill overflow-hidden">
                      <div className="h-full bg-ink rounded-pill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-muted shrink-0">{p.uniqueViewers} buyers</span>
                  </div>
                </a>
              );
            })}
            {!loading && topProps.length > TOP_VISIBLE && (
              <button
                type="button"
                onClick={() => setShowAllTop(v => !v)}
                className="w-full flex items-center justify-center gap-1 pt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-ink hover:text-smoke-2 transition-colors duration-[120ms]"
              >
                {showAllTop ? 'Show less' : `Show ${topProps.length - TOP_VISIBLE} more`}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllTop ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Devices + UTM + Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Device breakdown */}
        <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline">
            <h2 className="font-display font-semibold text-[15px] tracking-[-0.01em] text-ink">Devices</h2>
          </div>
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="h-24 bg-tint rounded motion-safe:animate-pulse" />
            ) : totalDevice === 0 ? (
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted text-center py-4">No data</p>
            ) : (
              <>
                {[
                  { label: 'Mobile', count: mobileCount, icon: <Smartphone className="w-3.5 h-3.5 text-muted" /> },
                  { label: 'Desktop', count: devices.desktop || 0, icon: <Monitor className="w-3.5 h-3.5 text-muted" /> },
                ].map(({ label, count, icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-20 shrink-0">
                      {icon}
                      <span className="text-[12px] text-muted">{label}</span>
                    </div>
                    <div className="flex-1 h-2 bg-hairline-2 rounded-pill overflow-hidden">
                      <div className="h-full bg-ink rounded-pill" style={{ width: `${devicePct(count)}%` }} />
                    </div>
                    <div className="text-right shrink-0 w-14">
                      <span className="font-mono text-[11px] font-semibold text-ink">{devicePct(count)}%</span>
                      <span className="font-mono text-[10px] text-muted ml-1">({count})</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* UTM sources */}
        <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-ink" />
            <h2 className="font-display font-semibold text-[15px] tracking-[-0.01em] text-ink">Traffic sources</h2>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="h-24 bg-tint rounded motion-safe:animate-pulse" />
            ) : utms.length === 0 ? (
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted text-center py-4">No UTM traffic tracked yet</p>
            ) : (
              <div className="space-y-3">
                {utms.map(({ source, count }) => {
                  const icon = UTM_ICONS[source.toLowerCase()];
                  const maxUtm = utms[0]?.count || 1;
                  return (
                    <div key={source} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 w-24 shrink-0">
                        {icon && <img src={icon} alt="" className="w-3.5 h-3.5 shrink-0" />}
                        <span className="text-[12px] text-muted capitalize">{source}</span>
                      </div>
                      <div className="flex-1 h-2 bg-hairline-2 rounded-pill overflow-hidden">
                        <div className="h-full bg-ink rounded-pill" style={{ width: `${Math.round((count / maxUtm) * 100)}%` }} />
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-ink w-6 text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Buyer engagement */}
        <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline">
            <h2 className="font-display font-semibold text-[15px] tracking-[-0.01em] text-ink">Buyer engagement</h2>
            <p className="font-mono text-[10.5px] text-muted uppercase tracking-[0.06em]">% of sessions where buyers</p>
          </div>
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="h-24 bg-tint rounded motion-safe:animate-pulse" />
            ) : !hasEngagement ? (
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted text-center py-4">No engagement yet</p>
            ) : (
              <>
                <EngagementBar label="Scrolled" pct={eng.scrolled || 0} icon={<ChevronDown className="w-3.5 h-3.5 text-mist" />} />
                <EngagementBar label="Viewed photos" pct={eng.viewedPhotos || 0} icon={<Image className="w-3.5 h-3.5 text-mist" />} />
                <EngagementBar label="Read description" pct={eng.viewedDescription || 0} icon={<FileText className="w-3.5 h-3.5 text-mist" />} />
                <EngagementBar label="Viewed repairs" pct={eng.viewedRepairs || 0} icon={<Activity className="w-3.5 h-3.5 text-mist" />} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent viewers table */}
      <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-hairline">
          <h2 className="font-display font-semibold text-[15px] tracking-[-0.01em] text-ink">Recent buyer activity</h2>
          <p className="font-mono text-[10.5px] text-muted uppercase tracking-[0.06em]">Most recent sessions across all listings</p>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-tint rounded motion-safe:animate-pulse" />)}
          </div>
        ) : recent.length === 0 ? (
          <div className="py-16 text-center">
            <Eye className="w-8 h-8 text-line-2 mx-auto mb-2" />
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">No activity yet</p>
            <p className="text-[12px] text-muted mt-1 mb-4">Share your listings to start getting buyer views.</p>
            <a href="/properties" className="inline-flex items-center gap-1.5 h-9 px-4 bg-ink hover:bg-smoke-2 text-white text-[13px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 transition-all duration-[120ms]">
              Go to My Listings
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-hairline bg-tint-2">
                  {['Buyer', 'Listing', 'Views', 'Time spent', 'Device', 'Source', 'Last seen'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-mono text-[10px] font-semibold text-muted uppercase tracking-[0.12em] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline-2">
                {recent.map((r, i) => {
                  const name = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email || 'Guest';
                  const initial = name.charAt(0).toUpperCase();
                  const utmIcon = r.utmSource ? UTM_ICONS[r.utmSource.toLowerCase()] : null;
                  return (
                    <tr key={i} className="hover:bg-tint transition-colors duration-[120ms]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-tint flex items-center justify-center flex-shrink-0">
                            <span className="font-mono text-[11px] font-semibold text-ink">{initial}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-ink truncate capitalize">{name}</p>
                            {r.email && name !== r.email && (
                              <p className="font-mono text-[10px] text-muted truncate">{r.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] text-smoke-2 truncate max-w-[160px]" title={r.propertyName}>{truncate(r.propertyName, 24)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[12px] font-semibold text-ink">{r.views}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-muted">{formatDuration(r.duration)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-[12px] text-muted">
                          {(r.device?.toLowerCase() === 'mobile' || r.device?.toLowerCase() === 'tablet') && <Smartphone className="w-3 h-3" />}
                          {r.device?.toLowerCase() === 'desktop' && <Monitor className="w-3 h-3" />}
                          <span className="capitalize">{r.device?.toLowerCase() === 'tablet' ? 'Mobile' : (r.device || '—')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.utmSource ? (
                          <div className="flex items-center gap-1">
                            {utmIcon && <img src={utmIcon} alt="" className="w-3.5 h-3.5" />}
                            <span className="text-[12px] text-muted capitalize">{r.utmSource}</span>
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] text-mist">Direct</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-muted">{formatDate(r.lastSeen)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
