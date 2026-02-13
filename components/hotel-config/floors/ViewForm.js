'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Building2, Hash, FileText, CheckCircle, XCircle } from 'lucide-react';

const ViewForm = ({ isOpen, onClose, floor }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && floor && (
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
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Floor Details</h2>
                  <p className="text-xs text-neutral-400">View floor information</p>
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
                {/* Basic Information Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Basic Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Floor Name</label>
                      <p className="text-lg font-semibold text-neutral-900">
                        {floor.name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Floor Number</label>
                      <p className="text-2xl font-bold text-neutral-900">
                        {floor.floor_number || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Description
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Floor Description</label>
                    <p className="text-sm text-neutral-700 leading-relaxed">
                      {floor.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                {/* Status Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4">Status</h3>
                  <div className="flex items-center gap-2">
                    {floor.is_active ? (
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
