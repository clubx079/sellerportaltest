'use client';
import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, DollarSign, Home, BarChart2, MapPin, ArrowUpRight } from 'lucide-react';

function formatCurrency(n) {
  if (!n) return '—';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

function BarRow({ label, count, max, sub }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 text-[12px] text-[#737370] truncate" title={label}>{label}</div>
      <div className="flex-1 h-2 bg-[#F0F0EE] rounded-full overflow-hidden">
        <div className="h-full bg-[#D03839] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right shrink-0">
        <span className="text-[12px] font-semibold text-[#1A1816]">{count}</span>
        {sub && <span className="text-[11px] text-[#A8A8A4] ml-1">{sub}</span>}
      </div>
    </div>
  );
}

export default function SellerMarketInsightsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/seller/market-insights')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 text-[#A8A8A4] animate-spin" />
      </div>
    );
  }

  const { summary = {}, topStates = [], priceDistribution = [], propertyTypes = [] } = data || {};
  const maxState = topStates[0]?.count || 1;
  const maxPrice = Math.max(...priceDistribution.map(b => b.count), 1);
  const maxType = propertyTypes[0]?.count || 1;

  const statCards = [
    {
      label: 'Active deals on platform',
      value: summary.total?.toLocaleString() || '—',
      sub: `${summary.newDeals || 0} added this month`,
      icon: <Home className="w-4 h-4 text-[#D03839]" />,
      iconBg: '#FEF0EF',
    },
    {
      label: 'Average deal price',
      value: formatCurrency(summary.avgPrice),
      sub: 'Across all active listings',
      icon: <DollarSign className="w-4 h-4 text-[#B5620A]" />,
      iconBg: '#FEF3E2',
    },
    {
      label: 'Avg gross yield',
      value: summary.avgYield ? `${summary.avgYield}%` : '—',
      sub: 'Annualised rental return',
      icon: <TrendingUp className="w-4 h-4 text-[#0F6E56]" />,
      iconBg: '#E4F5EC',
    },
    {
      label: 'Avg cap rate',
      value: summary.avgCapRate ? `${summary.avgCapRate}%` : '—',
      sub: 'Net operating income / price',
      icon: <BarChart2 className="w-4 h-4 text-[#4A90E2]" />,
      iconBg: '#EBF3FC',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8] p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-[#737370] mb-0.5">
          <BarChart2 className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-[1px]">Analytics</span>
        </div>
        <h1 className="text-[22px] font-bold text-[#1A1816] tracking-tight">Market Insights</h1>
        <p className="text-[13px] text-[#737370] mt-0.5">
          Live platform data — {summary.total?.toLocaleString() || 0} active wholesale deals
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white border border-[#E8E8E4] rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-semibold text-[#737370] uppercase tracking-[0.8px] leading-snug">{card.label}</p>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ml-2" style={{ backgroundColor: card.iconBg }}>
                {card.icon}
              </div>
            </div>
            <p className="text-[26px] font-bold text-[#1A1816] leading-none">{card.value}</p>
            <p className="text-[11px] text-[#A8A8A4] mt-1.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Top markets */}
        <div className="bg-white border border-[#E8E8E4] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E8E4] flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#D03839]" />
            <h2 className="text-[13px] font-semibold text-[#1A1816]">Top markets by deals</h2>
          </div>
          <div className="p-4 space-y-3">
            {topStates.length === 0 ? (
              <p className="text-[13px] text-[#737370]">No data available</p>
            ) : topStates.map((s) => (
              <BarRow key={s.state} label={s.state} count={s.count} max={maxState} sub="deals" />
            ))}
          </div>
        </div>

        {/* Price distribution */}
        <div className="bg-white border border-[#E8E8E4] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E8E4] flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-[#D03839]" />
            <h2 className="text-[13px] font-semibold text-[#1A1816]">Price distribution</h2>
          </div>
          <div className="p-4 space-y-3">
            {priceDistribution.map((b) => (
              <BarRow key={b.label} label={b.label} count={b.count} max={maxPrice} sub="deals" />
            ))}
          </div>
        </div>

        {/* Property types */}
        <div className="bg-white border border-[#E8E8E4] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E8E4] flex items-center gap-2">
            <Home className="w-3.5 h-3.5 text-[#D03839]" />
            <h2 className="text-[13px] font-semibold text-[#1A1816]">Property types</h2>
          </div>
          <div className="p-4 space-y-3">
            {propertyTypes.length === 0 ? (
              <p className="text-[13px] text-[#737370]">No data available</p>
            ) : propertyTypes.map((t) => (
              <BarRow key={t.type} label={t.type} count={t.count} max={maxType} sub="deals" />
            ))}
          </div>
        </div>
      </div>

      {/* State breakdown table */}
      {topStates.length > 0 && (
        <div className="bg-white border border-[#E8E8E4] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E8E4]">
            <h2 className="text-[13px] font-semibold text-[#1A1816]">Market breakdown</h2>
          </div>
          <div className="divide-y divide-[#E8E8E4]">
            <div className="hidden sm:grid grid-cols-4 px-4 py-2 text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[0.8px]">
              <span>State</span>
              <span className="text-center">Active deals</span>
              <span className="text-center">Avg price</span>
              <span className="text-right">Avg yield</span>
            </div>
            {topStates.map((s, i) => (
              <div key={s.state} className="flex items-center justify-between sm:grid sm:grid-cols-4 gap-2 px-4 py-3 hover:bg-[#FAFAF8] transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#A8A8A4] w-5">{i + 1}</span>
                  <p className="text-[13px] font-semibold text-[#1A1816]">{s.state}</p>
                </div>
                <p className="text-[13px] text-[#737370] sm:text-center">{s.count} deals</p>
                <p className="hidden sm:block text-[13px] font-medium text-[#1A1816] sm:text-center">{formatCurrency(s.avgPrice)}</p>
                <p className={`hidden sm:block text-[13px] font-semibold text-right ${s.avgYield > 0 ? 'text-[#0F6E56]' : 'text-[#737370]'}`}>
                  {s.avgYield > 0 ? `${s.avgYield}%` : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
