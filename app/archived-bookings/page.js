"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Eye, Search, X, Archive, Filter, BedDouble, Building2, Calendar, DollarSign, User } from 'lucide-react';
import ViewForm from '@/components/archived-bookings/ViewForm';
import { getCurrentCurrencySymbol } from '@/lib/currency';

const ArchivedBookingsManagement = () => {
  const [archivedBookings, setArchivedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterRoomType, setFilterRoomType] = useState('');
  const [filterBookingStatus, setFilterBookingStatus] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterHallType, setFilterHallType] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [roomTypes, setRoomTypes] = useState([]);
  const [hallTypes, setHallTypes] = useState([]);
  const [userId, setUserId] = useState(null);
  const [currency, setCurrency] = useState('$');

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showViewModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showViewModal]);

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
      fetchArchivedBookings();
      fetchRoomTypes();
      fetchHallTypes();
    }
  }, [userId]);

  const fetchArchivedBookings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('archived_bookings')
        .select(`
          id,
          completed_at,
          bookings:booking_id (
            id,
            guest_id,
            booking_type,
            adults,
            kids,
            check_in,
            check_out,
            total_amount,
            paid_amount,
            payment_status,
            booking_status,
            created_at,
            guests (id, full_name, phone, is_vip),
            coupons (coupon_code, coupon_value),
            booked_rooms (
              id,
              room_id,
              check_in,
              check_out,
              status,
              rooms (id, room_number, room_type_id, room_types (id, title))
            ),
            booked_halls (
              id,
              hall_id,
              booking_basis,
              check_in,
              check_out,
              status,
              halls (id, hall_number, hall_type_id, hall_types (id, title))
            )
          )
        `)
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Archived bookings raw data:', data);
      console.log('Total archived records:', data?.length || 0);

      // Transform data to match the expected format
      const transformedData = (data || []).map(archive => ({
        ...archive.bookings,
        archived_id: archive.id,
        completed_at: archive.completed_at
      })).filter(booking => booking.id); // Filter out null bookings

      console.log('Transformed bookings:', transformedData);
      console.log('Final count:', transformedData.length);

      setArchivedBookings(transformedData);
    } catch (error) {
      console.error('Error fetching archived bookings:', error);
      alert('Failed to load archived bookings. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoomTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('room_types')
        .select('id, title')
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
        .select('id, title')
        .eq('user_id', userId)
        .order('title', { ascending: true });

      if (error) throw error;
      setHallTypes(data || []);
    } catch (error) {
      console.error('Error fetching hall types:', error);
    }
  };

  // Filter archived bookings
  const filteredBookings = archivedBookings.filter(booking => {
    if (!booking) return false;

    const matchesSearch =
      booking.id?.toString().includes(searchTerm) ||
      booking.guests?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.guests?.phone?.includes(searchTerm);

    const matchesPaymentStatus = !filterPaymentStatus || booking.payment_status === filterPaymentStatus;
    const matchesCheckIn = !checkInDate || new Date(booking.check_in).toISOString().split('T')[0] === checkInDate;
    const matchesCheckOut = !checkOutDate || new Date(booking.check_out).toISOString().split('T')[0] === checkOutDate;
    const matchesBookingDate = !bookingDate || new Date(booking.created_at).toISOString().split('T')[0] === bookingDate;

    // Filter by room type
    let matchesRoomType = true;
    if (filterRoomType && booking.booked_rooms) {
      matchesRoomType = booking.booked_rooms.some(br =>
        br.rooms?.room_types?.id?.toString() === filterRoomType
      );
    }

    // Filter by hall type
    let matchesHallType = true;
    if (filterHallType && booking.booked_halls) {
      matchesHallType = booking.booked_halls.some(bh =>
        bh.halls?.hall_types?.id?.toString() === filterHallType
      );
    }

    return matchesSearch && matchesPaymentStatus &&
           matchesCheckIn && matchesCheckOut && matchesBookingDate &&
           matchesRoomType && matchesHallType;
  });

  // Pagination
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredBookings.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredBookings.length / entriesPerPage);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get room/hall info
  const getRoomHallInfo = (booking) => {
    if (!booking) return 'N/A';

    if (booking.booking_type === 'room' && booking.booked_rooms?.length > 0) {
      const bookedRoom = booking.booked_rooms[0];
      if (bookedRoom.rooms?.room_number) {
        return `Room ${bookedRoom.rooms.room_number} (${bookedRoom.rooms.room_types?.title || 'N/A'})`;
      }
      return bookedRoom.rooms?.room_types?.title || 'Room - Not Assigned';
    } else if (booking.booking_type === 'hall' && booking.booked_halls?.length > 0) {
      const bookedHall = booking.booked_halls[0];
      if (bookedHall.halls?.hall_number) {
        return `Hall ${bookedHall.halls.hall_number} (${bookedHall.halls.hall_types?.title || 'N/A'})`;
      }
      return bookedHall.halls?.hall_types?.title || 'Hall - Not Assigned';
    }
    return 'N/A';
  };

  // Calculate stats
  const totalBookings = archivedBookings.length;
  const totalRevenue = archivedBookings.reduce((sum, booking) => sum + (parseFloat(booking.total_amount) || 0), 0);
  const paidBookings = archivedBookings.filter(b => b.payment_status === 'success' || b.payment_status === 'paid').length;

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-100 flex items-center justify-center">
              <Archive className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-700" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Archived Bookings</h1>
              <p className="text-xs text-neutral-500 mt-0.5">View completed bookings history</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Total Completed</p>
                <p className="text-xl font-semibold text-neutral-900 mt-1">{totalBookings}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Archive className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Total Revenue</p>
                <p className="text-xl font-semibold text-neutral-900 mt-1">{currency}{totalRevenue.toFixed(0)}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#472F97] flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Paid Bookings</p>
                <p className="text-xl font-semibold text-neutral-900 mt-1">{paidBookings}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Filters Section */}
          <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </h3>

            {/* Filter Row 1 - Date Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
              <input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                placeholder="Check In"
                className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
              <input
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                placeholder="Check Out"
                className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                placeholder="Booking Date"
                className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
              <select
                value={filterPaymentStatus}
                onChange={(e) => setFilterPaymentStatus(e.target.value)}
                className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="">All Payment Status</option>
                <option value="pending">Pending</option>
                <option value="success">Success</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Filter Row 2 - Type Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={filterRoomType}
                onChange={(e) => setFilterRoomType(e.target.value)}
                className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="">All Room Types</option>
                {roomTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.title}</option>
                ))}
              </select>
              <select
                value={filterHallType}
                onChange={(e) => setFilterHallType(e.target.value)}
                className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="">All Hall Types</option>
                {hallTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Search and Entries */}
          <div className="px-4 py-3 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-neutral-400 hidden sm:block" />
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
              >
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
              </select>
            </div>

            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                placeholder="Search by booking ID, guest name, or phone..."
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Booking ID</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Guest Name</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Room / Hall</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Check In</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Check Out</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Booking Date</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Total Amount</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Payment</th>
                  <th className="px-3 py-2.5 text-center text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 py-2.5"><div className="h-4 w-6 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-32 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-12 bg-neutral-100 rounded mx-auto"></div></td>
                    </tr>
                  ))
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-5 py-10 text-center">
                      <Archive className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-sm font-medium">No archived bookings found</p>
                      <p className="text-xs text-neutral-400 mt-1">Try adjusting your search filters</p>
                    </td>
                  </tr>
                ) : (
                  currentEntries.map((booking, index) => (
                    <tr key={booking.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-medium text-neutral-400">{indexOfFirstEntry + index + 1}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-neutral-900">#{booking.id}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="text-xs text-neutral-700">{booking.guests?.full_name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {booking.booking_type === 'room' ? (
                            <BedDouble className="w-3.5 h-3.5 text-neutral-400" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                          )}
                          <span className="text-xs text-neutral-600">{getRoomHallInfo(booking)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-neutral-600">{formatDate(booking.check_in)}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-neutral-600">{formatDate(booking.check_out)}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-neutral-600">{formatDateTime(booking.created_at)}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-neutral-900">{currency}{parseFloat(booking.total_amount || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                          booking.payment_status === 'success' || booking.payment_status === 'paid'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : booking.payment_status === 'pending'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {booking.payment_status?.charAt(0).toUpperCase() + booking.payment_status?.slice(1) || 'N/A'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowViewModal(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer with Pagination */}
          <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-200">
            <div className="text-xs text-neutral-500">
              Showing <span className="font-medium text-neutral-700">{filteredBookings.length > 0 ? indexOfFirstEntry + 1 : 0}</span> to{' '}
              <span className="font-medium text-neutral-700">{Math.min(indexOfLastEntry, filteredBookings.length)}</span> of{' '}
              <span className="font-medium text-neutral-700">{filteredBookings.length}</span> entries
            </div>
          </div>
        </div>

        {/* View Modal */}
        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedBooking(null);
          }}
          archivedBooking={selectedBooking}
          currency={currency}
        />
    </div>
  );
};

export default ArchivedBookingsManagement;
