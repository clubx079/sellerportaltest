'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Hash, ClipboardCheck, User, Building, Tag } from 'lucide-react';

const ViewDetailsModal = ({ isOpen, onClose, item, type }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'clean':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'dirty':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'inspected':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'out of service':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (!mounted || !item) return null;

  return createPortal(
    <>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Side Panel */}
          <div className="fixed right-0 top-0 h-screen w-full sm:w-[90%] md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col">
            {/* Header */}
            <div className="bg-[#472F97] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">{type === 'room' ? 'Room' : 'Hall'} Details</h2>
                  <p className="text-[10px] sm:text-xs text-neutral-400 hidden sm:block">View housekeeping information</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Basic Information Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <Hash className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Basic Information
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">
                        {type === 'room' ? 'Room' : 'Hall'} Number
                      </label>
                      <p className="text-xl sm:text-2xl font-semibold text-neutral-900">{item.number}</p>
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">Type</label>
                      <span className={`inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm font-semibold ${
                        type === 'room' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {type === 'room' ? 'Room' : 'Hall'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Category Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Category
                  </h3>
                  <div>
                    <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">
                      {type === 'room' ? 'Room Type' : 'Hall Type'}
                    </label>
                    <p className="text-sm sm:text-base font-semibold text-neutral-900">
                      {item.typeName || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Floor Information Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <Building className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Floor Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">Floor Name</label>
                      <p className="text-xs sm:text-sm text-neutral-700">{item.floors?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">Floor Number</label>
                      <p className="text-xs sm:text-sm text-neutral-700">
                        {item.floors?.floor_number ? `Floor ${item.floors.floor_number}` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Housekeeping Status Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <ClipboardCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Housekeeping Status
                  </h3>
                  <div>
                    <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">Current Status</label>
                    <div className="mt-1.5 sm:mt-2">
                      <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold border ${getStatusColor(item.housekeeping_status)}`}>
                        {item.housekeeping_status?.charAt(0).toUpperCase() + item.housekeeping_status?.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Assignment Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Assignment
                  </h3>
                  <div>
                    <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">Assigned To</label>
                    <p className="text-xs sm:text-sm text-neutral-700">
                      {item.assigned_employee?.full_name || (
                        <span className="text-neutral-400 italic">Not assigned</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Close Button - Sticky */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-3 sm:py-4">
                <button
                  onClick={onClose}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-[#472F97] hover:bg-[#3a2578] text-white font-medium rounded-xl transition-colors"
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

export default ViewDetailsModal;
