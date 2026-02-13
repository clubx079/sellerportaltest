"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, Calendar, BedDouble, Filter, ChevronLeft, ChevronRight, DollarSign, Clock } from 'lucide-react';
import AddForm from '@/components/bookings/AddForm';
import EditForm from '@/components/bookings/EditForm';
import ViewForm from '@/components/bookings/ViewForm';
import PaymentModal from '@/components/bookings/PaymentModal';
import RoomAssignmentModal from '@/components/bookings/RoomAssignmentModal';
import DeleteConfirmModal from '@/components/bookings/DeleteConfirmModal';
import { getCurrentCurrencySymbol } from '@/lib/currency';

const BookingsManagement = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRoomAssignmentModal, setShowRoomAssignmentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterBookingStatus, setFilterBookingStatus] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [userId, setUserId] = useState(null);
  const [currency, setCurrency] = useState('$');

  // Prevent body scroll when any modal is open
  useEffect(() => {
    if (showAddModal || showEditModal || showViewModal || showPaymentModal || showRoomAssignmentModal || showDeleteModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAddModal, showEditModal, showViewModal, showPaymentModal, showRoomAssignmentModal, showDeleteModal]);

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
      fetchBookings();
    }
  }, [userId]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
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
        `)
        .eq('user_id', userId)
        .order('id', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter bookings based on search term and filters
  const filteredBookings = bookings.filter(booking => {
    const matchesSearch =
      booking.id?.toString().includes(searchTerm) ||
      booking.guests?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.guests?.phone?.includes(searchTerm);

    const matchesBookingStatus = !filterBookingStatus || booking.booking_status === filterBookingStatus;
    const matchesPaymentStatus = !filterPaymentStatus || booking.payment_status === filterPaymentStatus;
    const matchesCheckIn = !checkInDate || new Date(booking.check_in).toISOString().split('T')[0] === checkInDate;
    const matchesCheckOut = !checkOutDate || new Date(booking.check_out).toISOString().split('T')[0] === checkOutDate;
    const matchesBookingDate = !bookingDate || new Date(booking.created_at).toISOString().split('T')[0] === bookingDate;

    return matchesSearch && matchesBookingStatus && matchesPaymentStatus && matchesCheckIn && matchesCheckOut && matchesBookingDate;
  });

  // Pagination
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredBookings.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredBookings.length / entriesPerPage);

  // Handle delete
  const handleDeleteClick = (booking) => {
    setSelectedBooking(booking);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', selectedBooking.id)
        .eq('user_id', userId);

      if (error) throw error;

      setBookings(prev => prev.filter(b => b.id !== selectedBooking.id));
      setShowDeleteModal(false);
      setSelectedBooking(null);
    } catch (error) {
      console.error('Error deleting booking:', error);
      alert('Failed to delete booking: ' + error.message);
    }
  };

  const getBookingStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'confirmed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'cancelled':
      case 'canceled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'paid':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'partial':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const clearFilters = () => {
    setCheckInDate('');
    setCheckOutDate('');
    setBookingDate('');
    setFilterBookingStatus('');
    setFilterPaymentStatus('');
    setSearchTerm('');
  };

  // Calculate stats
  const totalBookings = bookings.length;
  const pendingBookings = bookings.filter(b => b.booking_status === 'pending').length;
  const confirmedBookings = bookings.filter(b => b.booking_status === 'confirmed' || b.booking_status === 'success').length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Bookings</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage your hotel reservations</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Add Booking</span>
          </button>
        </div>

        {/* Compact Stats Cards - Responsive grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Total Bookings</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{totalBookings}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Pending</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{pendingBookings}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Confirmed</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{confirmedBookings}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <BedDouble className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Revenue</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{currency}{totalRevenue.toFixed(0)}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Controls - Responsive */}
          <div className="px-3 md:px-4 py-2.5 border-b border-neutral-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
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
                  placeholder="Search by ID or guest name..."
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

            {/* Filters Row - Responsive */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="relative">
                <label className="absolute -top-2 left-2 bg-white px-1 text-[9px] text-neutral-400">Check In</label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                />
              </div>
              <div className="relative">
                <label className="absolute -top-2 left-2 bg-white px-1 text-[9px] text-neutral-400">Check Out</label>
                <input
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                />
              </div>
              <div className="relative">
                <label className="absolute -top-2 left-2 bg-white px-1 text-[9px] text-neutral-400">Booking Date</label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                />
              </div>
              <select
                value={filterBookingStatus}
                onChange={(e) => setFilterBookingStatus(e.target.value)}
                className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
              >
                <option value="">Booking Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="success">Success</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={filterPaymentStatus}
                onChange={(e) => setFilterPaymentStatus(e.target.value)}
                className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
              >
                <option value="">Payment Status</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
              <button
                onClick={clearFilters}
                className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg px-2 py-1.5 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[900px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">ID</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Guest</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Room/Hall</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Check In</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Check Out</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Amount</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Payment</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-3 py-2.5 text-right text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 py-2.5"><div className="h-4 w-6 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-10 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-14 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-3 md:px-5 py-8 md:py-10 text-center">
                      <Calendar className="w-8 h-8 md:w-10 md:h-10 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-xs md:text-sm font-medium">No bookings found</p>
                      <p className="text-[10px] md:text-xs text-neutral-400 mt-1">Try adjusting your search or add a new booking</p>
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
                        <div>
                          <p className="text-xs font-medium text-neutral-900">{booking.guests?.full_name || 'N/A'}</p>
                          {booking.guests?.phone && (
                            <p className="text-[10px] text-neutral-400">{booking.guests.phone}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <BedDouble className="w-3 h-3 text-neutral-400" />
                          <span className="text-xs text-neutral-700">
                            {booking.booking_type === 'room'
                              ? (booking.booked_rooms?.[0]?.rooms?.room_number
                                  ? `${booking.booked_rooms[0].rooms.room_number}`
                                  : 'Not Assigned')
                              : (booking.booked_halls?.[0]?.halls?.hall_number
                                  ? `Hall ${booking.booked_halls[0].halls.hall_number}`
                                  : 'Not Assigned')}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-neutral-600">{formatDate(booking.check_in)}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-neutral-600">{formatDate(booking.check_out)}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-neutral-900">
                          {currency}{parseFloat(booking.total_amount || 0).toFixed(0)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getPaymentStatusColor(booking.payment_status)}`}>
                          {booking.payment_status?.charAt(0).toUpperCase() + booking.payment_status?.slice(1) || 'Pending'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getBookingStatusColor(booking.booking_status)}`}>
                          {booking.booking_status?.charAt(0).toUpperCase() + booking.booking_status?.slice(1) || 'Pending'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowViewModal(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(booking)}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer - Pagination */}
          <div className="px-3 md:px-4 py-2 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs text-neutral-500">
              Showing <span className="font-medium text-neutral-700">{filteredBookings.length > 0 ? indexOfFirstEntry + 1 : 0}</span> to{' '}
              <span className="font-medium text-neutral-700">{Math.min(indexOfLastEntry, filteredBookings.length)}</span> of{' '}
              <span className="font-medium text-neutral-700">{filteredBookings.length}</span> entries
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[28px] h-7 px-2 text-xs font-medium rounded-lg transition-colors ${
                        currentPage === pageNum
                          ? 'bg-[#472F97] text-white'
                          : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <AddForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newBooking) => {
            setBookings(prev => [newBooking, ...prev]);
          }}
          userId={userId}
          currency={currency}
        />

        <EditForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedBooking(null);
          }}
          onSuccess={() => {
            fetchBookings();
            setShowEditModal(false);
            setSelectedBooking(null);
          }}
          booking={selectedBooking}
          userId={userId}
          currency={currency}
        />

        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedBooking(null);
          }}
          booking={selectedBooking}
          onOpenPayment={(booking) => {
            setSelectedBooking(booking);
            setShowPaymentModal(true);
            setShowViewModal(false);
          }}
          onOpenRoomAssignment={(booking) => {
            setSelectedBooking(booking);
            setShowRoomAssignmentModal(true);
            setShowViewModal(false);
          }}
          onStatusChange={(updatedBooking) => {
            setBookings(prev => prev.map(b =>
              b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b
            ));
          }}
          currency={currency}
        />

        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedBooking(null);
          }}
          booking={selectedBooking}
          onSuccess={() => {
            fetchBookings();
          }}
          userId={userId}
          currency={currency}
        />

        <RoomAssignmentModal
          isOpen={showRoomAssignmentModal}
          onClose={() => {
            setShowRoomAssignmentModal(false);
            setSelectedBooking(null);
          }}
          booking={selectedBooking}
          onSuccess={() => {
            fetchBookings();
          }}
          userId={userId}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedBooking(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={`Booking #${selectedBooking?.id}` || 'this booking'}
        />
    </div>
  );
};

export default BookingsManagement;
