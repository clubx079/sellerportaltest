'use client';

import { useState, useEffect } from 'react';
import {
  Eye, Users, Clock, TrendingUp, TrendingDown, Smartphone, Monitor,
  BarChart2, Link2, MapPin, ArrowUpRight, Minus, Activity, Image, FileText,
  ChevronDown, Loader2, Check
} from 'lucide-react';

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

const PERIOD_OPTIONS = [
  { value: 'last7days', label: 'Last 7 days' },
  { value: 'last30days', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'all', label: 'All time' },
];

const UTM_ICONS = {
  facebook: 'https://cdn.simpleicons.org/facebook/1877F2',
  fb: 'https://cdn.simpleicons.org/facebook/1877F2',
  mailchimp: 'https://cdn.simpleicons.org/mailchimp/FFE01B',
  mc: 'https://cdn.simpleicons.org/mailchimp/FFE01B',
  twitter: 'https://cdn.simpleicons.org/x/000000',
  x: 'https://cdn.simpleicons.org/x/000000',
  instagram: 'https://cdn.simpleicons.org/instagram/E4405F',
  ig: 'https://cdn.simpleicons.org/instagram/E4405F',
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
              className={`w-full rounded-t transition-all ${isToday ? 'bg-[#D03839]' : 'bg-[#E8E8E4] group-hover:bg-[#D03839]/50'}`}
              style={{ height: `${Math.max(pct, 2)}%` }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#1A1816] text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
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
    <div className="bg-white border border-[#E8E8E4] rounded px-4 py-5 flex flex-col">
      <div className="flex items-start justify-between mb-5">
        <p className="text-[13px] font-medium text-[#737370]">{title}</p>
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: iconBg }}>
          {icon}
        </div>
      </div>
      {loading ? (
        <div className="h-9 w-20 bg-[#F0F0EE] rounded animate-pulse" />
      ) : (
        <>
          <p className="text-[36px] font-bold text-[#1A1816] leading-none tracking-tight">{value}</p>
          {sub != null && (
            <p className={`text-[12px] font-medium mt-2 flex items-center gap-1 ${subUp === true ? 'text-[#0F6E56]' : subUp === false ? 'text-[#D03839]' : 'text-[#737370]'}`}>
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
        <span className="text-[12px] text-[#737370]">{label}</span>
      </div>
      <div className="flex-1 h-2 bg-[#F0F0EE] rounded-full overflow-hidden">
        <div className="h-full bg-[#D03839] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] font-semibold text-[#1A1816] w-9 text-right shrink-0">{pct}%</span>
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

  const mobileCount = (devices.mobile || 0) + (devices.tablet || 0);
  const totalDevice = mobileCount + (devices.desktop || 0);
  const devicePct = (n) => totalDevice > 0 ? Math.round((n / totalDevice) * 100) : 0;

  const trendLabel = s.viewTrend != null
    ? `${s.viewTrend >= 0 ? '+' : ''}${s.viewTrend}% vs prev period`
    : 'vs prev period';
  const trendUp = s.viewTrend != null ? s.viewTrend >= 0 : null;

  const maxPropViews = topProps[0]?.views || 1;

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E8E8E4] rounded p-10 text-center max-w-sm">
          <div className="w-12 h-12 bg-[#F3F3F0] rounded flex items-center justify-center mx-auto mb-4">
            <BarChart2 className="w-6 h-6 text-[#A8A8A4]" />
          </div>
          <h2 className="text-[16px] font-bold text-[#1A1816] mb-2">Admin access required</h2>
          <p className="text-[13px] text-[#737370] leading-relaxed">Analytics is only available to workspace admins. Contact your team admin for access.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] p-4 lg:p-6" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 text-[#737370] mb-0.5">
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold uppercase tracking-[1px]">Reporting</span>
          </div>
          <h1 className="text-[22px] font-bold text-[#1A1816] tracking-tight">Analytics</h1>
          <p className="text-[13px] text-[#737370] mt-0.5">Buyer engagement across all your listings</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loading && <Loader2 className="w-4 h-4 text-[#A8A8A4] animate-spin" />}
          {/* Custom period dropdown */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPeriodOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E8E8E4] rounded text-left hover:bg-[#FAFAF8] transition-colors"
            >
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#1A1816] leading-tight whitespace-nowrap">
                  {PERIOD_OPTIONS.find(o => o.value === period)?.label || 'Last 30 days'}
                </p>
                {getPeriodDateRange(period) && (
                  <p className="text-[11px] text-[#A8A8A4] leading-tight whitespace-nowrap mt-0.5">
                    {getPeriodDateRange(period)}
                  </p>
                )}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-[#A8A8A4] shrink-0 transition-transform ${periodOpen ? 'rotate-180' : ''}`} />
            </button>
            {periodOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E4] rounded shadow-lg z-20 overflow-hidden min-w-[180px]">
                {PERIOD_OPTIONS.map(o => {
                  const range = getPeriodDateRange(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => { setPeriod(o.value); setPeriodOpen(false); }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
                        period === o.value
                          ? 'bg-[#FEF0EF] text-[#D03839]'
                          : 'text-[#1A1816] hover:bg-[#FAFAF8]'
                      }`}
                    >
                      <div>
                        <p className={`text-[13px] leading-tight ${period === o.value ? 'font-semibold' : 'font-medium'}`}>{o.label}</p>
                        {range && <p className={`text-[11px] leading-tight mt-0.5 ${period === o.value ? 'text-[#D03839]/70' : 'text-[#A8A8A4]'}`}>{range}</p>}
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
          icon={<Eye className="w-4 h-4 text-[#D03839]" />}
          iconBg="#FEF0EF"
          loading={loading}
        />
        <StatCard
          title="Unique buyers"
          value={loading ? '—' : (s.uniqueViewers || 0).toLocaleString()}
          sub={`${s.totalSessions || 0} total sessions`}
          subUp={null}
          icon={<Users className="w-4 h-4 text-[#4A90E2]" />}
          iconBg="#EBF3FC"
          loading={loading}
        />
        <StatCard
          title="Avg. time on page"
          value={loading ? '—' : formatDuration(s.avgDuration)}
          sub="Per session"
          subUp={null}
          icon={<Clock className="w-4 h-4 text-[#B5620A]" />}
          iconBg="#FEF3E2"
          loading={loading}
        />
        <StatCard
          title="Total listings"
          value={loading ? '—' : (data?.totalListings || 0).toLocaleString()}
          sub={`${topProps.length} with view activity`}
          subUp={null}
          icon={<Activity className="w-4 h-4 text-[#0F6E56]" />}
          iconBg="#E4F5EC"
          loading={loading}
        />
      </div>

      {/* Row 2: Daily chart + Top properties */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">

        {/* Daily views chart */}
        <div className="lg:col-span-3 bg-white border border-[#E8E8E4] rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E8E4] flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-semibold text-[#1A1816]">Views over time</h2>
              <p className="text-[11px] text-[#A8A8A4]">
                {PERIOD_OPTIONS.find(o => o.value === period)?.label || 'Last 30 days'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[22px] font-bold text-[#1A1816] leading-none">{(s.totalViews || 0).toLocaleString()}</p>
              {s.viewTrend != null && (
                <p className={`text-[11px] font-medium flex items-center gap-0.5 justify-end mt-0.5 ${trendUp ? 'text-[#0F6E56]' : 'text-[#D03839]'}`}>
                  {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {trendUp ? '+' : ''}{s.viewTrend}%
                </p>
              )}
            </div>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="h-[120px] bg-[#F0F0EE] rounded animate-pulse" />
            ) : daily.length === 0 || daily.every(d => d.count === 0) ? (
              <div className="h-[120px] flex items-center justify-center">
                <p className="text-[13px] text-[#A8A8A4]">No views recorded for this period</p>
              </div>
            ) : (
              <>
                <BarChart data={daily} valueKey="count" labelKey="date" height={120} />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[11px] text-[#A8A8A4]">{formatDateShort(daily[0]?.date)}</p>
                  <p className="text-[11px] text-[#A8A8A4]">Today</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Top properties */}
        <div className="lg:col-span-2 bg-white border border-[#E8E8E4] rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E8E4]">
            <h2 className="text-[13px] font-semibold text-[#1A1816]">Top listings</h2>
            <p className="text-[11px] text-[#A8A8A4]">By views this period</p>
          </div>
          <div className="p-4 space-y-3">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-[#F0F0EE] rounded animate-pulse" />
              ))
            ) : topProps.length === 0 ? (
              <p className="text-[13px] text-[#A8A8A4] py-6 text-center">No data yet</p>
            ) : topProps.map((p, i) => {
              const pct = Math.round((p.views / maxPropViews) * 100);
              return (
                <div key={p.id}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-bold text-[#A8A8A4] w-4 shrink-0">{i + 1}</span>
                      <p className="text-[12px] font-medium text-[#1A1816] truncate" title={p.name}>{truncate(p.name, 28)}</p>
                    </div>
                    <span className="text-[12px] font-bold text-[#1A1816] shrink-0">{p.views}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-5">
                    <div className="flex-1 h-1.5 bg-[#F0F0EE] rounded-full overflow-hidden">
                      <div className="h-full bg-[#D03839] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-[#A8A8A4] shrink-0">{p.uniqueViewers} buyers</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Devices + UTM + Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Device breakdown */}
        <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E8E4]">
            <h2 className="text-[13px] font-semibold text-[#1A1816]">Devices</h2>
          </div>
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="h-24 bg-[#F0F0EE] rounded animate-pulse" />
            ) : totalDevice === 0 ? (
              <p className="text-[13px] text-[#A8A8A4] text-center py-4">No data</p>
            ) : (
              <>
                {[
                  { label: 'Mobile', count: mobileCount, icon: <Smartphone className="w-3.5 h-3.5 text-[#737370]" /> },
                  { label: 'Desktop', count: devices.desktop || 0, icon: <Monitor className="w-3.5 h-3.5 text-[#737370]" /> },
                ].map(({ label, count, icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-20 shrink-0">
                      {icon}
                      <span className="text-[12px] text-[#737370]">{label}</span>
                    </div>
                    <div className="flex-1 h-2 bg-[#F0F0EE] rounded-full overflow-hidden">
                      <div className="h-full bg-[#D03839] rounded-full" style={{ width: `${devicePct(count)}%` }} />
                    </div>
                    <div className="text-right shrink-0 w-14">
                      <span className="text-[12px] font-semibold text-[#1A1816]">{devicePct(count)}%</span>
                      <span className="text-[11px] text-[#A8A8A4] ml-1">({count})</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* UTM sources */}
        <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E8E4] flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-[#D03839]" />
            <h2 className="text-[13px] font-semibold text-[#1A1816]">Traffic sources</h2>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="h-24 bg-[#F0F0EE] rounded animate-pulse" />
            ) : utms.length === 0 ? (
              <p className="text-[13px] text-[#A8A8A4] text-center py-4">No UTM traffic tracked yet</p>
            ) : (
              <div className="space-y-3">
                {utms.map(({ source, count }) => {
                  const icon = UTM_ICONS[source.toLowerCase()];
                  const maxUtm = utms[0]?.count || 1;
                  return (
                    <div key={source} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 w-24 shrink-0">
                        {icon && <img src={icon} alt="" className="w-3.5 h-3.5 shrink-0" />}
                        <span className="text-[12px] text-[#737370] capitalize">{source}</span>
                      </div>
                      <div className="flex-1 h-2 bg-[#F0F0EE] rounded-full overflow-hidden">
                        <div className="h-full bg-[#D03839] rounded-full" style={{ width: `${Math.round((count / maxUtm) * 100)}%` }} />
                      </div>
                      <span className="text-[12px] font-semibold text-[#1A1816] w-6 text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Buyer engagement */}
        <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E8E4]">
            <h2 className="text-[13px] font-semibold text-[#1A1816]">Buyer engagement</h2>
            <p className="text-[11px] text-[#A8A8A4]">% of sessions where buyers</p>
          </div>
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="h-24 bg-[#F0F0EE] rounded animate-pulse" />
            ) : (
              <>
                <EngagementBar label="Scrolled" pct={eng.scrolled || 0} icon={<ChevronDown className="w-3.5 h-3.5 text-[#A8A8A4]" />} />
                <EngagementBar label="Viewed photos" pct={eng.viewedPhotos || 0} icon={<Image className="w-3.5 h-3.5 text-[#A8A8A4]" />} />
                <EngagementBar label="Read description" pct={eng.viewedDescription || 0} icon={<FileText className="w-3.5 h-3.5 text-[#A8A8A4]" />} />
                <EngagementBar label="Viewed repairs" pct={eng.viewedRepairs || 0} icon={<Activity className="w-3.5 h-3.5 text-[#A8A8A4]" />} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent viewers table */}
      <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E8E8E4]">
          <h2 className="text-[13px] font-semibold text-[#1A1816]">Recent buyer activity</h2>
          <p className="text-[11px] text-[#A8A8A4]">Most recent sessions across all listings</p>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-[#F0F0EE] rounded animate-pulse" />)}
          </div>
        ) : recent.length === 0 ? (
          <div className="py-16 text-center">
            <Eye className="w-8 h-8 text-[#D4D4CF] mx-auto mb-2" />
            <p className="text-[13px] font-semibold text-[#444441]">No activity yet</p>
            <p className="text-[12px] text-[#737370] mt-1 mb-4">Share your listings to start getting buyer views.</p>
            <a href="/properties" className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors">
              Go to My Listings
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[#E8E8E4] bg-[#FAFAF8]">
                  {['Buyer', 'Listing', 'Views', 'Time spent', 'Device', 'Source', 'Last seen'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[0.8px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E4]">
                {recent.map((r, i) => {
                  const name = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email || 'Guest';
                  const initial = name.charAt(0).toUpperCase();
                  const utmIcon = r.utmSource ? UTM_ICONS[r.utmSource.toLowerCase()] : null;
                  return (
                    <tr key={i} className="hover:bg-[#FAFAF8] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#FEF0EF] flex items-center justify-center flex-shrink-0">
                            <span className="text-[11px] font-bold text-[#D03839]">{initial}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-[#1A1816] truncate capitalize">{name}</p>
                            {r.email && name !== r.email && (
                              <p className="text-[10px] text-[#A8A8A4] truncate">{r.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] text-[#444441] truncate max-w-[160px]" title={r.propertyName}>{truncate(r.propertyName, 24)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-semibold text-[#1A1816]">{r.views}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#737370]">{formatDuration(r.duration)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-[12px] text-[#737370]">
                          {(r.device?.toLowerCase() === 'mobile' || r.device?.toLowerCase() === 'tablet') && <Smartphone className="w-3 h-3" />}
                          {r.device?.toLowerCase() === 'desktop' && <Monitor className="w-3 h-3" />}
                          <span className="capitalize">{r.device?.toLowerCase() === 'tablet' ? 'Mobile' : (r.device || '—')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.utmSource ? (
                          <div className="flex items-center gap-1">
                            {utmIcon && <img src={utmIcon} alt="" className="w-3.5 h-3.5" />}
                            <span className="text-[12px] text-[#737370] capitalize">{r.utmSource}</span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-[#A8A8A4]">Direct</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#737370]">{formatDate(r.lastSeen)}</span>
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
