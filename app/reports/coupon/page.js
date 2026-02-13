"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Ticket, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { getCurrentCurrencySymbol } from '@/lib/currency';

const CouponReport = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [selectedCoupon, setSelectedCoupon] = useState('');
  const [activeTab, setActiveTab] = useState('weekly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userId, setUserId] = useState(null);
  const [currency, setCurrency] = useState('$');

  // Get userId from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('hotel_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
    }
    setCurrency(getCurrentCurrencySymbol());
  }, []);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Fetch coupons for this user
      const { data: couponsData, error: couponsError } = await supabase
        .from('coupons')
        .select('id, coupon_code, coupon_type, coupon_value, offer_title')
        .eq('user_id', userId)
        .order('coupon_code', { ascending: true });

      if (couponsError) throw couponsError;
      setCoupons(couponsData || []);

      // Fetch bookings with coupon info for this user
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          created_at,
          coupon_id,
          coupon_discount,
          total_amount,
          coupons (id, coupon_code, coupon_type, coupon_value)
        `)
        .eq('user_id', userId)
        .not('coupon_id', 'is', null)
        .order('created_at', { ascending: true });

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      // Silently handle errors - data will just be empty
      setCoupons([]);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  // Get date range based on active tab
  const getDateRange = () => {
    const today = new Date(currentDate);
    let startDate, endDate;

    switch (activeTab) {
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay());
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'monthly':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'yearly':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        break;
      case 'custom':
        startDate = customStartDate ? new Date(customStartDate) : new Date();
        endDate = customEndDate ? new Date(customEndDate) : new Date();
        break;
      default:
        startDate = new Date();
        endDate = new Date();
    }

    return { startDate, endDate };
  };

  // Count coupons used on a specific date
  const countCouponsUsed = (date, filteredBookings) => {
    const dateStr = date.toISOString().split('T')[0];

    return filteredBookings.filter(booking => {
      const bookingDate = new Date(booking.created_at).toISOString().split('T')[0];
      return dateStr === bookingDate;
    }).length;
  };

  // Calculate discount on a specific date
  const calculateDiscountOnDate = (date, filteredBookings) => {
    const dateStr = date.toISOString().split('T')[0];

    return filteredBookings
      .filter(booking => {
        const bookingDate = new Date(booking.created_at).toISOString().split('T')[0];
        return dateStr === bookingDate;
      })
      .reduce((sum, booking) => sum + (parseFloat(booking.coupon_discount) || 0), 0);
  };

  // Count total coupons used in a date range
  const countCouponsInRange = (startDate, endDate, filteredBookings) => {
    return filteredBookings.filter(booking => {
      const bookingDate = new Date(booking.created_at);
      const bookingDateOnly = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
      const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

      return bookingDateOnly >= startDateOnly && bookingDateOnly <= endDateOnly;
    }).length;
  };

  // Calculate total discount in a date range
  const calculateDiscountInRange = (startDate, endDate, filteredBookings) => {
    return filteredBookings
      .filter(booking => {
        const bookingDate = new Date(booking.created_at);
        const bookingDateOnly = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
        const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

        return bookingDateOnly >= startDateOnly && bookingDateOnly <= endDateOnly;
      })
      .reduce((sum, booking) => sum + (parseFloat(booking.coupon_discount) || 0), 0);
  };

  // Generate chart data based on date range
  const chartData = useMemo(() => {
    const { startDate, endDate } = getDateRange();
    const data = [];

    // Filter bookings by selected coupon
    const filteredBookings = selectedCoupon
      ? bookings.filter(booking => booking.coupon_id === parseInt(selectedCoupon))
      : bookings;

    if (activeTab === 'weekly') {
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        const couponsUsed = countCouponsUsed(date, filteredBookings);
        const discount = calculateDiscountOnDate(date, filteredBookings);

        data.push({
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
          date: date.toISOString().split('T')[0],
          count: couponsUsed,
          discount: discount
        });
      }
    } else if (activeTab === 'monthly') {
      const weeksInMonth = Math.ceil((endDate.getDate() - startDate.getDate() + 1) / 7);
      for (let i = 0; i < weeksInMonth; i++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        if (weekEnd > endDate) {
          weekEnd.setTime(endDate.getTime());
        }

        const couponsUsed = countCouponsInRange(weekStart, weekEnd, filteredBookings);
        const discount = calculateDiscountInRange(weekStart, weekEnd, filteredBookings);

        data.push({
          label: `Week ${i + 1}`,
          date: weekStart.toISOString().split('T')[0],
          count: couponsUsed,
          discount: discount
        });
      }
    } else if (activeTab === 'yearly') {
      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(startDate.getFullYear(), i, 1);
        const monthEnd = new Date(startDate.getFullYear(), i + 1, 0);

        const couponsUsed = countCouponsInRange(monthStart, monthEnd, filteredBookings);
        const discount = calculateDiscountInRange(monthStart, monthEnd, filteredBookings);

        data.push({
          label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
          date: monthStart.toISOString().split('T')[0],
          count: couponsUsed,
          discount: discount
        });
      }
    } else if (activeTab === 'custom' && customStartDate && customEndDate) {
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      if (daysDiff <= 14) {
        for (let i = 0; i < daysDiff; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);

          const couponsUsed = countCouponsUsed(date, filteredBookings);
          const discount = calculateDiscountOnDate(date, filteredBookings);

          data.push({
            label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            date: date.toISOString().split('T')[0],
            count: couponsUsed,
            discount: discount
          });
        }
      } else {
        const weeks = Math.ceil(daysDiff / 7);
        for (let i = 0; i < weeks; i++) {
          const weekStart = new Date(startDate);
          weekStart.setDate(startDate.getDate() + (i * 7));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);

          if (weekEnd > endDate) {
            weekEnd.setTime(endDate.getTime());
          }

          const couponsUsed = countCouponsInRange(weekStart, weekEnd, filteredBookings);
          const discount = calculateDiscountInRange(weekStart, weekEnd, filteredBookings);

          data.push({
            label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            date: weekStart.toISOString().split('T')[0],
            count: couponsUsed,
            discount: discount
          });
        }
      }
    }

    return data;
  }, [bookings, selectedCoupon, activeTab, currentDate, customStartDate, customEndDate]);

  // Navigate date range
  const navigatePeriod = (direction) => {
    const newDate = new Date(currentDate);

    switch (activeTab) {
      case 'weekly':
        newDate.setDate(newDate.getDate() + (direction * 7));
        break;
      case 'monthly':
        newDate.setMonth(newDate.getMonth() + direction);
        break;
      case 'yearly':
        newDate.setFullYear(newDate.getFullYear() + direction);
        break;
    }

    setCurrentDate(newDate);
  };

  // Get period label
  const getPeriodLabel = () => {
    const { startDate, endDate } = getDateRange();

    switch (activeTab) {
      case 'weekly':
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'monthly':
        return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'yearly':
        return startDate.getFullYear().toString();
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${new Date(customStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(customEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
        return 'Select date range';
      default:
        return '';
    }
  };

  // Calculate max value for chart scaling
  const maxCount = Math.max(...chartData.map(d => d.count), 1);
  const chartHeight = 220;

  // Calculate summary stats
  const { startDate, endDate } = getDateRange();
  const filteredBookings = selectedCoupon
    ? bookings.filter(booking => booking.coupon_id === parseInt(selectedCoupon))
    : bookings;

  const totalCouponsUsed = countCouponsInRange(startDate, endDate, filteredBookings);
  const totalDiscount = calculateDiscountInRange(startDate, endDate, filteredBookings);
  const avgCouponsPerPeriod = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + d.count, 0) / chartData.length
    : 0;
  const peakUsage = chartData.length > 0
    ? Math.max(...chartData.map(d => d.count))
    : 0;

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Coupon Report</h1>
            <p className="text-xs text-neutral-500 mt-0.5">View coupon usage analytics</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Total Coupons Used</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{totalCouponsUsed}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Ticket className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Total Discount</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{totalDiscount.toFixed(2)}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Avg Usage/Period</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{avgCouponsPerPeriod.toFixed(1)}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Peak Usage</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{peakUsage}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Controls */}
          <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-neutral-200">
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-2 sm:gap-2 md:gap-3">
              {/* Coupon Filter */}
              <div className="flex items-center gap-3">
                <select
                  value={selectedCoupon}
                  onChange={(e) => setSelectedCoupon(e.target.value)}
                  className="text-[10px] sm:text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white w-full sm:w-auto sm:min-w-[180px]"
                >
                  <option value="">All Coupons</option>
                  {coupons.map(coupon => (
                    <option key={coupon.id} value={coupon.id.toString()}>
                      {coupon.coupon_code} ({coupon.coupon_type === 'percentage' ? `${coupon.coupon_value}%` : `${currency}${coupon.coupon_value}`})
                    </option>
                  ))}
                </select>
              </div>

              {/* Period Navigation */}
              {activeTab !== 'custom' && (
                <div className="flex items-center gap-1.5 sm:gap-2 justify-center sm:justify-start">
                  <button
                    onClick={() => navigatePeriod(-1)}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-700 min-w-[140px] sm:min-w-[180px] text-center">
                    {getPeriodLabel()}
                  </span>
                  <button
                    onClick={() => navigatePeriod(1)}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-neutral-200 overflow-x-auto scrollbar-thin">
            <div className="flex items-center gap-0.5 bg-neutral-100 p-0.5 rounded-lg w-fit min-w-max">
              {['weekly', 'monthly', 'yearly', 'custom'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all duration-200 ${
                    activeTab === tab
                      ? 'bg-[#472F97] text-white'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Custom Date Range */}
            {activeTab === 'custom' && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 md:gap-3 mt-2 sm:mt-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <label className="text-[10px] sm:text-xs text-neutral-600 font-medium">From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="text-[10px] sm:text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 flex-1 sm:flex-none"
                  />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <label className="text-[10px] sm:text-xs text-neutral-600 font-medium">To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="text-[10px] sm:text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 flex-1 sm:flex-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="p-3 sm:p-4 overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center h-[180px] sm:h-[220px]">
                <div className="flex items-center gap-2 text-neutral-500">
                  <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-[#472F97] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] sm:text-xs font-medium">Loading coupon data...</span>
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[180px] sm:h-[220px] text-neutral-400">
                <Ticket className="w-8 h-8 sm:w-10 sm:h-10 mb-2" />
                <p className="text-xs sm:text-sm font-medium">No data available</p>
                <p className="text-[10px] sm:text-xs">Try selecting a different date range</p>
              </div>
            ) : (
              <div className="relative overflow-x-auto">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-6 w-8 sm:w-10 flex flex-col justify-between text-[9px] sm:text-[10px] text-neutral-500">
                  <span>{maxCount}</span>
                  <span>{Math.round(maxCount * 0.75)}</span>
                  <span>{Math.round(maxCount * 0.5)}</span>
                  <span>{Math.round(maxCount * 0.25)}</span>
                  <span>0</span>
                </div>

                {/* Chart area */}
                <div className="ml-10 sm:ml-12">
                  {/* Y-axis label */}
                  <div className="absolute -left-0.5 sm:-left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] sm:text-[10px] font-medium text-neutral-600 whitespace-nowrap">
                    Coupons Used
                  </div>

                  {/* Grid lines */}
                  <div className="absolute inset-0 ml-10 sm:ml-12 flex flex-col justify-between pointer-events-none" style={{ height: chartHeight }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="border-b border-dashed border-neutral-200" />
                    ))}
                  </div>

                  {/* Bars */}
                  <div className="flex items-end justify-between gap-1 sm:gap-1.5" style={{ height: chartHeight }}>
                    {chartData.map((item, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div className="w-full relative group">
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <div className="bg-[#472F97] text-white text-[9px] sm:text-[10px] rounded-lg px-1.5 sm:px-2 py-1 sm:py-1.5 whitespace-nowrap shadow-lg">
                              <div className="font-semibold">{item.label}</div>
                              <div>Coupons Used: {item.count}</div>
                              <div>Discount: ${item.discount.toFixed(2)}</div>
                            </div>
                          </div>

                          {/* Bar */}
                          <div
                            className="w-full bg-[#472F97] rounded-t-sm hover:bg-[#3a2578] transition-colors cursor-pointer"
                            style={{
                              height: `${(item.count / maxCount) * 100}%`,
                              maxHeight: `${chartHeight}px`,
                              minHeight: item.count > 0 ? '4px' : '0px'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* X-axis labels */}
                  <div className="flex justify-between gap-1 sm:gap-1.5 mt-1 sm:mt-1.5">
                    {chartData.map((item, index) => (
                      <div key={index} className="flex-1 text-center text-[9px] sm:text-[10px] text-neutral-600 truncate">
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Summary Stats Table */}
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            <div className="bg-neutral-50 rounded-lg border border-neutral-200 overflow-hidden">
              <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-neutral-100 border-b border-neutral-200">
                <h3 className="text-[10px] sm:text-xs font-semibold text-neutral-900">Period Summary</h3>
              </div>
              <div className="divide-y divide-neutral-200">
                <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs text-neutral-600">Period</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-900 text-right">{getPeriodLabel()}</span>
                </div>
                <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs text-neutral-600">Total Coupons Used</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-900">{totalCouponsUsed}</span>
                </div>
                <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs text-neutral-600">Total Discount Given</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-900">${totalDiscount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs text-neutral-600">Average Usage/Period</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-900">{avgCouponsPerPeriod.toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs text-neutral-600">Peak Usage</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-900">{peakUsage}</span>
                </div>
                <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs text-neutral-600">Total Available Coupons</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-900">{coupons.length}</span>
                </div>
                <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs text-neutral-600">Total Bookings with Coupons</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-900">{bookings.length}</span>
                </div>
                {selectedCoupon && (
                  <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2">
                    <span className="text-[10px] sm:text-xs text-neutral-600">Filtered Coupon</span>
                    <span className="text-[10px] sm:text-xs font-medium text-neutral-900">
                      {coupons.find(c => c.id.toString() === selectedCoupon)?.coupon_code || 'N/A'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default CouponReport;
