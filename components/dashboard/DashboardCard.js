



'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'

export default function DashboardCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  description,
  color = 'blue', // legacy prop — BW-retro system is monochrome; kept for API compatibility
  loading = false
}) {
  if (loading) {
    return (
      <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 p-5 motion-safe:animate-pulse">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-3 bg-tint rounded w-20"></div>
            <div className="h-7 bg-tint rounded w-24"></div>
            <div className="h-3 bg-tint rounded w-32"></div>
          </div>
          <div className="w-12 h-12 bg-tint rounded-[10px]"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 hover:shadow-offset-6 transition-shadow duration-[120ms] p-5 cursor-pointer group">
      <div className="flex items-start justify-between gap-4">
        {/* Left Content */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.12em]">
            {title}
          </p>
          <h3 className="font-display font-bold text-[32px] leading-[1.1] tracking-[-0.02em] text-ink mt-1 truncate">
            {value}
          </h3>

          {/* Trend */}
          {trend && trendValue && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-pill bg-tint font-mono text-[11px] font-semibold text-ink">
                {trend === 'up' ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{trendValue}</span>
              </div>
              {description && (
                <span className="font-mono text-[10.5px] text-muted truncate">
                  {description}
                </span>
              )}
            </div>
          )}

          {/* Description only (no trend) */}
          {!trend && description && (
            <p className="font-mono text-[10.5px] text-muted mt-2">{description}</p>
          )}
        </div>

        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="w-11 h-11 bg-tint rounded-[10px] flex items-center justify-center">
            <Icon className="w-5 h-5 text-ink" />
          </div>
        </div>
      </div>
    </div>
  )
}
