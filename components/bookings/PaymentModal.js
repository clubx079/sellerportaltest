'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, CreditCard, DollarSign, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PaymentModal = ({ isOpen, onClose, booking, onSuccess, userId, currency = '$' }) => {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    payment_method: '',
    amount: '',
    is_security_deposit: false,
    payment_date: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);
  const [showSecurityDepositPrompt, setShowSecurityDepositPrompt] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        payment_method: '',
        amount: '',
        is_security_deposit: false,
        payment_date: new Date().toISOString().split('T')[0]
      });
      setShowSecurityDepositPrompt(false);
    }
  }, [isOpen]);

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 4000);
  };

  if (!mounted || !booking) return null;

  const pendingAmount = parseFloat(booking.total_amount || 0) - parseFloat(booking.paid_amount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.payment_method || !formData.amount) {
      showToast('Please fill in all required fields');
      return;
    }

    if (parseFloat(formData.amount) > pendingAmount && !showSecurityDepositPrompt) {
      setShowSecurityDepositPrompt(true);
      return;
    }

    try {
      setSaving(true);

      const amount = parseFloat(formData.amount);
      const isSecurityDeposit = amount > pendingAmount || formData.is_security_deposit;

      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          booking_id: booking.id,
          user_id: userId || booking.user_id,
          payment_method: formData.payment_method,
          amount: amount,
          is_security_deposit: isSecurityDeposit,
          payment_status: 'success'
        }]);

      if (paymentError) throw paymentError;

      const newPaidAmount = parseFloat(booking.paid_amount || 0) + amount;
      const newPaymentStatus = newPaidAmount >= parseFloat(booking.total_amount) ? 'paid' : 'partial';

      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          paid_amount: newPaidAmount,
          payment_status: newPaymentStatus
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      showToast('Payment added successfully!', 'success');
      onSuccess?.();
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error('Error adding payment:', error);
      showToast('Failed to add payment: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSecurityDepositConfirm = (addDeposit) => {
    if (addDeposit) {
      setFormData(prev => ({ ...prev, is_security_deposit: true }));
    } else {
      setFormData(prev => ({ ...prev, amount: pendingAmount.toString() }));
    }
    setShowSecurityDepositPrompt(false);
  };

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
            className="fixed right-0 top-0 h-screen w-full md:w-[500px] lg:w-[550px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-neutral-900 px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Add Payment</h2>
                  <p className="text-[10px] sm:text-xs text-neutral-400">Booking #{booking.id}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Security Deposit Prompt */}
            <AnimatePresence>
              {showSecurityDepositPrompt && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-yellow-50 border-b border-yellow-200 px-4 sm:px-6 py-3"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-yellow-900">Add Security Deposit?</h3>
                      <p className="text-xs text-yellow-700 mt-1">
                        The amount exceeds the pending payment. Do you want to add the extra as a security deposit?
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => handleSecurityDepositConfirm(true)}
                          className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Yes, add deposit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSecurityDepositConfirm(false)}
                          className="px-3 py-1.5 bg-neutral-600 hover:bg-neutral-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          No, adjust amount
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Payment Summary */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3">Payment Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">Total Amount</span>
                      <span className="font-semibold text-neutral-900">{currency}{parseFloat(booking.total_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">Paid Amount</span>
                      <span className="font-semibold text-green-600">{currency}{parseFloat(booking.paid_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-neutral-200">
                      <span className="text-neutral-700 font-medium">Pending Amount</span>
                      <span className="font-bold text-red-600">{currency}{pendingAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Date */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Payment Date <span className="text-red-500">*</span>
                  </h3>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                    required
                  />
                </div>

                {/* Payment Method */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Method <span className="text-red-500">*</span>
                  </h3>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                    required
                  >
                    <option value="">-- Select Method --</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="paypal">PayPal</option>
                    <option value="stripe">Stripe</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                {/* Amount */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Amount <span className="text-red-500">*</span>
                  </h3>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Enter amount"
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-neutral-500 mt-2">
                    Pending: {currency}{pendingAmount.toFixed(2)}
                  </p>
                </div>

                {/* Security Deposit */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_security_deposit}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_security_deposit: e.target.checked }))}
                      className="w-4 h-4 text-neutral-900 rounded focus:ring-neutral-900 border-neutral-300"
                    />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">Mark as Security Deposit</p>
                      <p className="text-xs text-neutral-500">Check this if the payment includes a security deposit</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-3 sm:px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-3 sm:px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save Payment'}</span>
                  <span className="sm:hidden">{saving ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </form>

            {/* Toast */}
            <AnimatePresence>
              {toast.show && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
                    toast.type === 'error'
                      ? 'bg-red-50 border border-red-200 text-red-700'
                      : 'bg-green-50 border border-green-200 text-green-700'
                  }`}
                >
                  {toast.type === 'error' ? (
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium">{toast.message}</span>
                  <button
                    type="button"
                    onClick={() => setToast({ show: false, message: '', type: 'error' })}
                    className="ml-2 p-1 hover:bg-black/5 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default PaymentModal;
