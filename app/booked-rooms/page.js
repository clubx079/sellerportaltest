"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, Calendar, BedDouble, Filter, ChevronLeft, ChevronRight, Clock, LogOut, Users } from 'lucide-react';
import AddForm from '@/components/booked-rooms/AddForm';
import EditForm from '@/components/booked-rooms/EditForm';
import ViewForm from '@/components/booked-rooms/ViewForm';
import CheckoutModal from '@/components/booked-rooms/CheckoutModal';
import DeleteConfirmModal from '@/components/booked-rooms/DeleteConfirmModal';
import { getCurrentCurrencySymbol } from '@/lib/currency';

const BookedRoomsManagement = () => {
  const [bookedRooms, setBookedRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBookedRoom, setSelectedBookedRoom] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [userId, setUserId] = useState(null);
  const [currency, setCurrency] = useState('$');

  // Prevent body scroll when any modal is open
  useEffect(() => {
    if (showAddModal || showEditModal || showViewModal || showCheckoutModal || showDeleteModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAddModal, showEditModal, showViewModal, showCheckoutModal, showDeleteModal]);

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
      fetchBookedRooms();
    }
  }, [userId]);

  const fetchBookedRooms = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('booked_rooms')
        .select(`
          *,
          bookings (
            id,
            booking_type,
            adults,
            kids,
            total_amount,
            paid_amount,
            payment_status,
            booking_status,
            created_at,
            guests (id, full_name, phone, is_vip)
          ),
          rooms (
            id,
            room_number,
            room_type_id,
            room_types (id, title, base_price)
          )
        `)
        .eq('user_id', userId)
        .order('id', { ascending: false });

      if (error) throw error;
      setBookedRooms(data || []);
    } catch (error) {
      console.error('Error fetching booked rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter booked rooms based on search term and filters
  const filteredBookedRooms = bookedRooms.filter(bookedRoom => {
    const matchesSearch =
      bookedRoom.id?.toString().includes(searchTerm) ||
      bookedRoom.booking_id?.toString().includes(searchTerm) ||
      bookedRoom.rooms?.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bookedRoom.bookings?.guests?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bookedRoom.bookings?.guests?.phone?.includes(searchTerm);

    const matchesStatus = !filterStatus || bookedRoom.status === filterStatus;
    const matchesCheckIn = !checkInDate || new Date(bookedRoom.check_in).toISOString().split('T')[0] === checkInDate;
    const matchesCheckOut = !checkOutDate || new Date(bookedRoom.check_out).toISOString().split('T')[0] === checkOutDate;

    return matchesSearch && matchesStatus && matchesCheckIn && matchesCheckOut;
  });

  // Pagination
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredBookedRooms.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredBookedRooms.length / entriesPerPage);

  // Handle delete
  const handleDeleteClick = (bookedRoom) => {
    setSelectedBookedRoom(bookedRoom);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('booked_rooms')
        .delete()
        .eq('id', selectedBookedRoom.id)
        .eq('user_id', userId);

      if (error) throw error;

      setBookedRooms(prev => prev.filter(b => b.id !== selectedBookedRoom.id));
      setShowDeleteModal(false);
      setSelectedBookedRoom(null);
    } catch (error) {
      console.error('Error deleting booked room:', error);
      alert('Failed to delete booked room: ' + error.message);
    }
  };

  const handleCheckoutClick = (bookedRoom) => {
    setSelectedBookedRoom(bookedRoom);
    setShowCheckoutModal(true);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'checked_in':
      case 'checkedin':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'booked':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'checked_out':
      case 'checkedout':
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const clearFilters = () => {
    setCheckInDate('');
    setCheckOutDate('');
    setFilterStatus('');
    setSearchTerm('');
  };

  // Calculate stats
  const totalBookedRooms = bookedRooms.length;
  const checkedInRooms = bookedRooms.filter(b => b.status === 'checked_in' || b.status === 'checkedin').length;
  const bookedRoomsCount = bookedRooms.filter(b => b.status === 'booked').length;
  const checkedOutRooms = bookedRooms.filter(b => b.status === 'checked_out' || b.status === 'checkedout').length;

  // Get latest check-in and check-out times
  const getLatestCheckIn = () => {
    const checkedInBookings = bookedRooms.filter(b => b.status === 'checked_in' || b.status === 'checkedin');
    if (checkedInBookings.length === 0) return null;
    // Get the most recent check-in
    const sorted = checkedInBookings.sort((a, b) => new Date(b.check_in) - new Date(a.check_in));
    return sorted[0]?.check_in;
  };

  const getLatestCheckOut = () => {
    const checkedOutBookings = bookedRooms.filter(b => b.status === 'checked_out' || b.status === 'checkedout');
    if (checkedOutBookings.length === 0) return null;
    // Get the most recent check-out
    const sorted = checkedOutBookings.sort((a, b) => new Date(b.check_out) - new Date(a.check_out));
    return sorted[0]?.check_out;
  };

  const latestCheckIn = getLatestCheckIn();
  const latestCheckOut = getLatestCheckOut();

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Booked Rooms</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage room bookings & check-ins</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Add Booked Room</span>
          </button>
        </div>

        {/* Compact Stats Cards - Responsive grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Total Booked</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{totalBookedRooms}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <BedDouble className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] md:text-xs text-neutral-500">Checked In</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{checkedInRooms}</p>
                {latestCheckIn && (
                  <p className="text-[9px] md:text-[10px] text-neutral-400 mt-0.5 truncate">
                    {formatDateTime(latestCheckIn)}
                  </p>
                )}
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Booked</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{bookedRoomsCount}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] md:text-xs text-neutral-500">Checked Out</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{checkedOutRooms}</p>
                {latestCheckOut && (
                  <p className="text-[9px] md:text-[10px] text-neutral-400 mt-0.5 truncate">
                    {formatDateTime(latestCheckOut)}
                  </p>
                )}
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center shrink-0">
                <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
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
                  placeholder="Search by booking ID, room or guest..."
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
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
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
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
              >
                <option value="">All Status</option>
                <option value="booked">Booked</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
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
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Booking ID</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Room</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Guest</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Check In</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Check Out</th>
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
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-3 md:px-5 py-8 md:py-10 text-center">
                      <BedDouble className="w-8 h-8 md:w-10 md:h-10 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-xs md:text-sm font-medium">No booked rooms found</p>
                      <p className="text-[10px] md:text-xs text-neutral-400 mt-1">Try adjusting your search or add a new booking</p>
                    </td>
                  </tr>
                ) : (
                  currentEntries.map((bookedRoom, index) => (
                    <tr key={bookedRoom.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-medium text-neutral-400">{indexOfFirstEntry + index + 1}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-neutral-900">#{bookedRoom.booking_id}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <BedDouble className="w-3 h-3 text-neutral-400" />
                          <div>
                            <p className="text-xs font-medium text-neutral-900">
                              {bookedRoom.rooms?.room_number || 'N/A'}
                            </p>
                            {bookedRoom.rooms?.room_types?.title && (
                              <p className="text-[10px] text-neutral-400">{bookedRoom.rooms.room_types.title}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div>
                          <p className="text-xs font-medium text-neutral-900">{bookedRoom.bookings?.guests?.full_name || 'Walk-in Guest'}</p>
                          {bookedRoom.bookings?.guests?.phone && (
                            <p className="text-[10px] text-neutral-400">{bookedRoom.bookings.guests.phone}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-neutral-600">{formatDateTime(bookedRoom.check_in)}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-neutral-600">{formatDateTime(bookedRoom.check_out)}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(bookedRoom.status)}`}>
                          {bookedRoom.status?.replace('_', ' ').charAt(0).toUpperCase() + bookedRoom.status?.replace('_', ' ').slice(1) || 'Booked'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => {
                              setSelectedBookedRoom(bookedRoom);
                              setShowViewModal(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBookedRoom(bookedRoom);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {(bookedRoom.status === 'checked_in' || bookedRoom.status === 'checkedin') && (
                            <button
                              onClick={() => handleCheckoutClick(bookedRoom)}
                              className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                              title="Checkout"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteClick(bookedRoom)}
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
              Showing <span className="font-medium text-neutral-700">{filteredBookedRooms.length > 0 ? indexOfFirstEntry + 1 : 0}</span> to{' '}
              <span className="font-medium text-neutral-700">{Math.min(indexOfLastEntry, filteredBookedRooms.length)}</span> of{' '}
              <span className="font-medium text-neutral-700">{filteredBookedRooms.length}</span> entries
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
          onSuccess={(newBookedRoom) => {
            setBookedRooms(prev => [newBookedRoom, ...prev]);
          }}
          userId={userId}
          currency={currency}
        />

        <EditForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedBookedRoom(null);
          }}
          onSuccess={() => {
            fetchBookedRooms();
            setShowEditModal(false);
            setSelectedBookedRoom(null);
          }}
          bookedRoom={selectedBookedRoom}
          userId={userId}
          currency={currency}
        />

        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedBookedRoom(null);
          }}
          bookedRoom={selectedBookedRoom}
          currency={currency}
        />

        <CheckoutModal
          isOpen={showCheckoutModal}
          onClose={() => {
            setShowCheckoutModal(false);
            setSelectedBookedRoom(null);
          }}
          bookedRoom={selectedBookedRoom}
          onSuccess={() => {
            fetchBookedRooms();
            setShowCheckoutModal(false);
            setSelectedBookedRoom(null);
          }}
          userId={userId}
          currency={currency}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedBookedRoom(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={`Booked Room #${selectedBookedRoom?.id}` || 'this booked room'}
        />
    </div>
  );
};

export default BookedRoomsManagement;
