'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Briefcase, DollarSign, BedDouble, FileText, CheckCircle, XCircle } from 'lucide-react';

const ViewForm = ({ isOpen, onClose, service }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const getPriceTypeLabel = (priceType) => {
    const types = {
      'per_day': 'Per Day',
      'flat': 'Flat',
      'per_hour': 'Per Hour'
    };
    return types[priceType] || 'N/A';
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && service && (
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
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Service Details</h2>
                  <p className="text-xs text-neutral-400">View service information</p>
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
                    <Briefcase className="w-4 h-4" />
                    Basic Information
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Title</label>
                    <p className="text-lg font-semibold text-neutral-900">{service.title}</p>
                  </div>
                </div>

                {/* Room Type Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <BedDouble className="w-4 h-4" />
                    Room Type Association
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Room Type</label>
                    <p className="text-sm font-medium text-neutral-700">
                      {service.room_types?.title || 'No room type assigned'}
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
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Price Type</label>
                      <p className="text-sm font-medium text-neutral-700">
                        {getPriceTypeLabel(service.price_type)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Price</label>
                      <p className="text-2xl font-bold text-neutral-900">
                        ${service.price ? parseFloat(service.price).toFixed(2) : '0.00'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4">Status</h3>
                  <div className="flex items-center gap-2">
                    {service.status ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                          Active
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                          Inactive
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Description Section */}
                {(service.description || service.short_description) && (
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Descriptions
                    </h3>
                    <div className="space-y-4">
                      {service.description && (
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Description</label>
                          <p className="text-sm text-neutral-700 leading-relaxed">{service.description}</p>
                        </div>
                      )}
                      {service.short_description && (
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Short Description</label>
                          <p className="text-sm text-neutral-700 leading-relaxed">{service.short_description}</p>
                        </div>
                      )}
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
