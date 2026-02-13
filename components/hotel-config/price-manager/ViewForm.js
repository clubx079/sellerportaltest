'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, DollarSign, Calendar, BedDouble } from 'lucide-react';
import { getCurrentCurrencySymbol } from '@/lib/currency';

const ViewForm = ({ isOpen, onClose, priceEntry }) => {
  const [mounted, setMounted] = useState(false);
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    setMounted(true);
    setCurrency(getCurrentCurrencySymbol());
    return () => setMounted(false);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && priceEntry && (
        <>
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          <div
            className="fixed right-0 top-0 h-screen w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Price Details</h2>
                  <p className="text-xs text-neutral-400">View pricing information</p>
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
              <div className="p-6 space-y-6">
                {/* Room Type Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <BedDouble className="w-4 h-4" />
                    Room Type
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Room Type</label>
                    <p className="text-lg font-semibold text-neutral-900">
                      {priceEntry.room_types?.title || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Pricing
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Regular Price</label>
                      <p className="text-2xl font-bold text-neutral-900">
                        {currency}{priceEntry.regular_price ? parseFloat(priceEntry.regular_price).toFixed(2) : '0.00'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Special Price</label>
                      <p className="text-2xl font-bold text-neutral-900">
                        {currency}{priceEntry.special_price ? parseFloat(priceEntry.special_price).toFixed(2) : '0.00'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Date Range Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date Range
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Start Date</label>
                      <p className="text-sm text-neutral-700">
                        {formatDate(priceEntry.start_date)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">End Date</label>
                      <p className="text-sm text-neutral-700">
                        {formatDate(priceEntry.end_date)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2.5 bg-[#472F97] hover:bg-[#3a2578] text-white font-medium rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  );
};

export default ViewForm;
