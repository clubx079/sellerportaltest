


'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'

export default function DashboardCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  description,
  color = 'blue',
  loading = false
}) {
  const colorClasses = {
    blue: {
      bg: 'from-blue-500 to-blue-600',
      light: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-200',
      trendBg: 'bg-blue-50',
      trendText: 'text-blue-700'
    },
    green: {
      bg: 'from-green-500 to-green-600',
      light: 'bg-green-50',
      text: 'text-green-600',
      border: 'border-green-200',
      trendBg: 'bg-green-50',
      trendText: 'text-green-700'
    },
    purple: {
      bg: 'from-purple-500 to-purple-600',
      light: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-200',
      trendBg: 'bg-purple-50',
      trendText: 'text-purple-700'
    },
    orange: {
      bg: 'from-orange-500 to-orange-600',
      light: 'bg-orange-50',
      text: 'text-orange-600',
      border: 'border-orange-200',
      trendBg: 'bg-orange-50',
      trendText: 'text-orange-700'
    },
    pink: {
      bg: 'from-pink-500 to-pink-600',
      light: 'bg-pink-50',
      text: 'text-pink-600',
      border: 'border-pink-200',
      trendBg: 'bg-pink-50',
      trendText: 'text-pink-700'
    },
    indigo: {
      bg: 'from-indigo-500 to-indigo-600',
      light: 'bg-indigo-50',
      text: 'text-indigo-600',
      border: 'border-indigo-200',
      trendBg: 'bg-indigo-50',
      trendText: 'text-indigo-700'
    },
    red: {
      bg: 'from-red-500 to-red-600',
      light: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-200',
      trendBg: 'bg-red-50',
      trendText: 'text-red-700'
    },
    teal: {
      bg: 'from-teal-500 to-teal-600',
      light: 'bg-teal-50',
      text: 'text-teal-600',
      border: 'border-teal-200',
      trendBg: 'bg-teal-50',
      trendText: 'text-teal-700'
    }
  }

  const colors = colorClasses[color] || colorClasses.blue

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-20"></div>
            <div className="h-7 bg-gray-200 rounded w-24"></div>
            <div className="h-3 bg-gray-200 rounded w-32"></div>
          </div>
          <div className={`w-12 h-12 ${colors.light} rounded-xl`}></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 cursor-pointer group">
      <div className="flex items-start justify-between gap-4">
        {/* Left Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1 truncate">
            {value}
          </h3>

          {/* Trend */}
          {trend && trendValue && (
            <div className="flex items-center gap-1.5 mt-2">
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  trend === 'up'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {trend === 'up' ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{trendValue}</span>
              </div>
              {description && (
                <span className="text-xs text-gray-500 truncate">
                  {description}
                </span>
              )}
            </div>
          )}

          {/* Description only (no trend) */}
          {!trend && description && (
            <p className="text-xs text-gray-500 mt-2">{description}</p>
          )}
        </div>

        {/* Icon */}
        <div className="flex-shrink-0">
          <div
            className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm`}
          >
            <div
              className={`w-9 h-9 bg-gradient-to-br ${colors.bg} rounded-lg flex items-center justify-center shadow`}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}