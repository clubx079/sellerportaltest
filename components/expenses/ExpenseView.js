'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Receipt, DollarSign, Calendar, FileText, Tags } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentCurrencySymbol } from '@/lib/currency';

const ExpenseView = ({ isOpen, onClose, expense }) => {
  const [mounted, setMounted] = useState(false);
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    setMounted(true);
    setCurrency(getCurrentCurrencySymbol());
    return () => setMounted(false);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `${currency}${Number(amount || 0).toFixed(2)}`;
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && expense && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Side Panel */}
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
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Expense Details</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">View expense information</p>
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
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Basic Information Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Basic Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Expense ID</label>
                      <p className="text-sm font-semibold text-neutral-900">#{expense.id}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Category</label>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                        <Tags className="w-3.5 h-3.5" />
                        {expense.expense_categories?.name || 'Uncategorized'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial Information Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Financial Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Amount</label>
                      <p className="text-2xl font-bold text-neutral-900">{formatCurrency(expense.amount)}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Expense Date</label>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-neutral-500" />
                        <p className="text-sm text-neutral-700">{formatDate(expense.expense_date)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Description
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-neutral-700 leading-relaxed">
                        {expense.description || <span className="italic text-neutral-400">No description provided</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button - Sticky */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 p-4 sm:p-6">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2.5 sm:py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium rounded-xl transition-colors"
                >
                  Close
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

export default ExpenseView;
