'use client';

import { X, Calendar, User, Phone, Mail, DollarSign, Users, Baby, BedDouble, Building2, Clock, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ViewForm = ({ isOpen, onClose, archivedBooking, currency = '$' }) => {
  if (!archivedBooking) return null;

  // archivedBooking is now the booking object directly
  const booking = archivedBooking;

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'confirmed':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'cancelled':
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Side Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[800px] bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-6 py-4 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <Archive className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Archived Booking Details</h2>
                  <p className="text-xs text-white/70">Booking ID: #{booking.id}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-5">
              {/* Booking Info */}
              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                  <Archive className="w-4 h-4" />
                  Booking Information
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Booking Date:</span>
                    <span className="text-sm font-semibold text-neutral-900">{formatDateTime(booking.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Booking Type:</span>
                    <span className="text-sm font-semibold text-neutral-900 capitalize">{booking.booking_type || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                <h3 className="text-sm font-bold text-neutral-900 mb-3">Status</h3>
                <div className="flex gap-3">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border ${getStatusColor(booking.booking_status)}`}>
                    Booking: {booking.booking_status?.charAt(0).toUpperCase() + booking.booking_status?.slice(1) || 'N/A'}
                  </span>
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border ${getStatusColor(booking.payment_status)}`}>
                    Payment: {booking.payment_status?.charAt(0).toUpperCase() + booking.payment_status?.slice(1) || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Guest Information */}
              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Guest Information
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Name:</span>
                    <span className="text-sm font-semibold text-neutral-900">{booking.guests?.full_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Phone:</span>
                    <span className="text-sm font-semibold text-neutral-900">{booking.guests?.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">VIP Status:</span>
                    <span className={`text-sm font-semibold ${booking.guests?.is_vip ? 'text-yellow-600' : 'text-neutral-900'}`}>
                      {booking.guests?.is_vip ? '⭐ VIP Guest' : 'Regular Guest'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Room/Hall Information */}
              {booking.booking_type === 'room' && booking.booked_rooms?.length > 0 && (
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                    <BedDouble className="w-4 h-4" />
                    Room Information
                  </h3>
                  {booking.booked_rooms.map((br, index) => (
                    <div key={br.id} className="space-y-2">
                      {index > 0 && <hr className="border-neutral-200 my-2" />}
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-600">Room Number:</span>
                        <span className="text-sm font-semibold text-neutral-900">{br.rooms?.room_number || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-600">Room Type:</span>
                        <span className="text-sm font-semibold text-neutral-900">{br.rooms?.room_types?.title || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-600">Status:</span>
                        <span className={`text-sm font-semibold capitalize ${
                          br.status === 'checked_out' ? 'text-neutral-600' :
                          br.status === 'checked_in' ? 'text-green-600' : 'text-yellow-600'
                        }`}>{br.status?.replace('_', ' ') || 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {booking.booking_type === 'hall' && booking.booked_halls?.length > 0 && (
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Hall Information
                  </h3>
                  {booking.booked_halls.map((bh, index) => (
                    <div key={bh.id} className="space-y-2">
                      {index > 0 && <hr className="border-neutral-200 my-2" />}
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-600">Hall Number:</span>
                        <span className="text-sm font-semibold text-neutral-900">{bh.halls?.hall_number || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-600">Hall Type:</span>
                        <span className="text-sm font-semibold text-neutral-900">{bh.halls?.hall_types?.title || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-600">Booking Basis:</span>
                        <span className="text-sm font-semibold text-neutral-900 capitalize">{bh.booking_basis || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-600">Status:</span>
                        <span className={`text-sm font-semibold capitalize ${
                          bh.status === 'checked_out' ? 'text-neutral-600' :
                          bh.status === 'checked_in' ? 'text-green-600' : 'text-yellow-600'
                        }`}>{bh.status?.replace('_', ' ') || 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Booking Details */}
              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Booking Details
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Adults:</span>
                    <span className="text-sm font-semibold text-neutral-900">{booking.adults || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Kids:</span>
                    <span className="text-sm font-semibold text-neutral-900">{booking.kids || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Booking Date:</span>
                    <span className="text-sm font-semibold text-neutral-900">{formatDateTime(booking.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Check-in & Check-out Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-bold text-neutral-900 mb-3">Check In</h3>
                  <p className="text-sm text-neutral-700">{formatDateTime(booking.check_in)}</p>
                </div>
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-bold text-neutral-900 mb-3">Check Out</h3>
                  <p className="text-sm text-neutral-700">{formatDateTime(booking.check_out)}</p>
                </div>
              </div>

              {/* Payment Information */}
              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Payment Information
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Total Amount:</span>
                    <span className="text-sm font-semibold text-neutral-900">{currency}{booking.total_amount || '0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Paid Amount:</span>
                    <span className="text-sm font-semibold text-neutral-900">{currency}{booking.paid_amount || '0'}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-neutral-200">
                    <span className="text-sm text-neutral-600 font-semibold">Balance:</span>
                    <span className={`text-sm font-bold ${
                      (parseFloat(booking.total_amount || 0) - parseFloat(booking.paid_amount || 0)) > 0
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}>
                      {currency}{(parseFloat(booking.total_amount || 0) - parseFloat(booking.paid_amount || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons - Sticky */}
            <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4">
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl transition-all duration-300"
              >
                Close
              </button>
            </div>

            {/* Custom Scrollbar Styles */}
            <style jsx>{`
              .scrollbar-hide::-webkit-scrollbar {
                display: none;
              }

              .scrollbar-hide {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ViewForm;
