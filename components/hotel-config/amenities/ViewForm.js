'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, FileText, Image as ImageIcon, CheckCircle, XCircle } from 'lucide-react';

const ViewForm = ({ isOpen, onClose, amenity }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && amenity && (
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
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Amenity Details</h2>
                  <p className="text-[10px] sm:text-xs text-neutral-400 hidden sm:block">View amenity information</p>
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
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Basic Information
                  </h3>
                  <div>
                    <label className="text-[10px] sm:text-xs font-medium text-neutral-600 uppercase tracking-wide">Amenity Name</label>
                    <p className="text-sm sm:text-base font-semibold text-neutral-900 mt-0.5 sm:mt-1">
                      {amenity.name || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Image Section */}
                {amenity.image && (
                  <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                    <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                      <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Image
                    </h3>
                    <div className="flex justify-center">
                      <img
                        src={amenity.image}
                        alt={amenity.name}
                        className="w-full max-w-md h-48 sm:h-64 object-cover rounded-lg border-2 border-neutral-200"
                      />
                    </div>
                  </div>
                )}

                {/* Description Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Description
                  </h3>
                  <div>
                    <label className="text-[10px] sm:text-xs font-medium text-neutral-600 uppercase tracking-wide">Amenity Description</label>
                    <p className="text-xs sm:text-sm text-neutral-700 mt-0.5 sm:mt-1 leading-relaxed">
                      {amenity.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                {/* Status Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4">Status</h3>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {amenity.is_active ? (
                      <>
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                        <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                          Active
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                        <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                          Inactive
                        </span>
                      </>
                    )}
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

export default ViewForm;
