'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, ChevronLeft, ChevronRight, BedDouble, Building2 } from 'lucide-react';
import MonthView from '@/components/availability-calendar/MonthView';
import WeekView from '@/components/availability-calendar/WeekView';
import DayView from '@/components/availability-calendar/DayView';

const AvailabilityCalendarPage = () => {
  const [roomTypes, setRoomTypes] = useState([]);
  const [hallTypes, setHallTypes] = useState([]);
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [selectedHallType, setSelectedHallType] = useState('');
  const [viewMode, setViewMode] = useState('month'); // month, week, day
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [halls, setHalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Fetch user ID on mount
  useEffect(() => {
    const userStr = localStorage.getItem('hotel_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
    }
  }, []);

  // Fetch room types and hall types when userId is available
  useEffect(() => {
    if (userId) {
      fetchRoomTypes();
      fetchHallTypes();
    }
  }, [userId]);

  // Fetch bookings when selection changes
  useEffect(() => {
    if (userId) {
      if (selectedRoomType) {
        fetchRoomBookings();
      } else if (selectedHallType) {
        fetchHallBookings();
      } else {
        setBookings([]);
        setRooms([]);
        setHalls([]);
      }
    }
  }, [selectedRoomType, selectedHallType, currentDate, userId]);

  const fetchRoomTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('room_types')
        .select('id, title, short_code')
        .eq('user_id', userId)
        .order('title', { ascending: true });

      if (error) throw error;
      setRoomTypes(data || []);
    } catch (error) {
      console.error('Error fetching room types:', error);
    }
  };

  const fetchHallTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('hall_types')
        .select('id, title, short_code')
        .eq('user_id', userId)
        .order('title', { ascending: true });

      if (error) throw error;
      setHallTypes(data || []);
    } catch (error) {
      console.error('Error fetching hall types:', error);
    }
  };

  const fetchRoomBookings = async () => {
    try {
      setLoading(true);

      // Get rooms of selected type
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('id, room_number')
        .eq('room_type_id', selectedRoomType)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('room_number', { ascending: true });

      if (roomsError) throw roomsError;
      setRooms(roomsData || []);

      // Get date range based on view mode
      const { startDate, endDate } = getDateRange();

      // Get booked rooms for those rooms in the date range
      const roomIds = roomsData?.map(r => r.id) || [];
      if (roomIds.length === 0) {
        setBookings([]);
        return;
      }

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('booked_rooms')
        .select(`
          id,
          room_id,
          check_in,
          check_out,
          status,
          user_id,
          bookings (
            id,
            booking_status,
            guests (id, full_name)
          )
        `)
        .eq('user_id', userId)
        .in('room_id', roomIds)
        .or(`check_in.lte.${endDate.toISOString()},check_out.gte.${startDate.toISOString()}`)
        .order('check_in', { ascending: true});

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);
    } catch (error) {
      console.error('Error fetching room bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHallBookings = async () => {
    try {
      setLoading(true);

      // Get halls of selected type
      const { data: hallsData, error: hallsError } = await supabase
        .from('halls')
        .select('id, hall_number')
        .eq('hall_type_id', selectedHallType)
        .eq('user_id', userId)
        .order('hall_number', { ascending: true });

      if (hallsError) throw hallsError;
      setHalls(hallsData || []);

      // Get date range based on view mode
      const { startDate, endDate } = getDateRange();

      // Get booked halls for those halls in the date range
      const hallIds = hallsData?.map(h => h.id) || [];
      if (hallIds.length === 0) {
        setBookings([]);
        return;
      }

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('booked_halls')
        .select(`
          id,
          hall_id,
          check_in,
          check_out,
          status,
          booking_basis,
          user_id,
          bookings (
            id,
            booking_status,
            guests (id, full_name)
          )
        `)
        .eq('user_id', userId)
        .in('hall_id', hallIds)
        .or(`check_in.lte.${endDate.toISOString()},check_out.gte.${startDate.toISOString()}`)
        .order('check_in', { ascending: true });

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);
    } catch (error) {
      console.error('Error fetching hall bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const date = new Date(currentDate);
    let startDate, endDate;

    if (viewMode === 'month') {
      startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    } else if (viewMode === 'week') {
      const dayOfWeek = date.getDay();
      startDate = new Date(date);
      startDate.setDate(date.getDate() - dayOfWeek);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else {
      startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  };

  const handleRoomTypeChange = (value) => {
    setSelectedRoomType(value);
    setSelectedHallType('');
  };

  const handleHallTypeChange = (value) => {
    setSelectedHallType(value);
    setSelectedRoomType('');
  };

  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDateHeader = () => {
    const options = { year: 'numeric', month: 'long' };
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', { ...options, day: 'numeric', weekday: 'long' });
    }
    return currentDate.toLocaleDateString('en-US', options);
  };

  return (
    <div className="space-y-3">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Availability Calendar</h1>
          <p className="text-xs text-neutral-500 mt-0.5">View room and hall availability</p>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white rounded-xl border border-neutral-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Type Selectors */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Room Type Selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                  <BedDouble className="w-3.5 h-3.5 text-neutral-600" />
                  Room Type
                </label>
                <select
                  value={selectedRoomType}
                  onChange={(e) => handleRoomTypeChange(e.target.value)}
                  className="border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400 min-w-[150px] bg-white"
                >
                  <option value="">--Select--</option>
                  {roomTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hall Type Selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-neutral-600" />
                  Hall Type
                </label>
                <select
                  value={selectedHallType}
                  onChange={(e) => handleHallTypeChange(e.target.value)}
                  className="border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400 min-w-[150px] bg-white"
                >
                  <option value="">--Select--</option>
                  {hallTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* View Mode Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  viewMode === 'month'
                    ? 'bg-[#472F97] text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  viewMode === 'week'
                    ? 'bg-[#472F97] text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  viewMode === 'day'
                    ? 'bg-[#472F97] text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                Day
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Navigation */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Navigation Header */}
          <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={navigatePrevious}
                className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-neutral-600" />
              </button>
              <button
                onClick={navigateNext}
                className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-neutral-600" />
              </button>
              <button
                onClick={goToToday}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-neutral-600 transition-colors"
              >
                Today
              </button>
            </div>
            <h2 className="text-sm font-semibold text-neutral-900">{formatDateHeader()}</h2>
            <div className="w-[100px] hidden sm:block"></div> {/* Spacer for centering */}
          </div>

          {/* Calendar Content */}
          <div className="p-4">
            {!selectedRoomType && !selectedHallType ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-500 text-sm">Select a Room Type or Hall Type to view availability</p>
              </div>
            ) : loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#472F97] mx-auto mb-3"></div>
                <p className="text-neutral-500 text-sm">Loading calendar...</p>
              </div>
            ) : (
              <>
                {viewMode === 'month' && (
                  <MonthView
                    currentDate={currentDate}
                    bookings={bookings}
                    rooms={rooms}
                    halls={halls}
                    isRoomView={!!selectedRoomType}
                  />
                )}
                {viewMode === 'week' && (
                  <WeekView
                    currentDate={currentDate}
                    bookings={bookings}
                    rooms={rooms}
                    halls={halls}
                    isRoomView={!!selectedRoomType}
                  />
                )}
                {viewMode === 'day' && (
                  <DayView
                    currentDate={currentDate}
                    bookings={bookings}
                    rooms={rooms}
                    halls={halls}
                    isRoomView={!!selectedRoomType}
                  />
                )}
              </>
            )}
          </div>

          {/* Legend */}
          {(selectedRoomType || selectedHallType) && (
            <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div>
                  <span className="text-neutral-600">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-red-100 border border-red-300"></div>
                  <span className="text-neutral-600">Booked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></div>
                  <span className="text-neutral-600">Checked In</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-neutral-200 border border-neutral-300"></div>
                  <span className="text-neutral-600">Checked Out</span>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  );
};

export default AvailabilityCalendarPage;
