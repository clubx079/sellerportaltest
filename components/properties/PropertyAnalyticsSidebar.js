"use client";

import React, { useEffect, useState } from 'react';
import { Calendar, ArrowDownUp, Users, Eye, Smartphone, Monitor, Tablet } from 'lucide-react';

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

function formatDate(iso) {
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

function formatDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: '2-digit',
    day: '2-digit',
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
  if (t === 'mobile') return <Smartphone className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  if (t === 'tablet') return <Tablet className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  return <Monitor className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
}

const PERIOD_OPTIONS = [
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'all', label: 'All time' }
];

const SORT_OPTIONS = [
  { value: 'last_visit', label: 'Last visit' },
  { value: 'time_spent', label: 'Time spent' },
  { value: 'page_views', label: 'Page views' }
];

export default function PropertyAnalyticsSidebar({ propertyId, propertyName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState('all');
  const [sortBy, setSortBy] = useState('last_visit');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
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
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load analytics');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [propertyId, period, sortBy]);

  const agg = data?.aggregates || {};
  const sessions = data?.viewerSessions || [];

  return (
    <>
      {/* Backdrop - light overlay, no blur to avoid fuzzy edges */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/25 transition-all duration-300 ease-out ${
          mounted ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 bottom-0 w-[50vw] min-w-[320px] max-w-2xl z-50 flex flex-col overflow-hidden bg-white border-l border-slate-200 transition-transform duration-300 ease-out ${
          mounted ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          boxShadow: mounted ? '-12px 0 40px rgba(2, 43, 65, 0.08), -4px 0 16px rgba(0,0,0,0.04)' : 'none'
        }}
        aria-label="Property analytics"
      >
        {/* Header — dark blue */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 bg-primary">
          <div className="min-w-0 pr-4">
            <h2 className="text-lg font-semibold text-white tracking-tight">Property analytics</h2>
            {propertyName && (
              <p className="text-sm text-white/80 mt-0.5 truncate" title={propertyName}>
                {propertyName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all duration-200"
            aria-label="Close"
          >
            <span className="text-xl leading-none font-light">×</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/70">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="w-10 h-10 border-2 border-primary/15 border-t-primary rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-700">Loading analytics…</p>
              <div className="h-20 w-full max-w-[200px] rounded-xl bg-slate-200/50 animate-pulse" />
              <div className="h-32 w-full max-w-[280px] rounded-xl bg-slate-200/40 animate-pulse" />
            </div>
          )}

          {error && (
            <div
              className="mx-6 mt-6 p-5 rounded-xl bg-red-50 border border-red-100/80"
              role="alert"
            >
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <div className="p-4 space-y-4">
              {/* Viewers count + filters in one row (no blocks) */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-slate-800">Unique viewers</span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">{agg.uniqueViewers ?? 0}</span>
                </div>
                <div className="h-4 w-px bg-slate-200 shrink-0" aria-hidden="true" />
                <div className="flex items-center gap-2 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-600" />
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="text-xs font-medium border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-800 focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    {PERIOD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ArrowDownUp className="w-3.5 h-3.5 text-slate-600" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-xs font-medium border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-800 focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Viewing activity section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full bg-primary" />
                    Viewing activity
                  </h3>
                  <span className="text-xs font-medium text-slate-700 tabular-nums">{sessions.length} {sessions.length === 1 ? 'viewer' : 'viewers'}</span>
                </div>
                {sessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center px-4">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-2">
                      <Eye className="w-5 h-5 text-slate-600" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No activity yet</p>
                    <p className="text-xs text-slate-700 mt-1 max-w-[220px] mx-auto">When buyers view this property, they’ll appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {sessions.map((row, idx) => {
                      const name = displayName(row);
                      const initial = (name && name !== 'Guest' ? name.charAt(0) : (row.user_email || 'G').charAt(0)).toUpperCase();
                      const views = row.page_views != null ? Number(row.page_views) : 0;
                      const duration = row.duration_seconds ?? row.active_time_seconds;
                      const timing = duration != null ? formatDuration(duration) : null;
                      const images = row.images_viewed != null ? Number(row.images_viewed) : 0;
                      const firstSeen = row.view_start_time ? formatDateShort(row.view_start_time) : null;
                      const lastSeen = row.view_end_time ? formatDateShort(row.view_end_time) : (row.created_at ? formatDateShort(row.created_at) : null);
                      const device = row.device_type ? (row.device_type.toLowerCase() === 'tablet' ? 'Tablet' : row.device_type.toLowerCase() === 'mobile' ? 'Mobile' : 'Desktop') : null;
                      const tags = [];
                      if (row.scrolled_to_bottom) tags.push('Scrolled');
                      if (row.viewed_description) tags.push('Description');
                      if (row.viewed_repairs) tags.push('Repairs');
                      const canMessage = !!row.user_id;
                      return (
                        <div
                          key={(row.user_email || 'guest') + (row.view_start_time || '') + idx}
                          className="group rounded-lg border border-slate-200 bg-white p-3 hover:border-primary/20 transition-colors"
                        >
                          <div className="flex gap-2.5">
                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">{initial}</span>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <p className="text-sm font-semibold text-slate-900 capitalize leading-tight">
                                  {name || 'Guest'}
                                </p>
                                {row.utm_source && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-medium capitalize">
                                    {row.utm_source}
                                  </span>
                                )}
                                {device && (
                                  <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                                    {getDeviceIcon(row.device_type)}
                                    {device}
                                  </span>
                                )}
                              </div>
                              {/* Page views, photos viewed, time spent — inline, no boxes */}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                                <span>{views} view{views !== 1 ? 's' : ''}</span>
                                {images > 0 && <span>{images} photo{images !== 1 ? 's' : ''}</span>}
                                {timing && <span>{timing}</span>}
                              </div>
                              {tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {tags.map((t) => (
                                    <span
                                      key={t}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 pt-0.5">
                                {firstSeen && <span>First: {firstSeen}</span>}
                                {lastSeen && lastSeen !== firstSeen && <span>Last: {lastSeen}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
