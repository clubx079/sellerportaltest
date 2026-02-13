"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, ChevronLeft, ChevronRight, BedDouble, TrendingUp, TrendingDown, Activity } from 'lucide-react';

const OccupancyReport = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [activeTab, setActiveTab] = useState('weekly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userId, setUserId] = useState(null);

  // Get userId from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('hotel_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
    }
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

      // Fetch room types for this user
      const { data: roomTypesData, error: roomTypesError } = await supabase
        .from('room_types')
        .select('id, title')
        .eq('user_id', userId)
        .order('title', { ascending: true });

      if (roomTypesError) throw roomTypesError;
      setRoomTypes(roomTypesData || []);

      // Fetch all rooms for this user
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('id, room_number, room_type_id, is_active')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (roomsError) throw roomsError;
      setRooms(roomsData || []);

      // Fetch booked rooms with booking info for this user
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('booked_rooms')
        .select(`
          id,
          room_id,
          check_in,
          check_out,
          status,
          rooms (id, room_number, room_type_id),
          bookings (id, booking_status, payment_status)
        `)
        .eq('user_id', userId)
        .order('check_in', { ascending: true });

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to fetch occupancy data.');
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

  // Count occupied rooms for a specific date
  const countOccupiedRooms = (date, filteredRooms) => {
    const dateStr = date.toISOString().split('T')[0];
    const roomIds = filteredRooms.map(r => r.id);

    return bookings.filter(booking => {
      if (!roomIds.includes(booking.room_id)) return false;

      const checkIn = new Date(booking.check_in).toISOString().split('T')[0];
      const checkOut = new Date(booking.check_out).toISOString().split('T')[0];

      return dateStr >= checkIn && dateStr <= checkOut;
    }).length;
  };

  // Count total occupied room-days in a date range
  const countOccupiedRoomsInRange = (startDate, endDate, filteredRooms) => {
    let totalOccupied = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      totalOccupied += countOccupiedRooms(current, filteredRooms);
      current.setDate(current.getDate() + 1);
    }

    return totalOccupied;
  };

  // Generate chart data based on date range
  const chartData = useMemo(() => {
    const { startDate, endDate } = getDateRange();
    const data = [];

    const filteredRooms = selectedRoomType
      ? rooms.filter(room => room.room_type_id === parseInt(selectedRoomType))
      : rooms;

    const totalRooms = filteredRooms.length;

    if (activeTab === 'weekly') {
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        const occupiedRooms = countOccupiedRooms(date, filteredRooms);
        const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

        data.push({
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
          date: date.toISOString().split('T')[0],
          occupied: occupiedRooms,
          total: totalRooms,
          rate: occupancyRate
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

        const occupiedRooms = countOccupiedRoomsInRange(weekStart, weekEnd, filteredRooms);
        const daysInWeek = Math.min(7, (weekEnd - weekStart) / (1000 * 60 * 60 * 24) + 1);
        const avgOccupancy = totalRooms > 0 ? (occupiedRooms / (totalRooms * daysInWeek)) * 100 : 0;

        data.push({
          label: `Week ${i + 1}`,
          date: weekStart.toISOString().split('T')[0],
          occupied: Math.round(occupiedRooms / daysInWeek),
          total: totalRooms,
          rate: avgOccupancy
        });
      }
    } else if (activeTab === 'yearly') {
      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(startDate.getFullYear(), i, 1);
        const monthEnd = new Date(startDate.getFullYear(), i + 1, 0);

        const occupiedRooms = countOccupiedRoomsInRange(monthStart, monthEnd, filteredRooms);
        const daysInMonth = monthEnd.getDate();
        const avgOccupancy = totalRooms > 0 ? (occupiedRooms / (totalRooms * daysInMonth)) * 100 : 0;

        data.push({
          label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
          date: monthStart.toISOString().split('T')[0],
          occupied: Math.round(occupiedRooms / daysInMonth),
          total: totalRooms,
          rate: avgOccupancy
        });
      }
    } else if (activeTab === 'custom' && customStartDate && customEndDate) {
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      if (daysDiff <= 14) {
        for (let i = 0; i < daysDiff; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);

          const occupiedRooms = countOccupiedRooms(date, filteredRooms);
          const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

          data.push({
            label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            date: date.toISOString().split('T')[0],
            occupied: occupiedRooms,
            total: totalRooms,
            rate: occupancyRate
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

          const occupiedRooms = countOccupiedRoomsInRange(weekStart, weekEnd, filteredRooms);
          const daysInWeek = Math.min(7, (weekEnd - weekStart) / (1000 * 60 * 60 * 24) + 1);
          const avgOccupancy = totalRooms > 0 ? (occupiedRooms / (totalRooms * daysInWeek)) * 100 : 0;

          data.push({
            label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            date: weekStart.toISOString().split('T')[0],
            occupied: Math.round(occupiedRooms / daysInWeek),
            total: totalRooms,
            rate: avgOccupancy
          });
        }
      }
    }

    return data;
  }, [bookings, rooms, selectedRoomType, activeTab, currentDate, customStartDate, customEndDate]);

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
  const maxRate = Math.max(...chartData.map(d => d.rate), 1);
  const chartHeight = 220;

  // Calculate summary stats
  const avgOccupancy = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + d.rate, 0) / chartData.length
    : 0;
  const maxOccupancy = chartData.length > 0
    ? Math.max(...chartData.map(d => d.rate))
    : 0;
  const minOccupancy = chartData.length > 0
    ? Math.min(...chartData.map(d => d.rate))
    : 0;

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Occupancy Report</h1>
            <p className="text-xs text-neutral-500 mt-0.5">View booking calendar and occupancy analytics</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Total Rooms</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{rooms.length}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <BedDouble className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Average Occupancy</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{avgOccupancy.toFixed(1)}%</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Peak Occupancy</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{maxOccupancy.toFixed(1)}%</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Lowest Occupancy</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{minOccupancy.toFixed(1)}%</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Controls */}
          <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-neutral-200">
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-2 md:gap-3">
              {/* Room Type Filter */}
              <select
                value={selectedRoomType}
                onChange={(e) => setSelectedRoomType(e.target.value)}
                className="text-[10px] sm:text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white w-full sm:w-auto sm:min-w-[160px]"
              >
                <option value="">All Room Types</option>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>{rt.title}</option>
                ))}
              </select>

              {/* Period Navigation */}
              {activeTab !== 'custom' && (
                <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                  <button
                    onClick={() => navigatePeriod(-1)}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-700 min-w-[140px] sm:min-w-[160px] text-center">
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
            <div className="flex items-center gap-0.5 bg-neutral-100 p-0.5 rounded-lg w-fit min-w-full sm:min-w-0">
              {['weekly', 'monthly', 'yearly', 'custom'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all duration-200 flex-1 sm:flex-none ${
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
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 mt-2 sm:mt-2.5">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] sm:text-xs text-neutral-600 font-medium">From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="text-[10px] sm:text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 flex-1"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] sm:text-xs text-neutral-600 font-medium">To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="text-[10px] sm:text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 flex-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="p-3 sm:p-4">
            {loading ? (
              <div className="flex items-center justify-center h-[180px] sm:h-[220px]">
                <div className="flex items-center gap-2 text-neutral-500">
                  <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-[#472F97] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] sm:text-xs font-medium">Loading occupancy data...</span>
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[180px] sm:h-[220px] text-neutral-400">
                <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10 mb-2" />
                <p className="text-xs sm:text-sm font-medium">No data available</p>
                <p className="text-[10px] sm:text-xs">Try selecting a different date range</p>
              </div>
            ) : (
              <div className="relative overflow-x-auto">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-6 w-8 sm:w-10 flex flex-col justify-between text-[9px] sm:text-[10px] text-neutral-500">
                  <span>{Math.round(maxRate)}%</span>
                  <span>{Math.round(maxRate * 0.75)}%</span>
                  <span>{Math.round(maxRate * 0.5)}%</span>
                  <span>{Math.round(maxRate * 0.25)}%</span>
                  <span>0%</span>
                </div>

                {/* Chart area */}
                <div className="ml-10 sm:ml-12">
                  {/* Y-axis label */}
                  <div className="absolute -left-0.5 sm:-left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] sm:text-[10px] font-medium text-neutral-600 whitespace-nowrap">
                    Occupancy Rate
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
                              <div>Occupancy: {item.rate.toFixed(1)}%</div>
                              <div>Rooms: {item.occupied}/{item.total}</div>
                            </div>
                          </div>

                          {/* Bar */}
                          <div
                            className="w-full bg-[#472F97] rounded-t-sm hover:bg-[#3a2578] transition-colors cursor-pointer"
                            style={{
                              height: `${(item.rate / maxRate) * 100}%`,
                              maxHeight: `${chartHeight}px`,
                              minHeight: item.rate > 0 ? '3px' : '0px'
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
              <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-neutral-100 border-b border-neutral-200">
                <h3 className="text-[10px] sm:text-xs font-semibold text-neutral-900">Period Summary</h3>
              </div>
              <div className="divide-y divide-neutral-100">
                <div className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs text-neutral-600">Period</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-900 text-right">{getPeriodLabel()}</span>
                </div>
                <div className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs text-neutral-600">Average Occupancy</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-900">{avgOccupancy.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs text-neutral-600">Peak Occupancy</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-900">{maxOccupancy.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs text-neutral-600">Lowest Occupancy</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-900">{minOccupancy.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs text-neutral-600">Total Rooms</span>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-900">{rooms.length}</span>
                </div>
                {selectedRoomType && (
                  <div className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2">
                    <span className="text-[10px] sm:text-xs text-neutral-600">Filtered Room Type</span>
                    <span className="text-[10px] sm:text-xs font-medium text-neutral-900 text-right">
                      {roomTypes.find(rt => rt.id === parseInt(selectedRoomType))?.title || 'N/A'}
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

export default OccupancyReport;
