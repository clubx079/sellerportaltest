'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, Calendar, Percent, BedDouble, Briefcase } from 'lucide-react';
import { getCurrentCurrencySymbol } from '@/lib/currency';

const ViewForm = ({ isOpen, onClose, coupon }) => {
  const [mounted, setMounted] = useState(false);
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    setMounted(true);
    setCurrency(getCurrentCurrencySymbol());
    return () => setMounted(false);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    // Clean the date string - remove quotes and trim
    const cleanedDate = dateString.replace(/"/g, '').trim();
    const date = new Date(cleanedDate);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const parseCouponPeriod = (dateRange) => {
    if (!dateRange) return { start: 'N/A', end: 'N/A' };

    // PostgreSQL DATERANGE format: ["2024-01-01","2024-12-31") or [2024-01-01,2024-12-31)
    // Match various formats with or without quotes
    const matches = dateRange.match(/[\[\(]["']?([^"',\[\]()]+)["']?\s*,\s*["']?([^"',\[\]()]+)["']?[\]\)]/);

    if (matches) {
      return {
        start: formatDate(matches[1]),
        end: formatDate(matches[2])
      };
    }
    return { start: 'N/A', end: 'N/A' };
  };

  const period = coupon ? parseCouponPeriod(coupon.coupon_period) : { start: 'N/A', end: 'N/A' };

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && coupon && (
        <>
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Side Panel */}
          <div
            className="fixed right-0 top-0 h-screen w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Tag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Coupon Details</h2>
                  <p className="text-xs text-neutral-400">View coupon information</p>
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
                {/* Basic Info Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Coupon Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Offer Title</label>
                      <p className="text-lg font-semibold text-neutral-900">
                        {coupon.offer_title || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Coupon Code & Type Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    Coupon Configuration
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Coupon Code</label>
                      <p className="text-lg font-semibold text-neutral-900 uppercase">
                        {coupon.coupon_code || 'N/A'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Type</label>
                        <p className="text-sm font-medium text-neutral-700 capitalize">
                          {coupon.coupon_type || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Discount Value</label>
                        <div className="flex items-center gap-1">
                          {coupon.coupon_type === 'percentage' ? (
                            <>
                              <Percent className="w-4 h-4 text-green-600" />
                              <p className="text-xl font-bold text-green-700">{coupon.coupon_value || '0'}</p>
                            </>
                          ) : (
                            <>
                              <span className="text-sm text-green-600">{currency}</span>
                              <p className="text-xl font-bold text-green-700">
                                {coupon.coupon_value ? parseFloat(coupon.coupon_value).toFixed(2) : '0.00'}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Date Range Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Validity Period
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Start Date</label>
                      <p className="text-sm font-medium text-neutral-700">
                        {period.start}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">End Date</label>
                      <p className="text-sm font-medium text-neutral-700">
                        {period.end}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Room Type Restrictions Section */}
                {(coupon.include_room_type?.length > 0 || coupon.exclude_room_type?.length > 0) && (
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                      <BedDouble className="w-4 h-4" />
                      Room Type Restrictions
                    </h3>
                    <div className="space-y-4">
                      {coupon.include_room_type?.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Included Room Types</label>
                          <div className="flex flex-wrap gap-2">
                            {coupon.include_room_type.map((id, index) => (
                              <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-700 text-sm font-medium">
                                Room Type ID: {id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {coupon.exclude_room_type?.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Excluded Room Types</label>
                          <div className="flex flex-wrap gap-2">
                            {coupon.exclude_room_type.map((id, index) => (
                              <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-700 text-sm font-medium">
                                Room Type ID: {id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Paid Services Section */}
                {coupon.paid_services?.length > 0 && (
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Applicable Services
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {coupon.paid_services.map((id, index) => (
                        <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-700 text-sm font-medium">
                          Service ID: {id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
