'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, DollarSign, CreditCard, Printer, LogOut, User, BedDouble } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CheckoutModal = ({ isOpen, onClose, bookedRoom, onSuccess, userId, currency = '$' }) => {
  const [mounted, setMounted] = useState(false);
  const [extraCharges, setExtraCharges] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !bookedRoom) return null;

  const totalAmount = parseFloat(bookedRoom.bookings?.total_amount || 0);
  const paidAmount = parseFloat(bookedRoom.bookings?.paid_amount || 0);
  const pendingAmount = totalAmount - paidAmount;
  const extraChargesAmount = parseFloat(extraCharges) || 0;
  const grandTotal = pendingAmount + extraChargesAmount;

  const handleCheckout = async () => {
    try {
      setProcessing(true);

      // Update booked room status to checked_out
      const { error: updateError } = await supabase
        .from('booked_rooms')
        .update({ status: 'checked_out' })
        .eq('id', bookedRoom.id)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Update booking total amount if extra charges exist
      if (extraChargesAmount > 0) {
        const newTotalAmount = totalAmount + extraChargesAmount;
        const { error: bookingError } = await supabase
          .from('bookings')
          .update({ total_amount: newTotalAmount })
          .eq('id', bookedRoom.booking_id)
          .eq('user_id', userId);

        if (bookingError) throw bookingError;
      }

      // Record payment if there's an amount to pay
      if (grandTotal > 0) {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert([{
            user_id: userId,
            booking_id: bookedRoom.booking_id,
            customer_id: bookedRoom.bookings?.guest_id || null,
            payment_method: paymentMethod,
            amount: grandTotal,
            is_security_deposit: false,
            payment_status: 'success'
          }]);

        if (paymentError) throw paymentError;

        // Update paid amount in booking
        const { error: updatePaidError } = await supabase
          .from('bookings')
          .update({
            paid_amount: paidAmount + grandTotal,
            payment_status: (paidAmount + grandTotal >= (totalAmount + extraChargesAmount)) ? 'success' : 'pending'
          })
          .eq('id', bookedRoom.booking_id)
          .eq('user_id', userId);

        if (updatePaidError) throw updatePaidError;
      }

      // Update booking status to completed
      const { error: bookingStatusError } = await supabase
        .from('bookings')
        .update({ booking_status: 'completed' })
        .eq('id', bookedRoom.booking_id)
        .eq('user_id', userId);

      if (bookingStatusError) throw bookingStatusError;

      // Archive the booking
      const { error: archiveError } = await supabase
        .from('archived_bookings')
        .insert([{
          user_id: userId,
          booking_id: bookedRoom.booking_id,
          completed_at: new Date().toISOString()
        }]);

      if (archiveError) throw archiveError;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error processing checkout:', error);
      alert('Failed to process checkout: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintInvoice = () => {
    // Create invoice content
    const invoiceContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - Booking #${bookedRoom.booking_id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .details { margin: 20px 0; }
          .details table { width: 100%; border-collapse: collapse; }
          .details td { padding: 8px; border-bottom: 1px solid #ddd; }
          .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Hotel Invoice</h1>
          <p>Booking ID: #${bookedRoom.booking_id}</p>
        </div>
        <div class="details">
          <h3>Guest Information</h3>
          <table>
            <tr><td>Name:</td><td>${bookedRoom.bookings?.guests?.full_name || 'Walk-in Guest'}</td></tr>
            <tr><td>Phone:</td><td>${bookedRoom.bookings?.guests?.phone || 'N/A'}</td></tr>
          </table>

          <h3>Room Information</h3>
          <table>
            <tr><td>Room Number:</td><td>${bookedRoom.rooms?.room_number || 'N/A'}</td></tr>
            <tr><td>Room Type:</td><td>${bookedRoom.rooms?.room_types?.title || 'N/A'}</td></tr>
            <tr><td>Check In:</td><td>${new Date(bookedRoom.check_in).toLocaleString()}</td></tr>
            <tr><td>Check Out:</td><td>${new Date(bookedRoom.check_out).toLocaleString()}</td></tr>
          </table>

          <h3>Payment Summary</h3>
          <table>
            <tr><td>Room Charges:</td><td>${currency}${totalAmount.toFixed(2)}</td></tr>
            <tr><td>Extra Charges:</td><td>${currency}${extraChargesAmount.toFixed(2)}</td></tr>
            <tr><td>Previously Paid:</td><td>${currency}${paidAmount.toFixed(2)}</td></tr>
          </table>

          <div class="total">
            <p>Total Amount Due: ${currency}${grandTotal.toFixed(2)}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(invoiceContent);
    printWindow.document.close();
    printWindow.print();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="bg-[#472F97] px-4 sm:px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-white">Checkout</h2>
                    <p className="text-[10px] sm:text-xs text-white/70">Room: {bookedRoom.rooms?.room_number}</p>
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
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Guest Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Guest Information
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Name</span>
                      <span className="text-sm font-medium text-neutral-900">{bookedRoom.bookings?.guests?.full_name || 'Walk-in Guest'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Room</span>
                      <span className="text-sm font-medium text-neutral-900">{bookedRoom.rooms?.room_number}</span>
                    </div>
                  </div>
                </div>

                {/* Billing Summary */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Billing Summary
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Total Booking Amount</span>
                      <span className="text-sm font-medium text-neutral-900">{currency}{totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Already Paid</span>
                      <span className="text-sm font-medium text-green-600">{currency}{paidAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                      <span className="text-xs font-medium text-neutral-700">Pending Amount</span>
                      <span className="text-sm font-semibold text-red-600">{currency}{pendingAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Extra Charges */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2">Extra Charges (Optional)</h3>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraCharges}
                    onChange={(e) => setExtraCharges(e.target.value)}
                    placeholder="Enter any extra charges"
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                  />
                  <p className="text-xs text-neutral-500 mt-2">Add charges for unpaid services, damages, or other extras</p>
                </div>

                {/* Payment Method */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Method
                  </h3>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Credit/Debit Card</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2">Notes (Optional)</h3>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes or remarks"
                    rows="3"
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400 resize-none bg-white"
                  />
                </div>

                {/* Final Amount */}
                <div className="bg-[#472F97] rounded-xl p-4 border border-neutral-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm sm:text-base font-semibold text-white">Total Amount to Collect</span>
                    <span className="text-xl sm:text-2xl font-bold text-white">{currency}{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-4 sm:px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handlePrintInvoice}
                  className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-neutral-100 text-neutral-700 text-sm font-medium rounded-xl transition-colors border border-neutral-200 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Invoice
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-neutral-100 text-neutral-700 text-sm font-medium rounded-xl transition-colors border border-neutral-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={processing}
                  className="w-full sm:flex-1 px-4 py-2.5 bg-[#472F97] hover:bg-[#3a2578] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  {processing ? 'Processing...' : 'Complete Checkout'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CheckoutModal;
