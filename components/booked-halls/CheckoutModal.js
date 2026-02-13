'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Save, DollarSign, CreditCard, Printer, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentCurrencySymbol } from '@/lib/currency';

const CheckoutModal = ({ isOpen, onClose, bookedHall, onSuccess }) => {
  const [extraCharges, setExtraCharges] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    setCurrency(getCurrentCurrencySymbol());
  }, []);

  if (!bookedHall) return null;

  const totalAmount = parseFloat(bookedHall.bookings?.total_amount || 0);
  const paidAmount = parseFloat(bookedHall.bookings?.paid_amount || 0);
  const pendingAmount = totalAmount - paidAmount;
  const extraChargesAmount = parseFloat(extraCharges) || 0;
  const grandTotal = pendingAmount + extraChargesAmount;

  const handleCheckout = async () => {
    try {
      setProcessing(true);

      // Get user_id from bookedHall
      const userId = bookedHall.user_id;

      // Update booked hall status to checked_out
      const { error: updateError } = await supabase
        .from('booked_halls')
        .update({ status: 'checked_out' })
        .eq('id', bookedHall.id);

      if (updateError) throw updateError;

      // Update booking total amount if extra charges exist
      if (extraChargesAmount > 0) {
        const newTotalAmount = totalAmount + extraChargesAmount;
        const { error: bookingError } = await supabase
          .from('bookings')
          .update({ total_amount: newTotalAmount })
          .eq('id', bookedHall.booking_id);

        if (bookingError) throw bookingError;
      }

      // Record payment if there's an amount to pay
      if (grandTotal > 0) {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert([{
            booking_id: bookedHall.booking_id,
            user_id: userId,
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
          .eq('id', bookedHall.booking_id);

        if (updatePaidError) throw updatePaidError;
      }

      // Update booking status to completed
      const { error: bookingStatusError } = await supabase
        .from('bookings')
        .update({ booking_status: 'completed' })
        .eq('id', bookedHall.booking_id);

      if (bookingStatusError) throw bookingStatusError;

      // Archive the booking
      const { error: archiveError } = await supabase
        .from('archived_bookings')
        .insert([{
          user_id: userId,
          booking_id: bookedHall.booking_id,
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
        <title>Invoice - Booking #${bookedHall.booking_id}</title>
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
          <p>Booking ID: #${bookedHall.booking_id}</p>
        </div>
        <div class="details">
          <h3>Guest Information</h3>
          <table>
            <tr><td>Name:</td><td>${bookedHall.bookings?.users?.full_name || 'Walk-in Guest'}</td></tr>
            <tr><td>Email:</td><td>${bookedHall.bookings?.users?.email || 'N/A'}</td></tr>
            <tr><td>Phone:</td><td>${bookedHall.bookings?.users?.phone || 'N/A'}</td></tr>
          </table>

          <h3>Hall Information</h3>
          <table>
            <tr><td>Hall Number:</td><td>${bookedHall.halls?.hall_number || 'N/A'}</td></tr>
            <tr><td>Hall Type:</td><td>${bookedHall.halls?.hall_types?.title || 'N/A'}</td></tr>
            <tr><td>Booking Basis:</td><td>${bookedHall.booking_basis?.charAt(0).toUpperCase() + bookedHall.booking_basis?.slice(1) || 'Daily'}</td></tr>
            <tr><td>Check In:</td><td>${new Date(bookedHall.check_in).toLocaleString()}</td></tr>
            <tr><td>Check Out:</td><td>${new Date(bookedHall.check_out).toLocaleString()}</td></tr>
          </table>

          <h3>Payment Summary</h3>
          <table>
            <tr><td>Hall Charges:</td><td>${currency}${totalAmount.toFixed(2)}</td></tr>
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

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 px-6 py-4 flex items-center justify-between shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center ring-4 ring-white/30">
                    <LogOut className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Checkout</h2>
                    <p className="text-xs text-indigo-100">Hall: {bookedHall.halls?.hall_number}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="relative z-10 p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Guest Information */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                  <h3 className="text-sm font-bold text-indigo-900 mb-3">Guest Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Name:</span>
                      <span className="text-sm font-semibold text-slate-800">{bookedHall.bookings?.users?.full_name || 'Walk-in Guest'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Hall:</span>
                      <span className="text-sm font-semibold text-slate-800">{bookedHall.halls?.hall_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Booking Basis:</span>
                      <span className="text-sm font-semibold text-slate-800">{bookedHall.booking_basis?.charAt(0).toUpperCase() + bookedHall.booking_basis?.slice(1) || 'Daily'}</span>
                    </div>
                  </div>
                </div>

                {/* Billing Summary */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                  <h3 className="text-sm font-bold text-green-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Billing Summary
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Total Booking Amount:</span>
                      <span className="text-sm font-semibold text-slate-800">${totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Already Paid:</span>
                      <span className="text-sm font-semibold text-slate-800">${paidAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Pending Amount:</span>
                      <span className="text-sm font-semibold text-red-600">${pendingAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Extra Charges */}
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
                  <h3 className="text-sm font-bold text-amber-900 mb-3">Extra Charges (Optional)</h3>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraCharges}
                    onChange={(e) => setExtraCharges(e.target.value)}
                    placeholder="Enter any extra charges"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-600 mt-2">Add charges for unpaid services, damages, or other extras</p>
                </div>

                {/* Payment Method */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                  <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Method
                  </h3>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Credit/Debit Card</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-4 border border-pink-200">
                  <h3 className="text-sm font-bold text-pink-900 mb-3">Notes (Optional)</h3>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes or remarks"
                    rows="3"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent resize-none"
                  />
                </div>

                {/* Final Amount */}
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 border-2 border-purple-300">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-purple-900">Total Amount to Collect:</span>
                    <span className="text-2xl font-bold text-purple-900">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintInvoice}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Invoice
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={processing}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  {processing ? 'Processing...' : 'Complete Checkout'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CheckoutModal;
