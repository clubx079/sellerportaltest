'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Briefcase } from 'lucide-react';
// Removed framer-motion for better performance

const ViewForm = ({ isOpen, onClose, department }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && department && (
        <>
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Side Panel */}
          <div
            className="fixed right-0 top-0 h-screen w-full sm:w-[90%] md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/10 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Department Details</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">View department information</p>
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
                {/* Department Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Department Information
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Department Name</label>
                    <p className="text-base font-semibold text-neutral-900">
                      {department.name || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Close Button - Sticky */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-3 sm:py-4">
                <button
                  onClick={onClose}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base bg-[#472F97] hover:bg-[#3a2578] text-white font-medium rounded-lg sm:rounded-xl transition-colors"
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
