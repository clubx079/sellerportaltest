'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Building2, User, Phone, DollarSign, Users, Clock, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ViewForm = ({ isOpen, onClose, bookedHall, currency = '$' }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !bookedHall) return null;

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

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'checked_in':
      case 'checkedin':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'booked':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'checked_out':
      case 'checkedout':
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const totalAmount = parseFloat(bookedHall.bookings?.total_amount) || 0;
  const paidAmount = parseFloat(bookedHall.bookings?.paid_amount) || 0;
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
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Booked Hall #{bookedHall.id}</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">Booking ID: #{bookedHall.booking_id}</p>
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
                {/* Status Card */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <p className="text-[10px] sm:text-xs text-neutral-500 mb-1">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(bookedHall.status)}`}>
                    {bookedHall.status?.replace('_', ' ').charAt(0).toUpperCase() + bookedHall.status?.replace('_', ' ').slice(1) || 'Booked'}
                  </span>
                </div>

                {/* Hall Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Hall Information
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Hall Number</span>
                      <span className="text-sm font-semibold text-neutral-900">{bookedHall.halls?.hall_number || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Hall Type</span>
                      <span className="text-sm font-medium text-neutral-900">{bookedHall.halls?.hall_types?.title || 'N/A'}</span>
                    </div>
                    {bookedHall.halls?.hall_types?.best_price && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-500">Best Price</span>
                        <span className="text-sm font-medium text-neutral-900">{currency}{parseFloat(bookedHall.halls.hall_types.best_price).toFixed(2)}/{bookedHall.booking_basis || 'day'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Booking Basis */}
                {bookedHall.booking_basis && (
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Booking Basis
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border bg-blue-100 text-blue-800 border-blue-200">
                      {bookedHall.booking_basis.charAt(0).toUpperCase() + bookedHall.booking_basis.slice(1)}
                    </span>
                  </div>
                )}

                {/* Guest Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Guest Information
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Name</span>
                      <span className="text-sm font-medium text-neutral-900">
                        {bookedHall.bookings?.guests?.full_name || 'Walk-in Guest'}
                        {bookedHall.bookings?.guests?.is_vip && <span className="ml-1 text-yellow-500">⭐</span>}
                      </span>
                    </div>
                    {bookedHall.bookings?.guests?.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-500">Phone</span>
                        <span className="text-sm font-medium text-neutral-900 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-white/70" />
                          {bookedHall.bookings.guests.phone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Check In/Out Details */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Booking Duration
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-white/70 mb-1">Check In</p>
                      <p className="text-sm font-medium text-neutral-900">{formatDate(bookedHall.check_in)}</p>
                      <p className="text-xs text-neutral-500">{formatTime(bookedHall.check_in)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/70 mb-1">Check Out</p>
                      <p className="text-sm font-medium text-neutral-900">{formatDate(bookedHall.check_out)}</p>
                      <p className="text-xs text-neutral-500">{formatTime(bookedHall.check_out)}</p>
                    </div>
                  </div>
                </div>

                {/* Occupancy */}
                {(bookedHall.bookings?.adults || bookedHall.bookings?.kids) && (
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Expected Attendance
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3 border border-neutral-200 text-center">
                        <p className="text-2xl font-bold text-neutral-900">{bookedHall.bookings?.adults || 0}</p>
                        <p className="text-xs text-neutral-500">Adults</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200 text-center">
                        <p className="text-2xl font-bold text-neutral-900">{bookedHall.bookings?.kids || 0}</p>
                        <p className="text-xs text-neutral-500">Kids</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Summary */}
                {bookedHall.bookings && (
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
                      {bookedHall.bookings.payment_status && (
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                          <span className="text-xs text-neutral-500">Payment Status</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                            bookedHall.bookings.payment_status === 'success' || bookedHall.bookings.payment_status === 'paid'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : bookedHall.bookings.payment_status === 'pending'
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {bookedHall.bookings.payment_status.charAt(0).toUpperCase() + bookedHall.bookings.payment_status.slice(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-neutral-200 p-4 sm:p-6 bg-white">
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 sm:py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium rounded-xl transition-colors"
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
