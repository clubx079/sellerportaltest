'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Calendar, BedDouble, User, CreditCard, Building2, Users, Clock, CheckCircle, XCircle, DollarSign, Phone, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ViewForm = ({ isOpen, onClose, booking, onOpenPayment, onOpenRoomAssignment, onStatusChange, currency = '$' }) => {
  const [mounted, setMounted] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [headGuest, setHeadGuest] = useState(null);
  const [additionalGuests, setAdditionalGuests] = useState([]);
  const [loadingGuests, setLoadingGuests] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && booking?.id) {
      fetchBookingGuests();
    }
  }, [isOpen, booking?.id]);

  const fetchBookingGuests = async () => {
    try {
      setLoadingGuests(true);
      const { data, error } = await supabase
        .from('booking_guests')
        .select(`
          id,
          is_head_guest,
          guests (id, full_name, phone, cnic, is_vip)
        `)
        .eq('booking_id', booking.id);

      if (error) throw error;

      const head = data?.find(bg => bg.is_head_guest);
      const additional = data?.filter(bg => !bg.is_head_guest) || [];

      setHeadGuest(head?.guests || null);
      setAdditionalGuests(additional.map(bg => bg.guests));
    } catch (error) {
      console.error('Error fetching booking guests:', error);
    } finally {
      setLoadingGuests(false);
    }
  };

  if (!mounted || !booking) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateNights = () => {
    if (!booking.check_in || !booking.check_out) return 0;
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    return Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  };

  const getBookingStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
      case 'canceled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'partial':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      setUpdatingStatus(true);
      const { error } = await supabase
        .from('bookings')
        .update({ booking_status: newStatus })
        .eq('id', booking.id);

      if (error) throw error;

      onStatusChange({ ...booking, booking_status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const roomInfo = booking.booked_rooms?.[0]?.rooms;
  const hallInfo = booking.booked_halls?.[0]?.halls;
  const totalAmount = parseFloat(booking.total_amount) || 0;
  const paidAmount = parseFloat(booking.paid_amount) || 0;
  const balanceAmount = totalAmount - paidAmount;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0 }}
            className="fixed right-0 top-0 h-screen w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Booking #{booking.id}</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">View reservation details</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Status Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <p className="text-[10px] sm:text-xs text-neutral-500 mb-1">Booking Status</p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getBookingStatusColor(booking.booking_status)}`}>
                      {booking.booking_status?.charAt(0).toUpperCase() + booking.booking_status?.slice(1) || 'Pending'}
                    </span>
                  </div>
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <p className="text-[10px] sm:text-xs text-neutral-500 mb-1">Payment Status</p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getPaymentStatusColor(booking.payment_status)}`}>
                      {booking.payment_status?.charAt(0).toUpperCase() + booking.payment_status?.slice(1) || 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Head Guest Information */}
                <div className="bg-gradient-to-br from-[#F5F3FF] to-white rounded-xl p-4 border-2 border-[#472F97]/20">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#472F97]" />
                    Head Guest
                  </h3>
                  {loadingGuests ? (
                    <div className="text-center py-2">
                      <span className="text-xs text-neutral-500">Loading...</span>
                    </div>
                  ) : headGuest ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-500">Name</span>
                        <span className="text-sm font-medium text-neutral-900">
                          {headGuest.full_name}
                          {headGuest.is_vip && <span className="ml-1 text-yellow-500">⭐</span>}
                        </span>
                      </div>
                      {headGuest.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">Phone</span>
                          <span className="text-sm font-medium text-neutral-900 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-neutral-400" />
                            {headGuest.phone}
                          </span>
                        </div>
                      )}
                      {headGuest.cnic && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">CNIC</span>
                          <span className="text-sm font-medium text-neutral-900">
                            {headGuest.cnic}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <span className="text-xs text-neutral-500">No head guest assigned</span>
                    </div>
                  )}
                </div>

                {/* Additional Guests */}
                {additionalGuests.length > 0 && (
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Additional Guests ({additionalGuests.length})
                    </h3>
                    <div className="space-y-2">
                      {additionalGuests.map((guest, index) => (
                        <div key={guest.id} className="bg-white rounded-lg p-3 border border-neutral-200">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-medium text-neutral-700">
                              Guest {index + 1}
                              {guest.is_vip && <span className="ml-1 text-yellow-500">⭐</span>}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-500">Name</span>
                              <span className="text-xs font-medium text-neutral-900">{guest.full_name}</span>
                            </div>
                            {guest.phone && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-neutral-500">Phone</span>
                                <span className="text-xs font-medium text-neutral-900 flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-neutral-400" />
                                  {guest.phone}
                                </span>
                              </div>
                            )}
                            {guest.cnic && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-neutral-500">CNIC</span>
                                <span className="text-xs font-medium text-neutral-900">{guest.cnic}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Room/Hall Details */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    {booking.booking_type === 'room' ? <BedDouble className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                    {booking.booking_type === 'room' ? 'Room' : 'Hall'} Details
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Type</span>
                      <span className="text-sm font-medium text-neutral-900 capitalize">{booking.booking_type || 'Room'}</span>
                    </div>
                    {roomInfo && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">Room Number</span>
                          <span className="text-sm font-semibold text-neutral-900">{roomInfo.room_number}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">Room Type</span>
                          <span className="text-sm font-medium text-neutral-900">{roomInfo.room_types?.title || 'N/A'}</span>
                        </div>
                      </>
                    )}
                    {hallInfo && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">Hall Number</span>
                          <span className="text-sm font-semibold text-neutral-900">{hallInfo.hall_number}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">Hall Type</span>
                          <span className="text-sm font-medium text-neutral-900">{hallInfo.hall_types?.title || 'N/A'}</span>
                        </div>
                      </>
                    )}
                    {!roomInfo && !hallInfo && (
                      <div className="text-center py-3">
                        <span className="text-xs text-neutral-500">No room/hall assigned yet</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Check In/Out Details */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Stay Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-neutral-400 mb-1">Check In</p>
                      <p className="text-sm font-medium text-neutral-900">{formatDate(booking.check_in)}</p>
                      <p className="text-xs text-neutral-500">{formatTime(booking.check_in)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-400 mb-1">Check Out</p>
                      <p className="text-sm font-medium text-neutral-900">{formatDate(booking.check_out)}</p>
                      <p className="text-xs text-neutral-500">{formatTime(booking.check_out)}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-neutral-200 flex items-center justify-between">
                    <span className="text-xs text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Duration
                    </span>
                    <span className="text-sm font-semibold text-neutral-900">{calculateNights()} Night(s)</span>
                  </div>
                </div>

                {/* Occupancy */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Occupancy
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-neutral-200 text-center">
                      <p className="text-2xl font-bold text-neutral-900">{booking.adults || 0}</p>
                      <p className="text-xs text-neutral-500">Adults</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-neutral-200 text-center">
                      <p className="text-2xl font-bold text-neutral-900">{booking.kids || 0}</p>
                      <p className="text-xs text-neutral-500">Kids</p>
                    </div>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Summary
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Total Amount</span>
                      <span className="text-sm font-semibold text-neutral-900">{currency}{totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Paid Amount</span>
                      <span className="text-sm font-medium text-green-600">{currency}{paidAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                      <span className="text-xs font-medium text-neutral-700">Balance Due</span>
                      <span className={`text-sm font-bold ${balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {currency}{balanceAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {booking.coupons && (
                    <div className="mt-3 pt-3 border-t border-neutral-200">
                      <div className="flex items-center gap-2 text-xs text-neutral-600">
                        <Tag className="w-3 h-3" />
                        Coupon Applied: <span className="font-semibold">{booking.coupons.coupon_code}</span>
                        <span className="text-green-600">(-{currency}{booking.coupons.coupon_value})</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3">Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleStatusUpdate('confirmed')}
                      disabled={updatingStatus || booking.booking_status === 'confirmed'}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium rounded-lg border border-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Confirm
                    </button>
                    <button
                      onClick={() => handleStatusUpdate('cancelled')}
                      disabled={updatingStatus || booking.booking_status === 'cancelled'}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium rounded-lg border border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                    <button
                      onClick={() => onOpenPayment?.(booking)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg border border-blue-200 transition-colors"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Payment
                    </button>
                    <button
                      onClick={() => onOpenRoomAssignment?.(booking)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium rounded-lg border border-purple-200 transition-colors"
                    >
                      <BedDouble className="w-3.5 h-3.5" />
                      Assign Room
                    </button>
                  </div>
                </div>

                {/* Booking Info */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3">Booking Information</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Booking ID</span>
                      <span className="font-medium text-neutral-900">#{booking.id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Created At</span>
                      <span className="font-medium text-neutral-900">{formatDate(booking.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-4 flex items-center">
              <button
                onClick={onClose}
                className="w-full px-3 sm:px-4 py-2.5 bg-[#472F97] hover:bg-[#3a2578] text-white text-sm font-medium rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ViewForm;
