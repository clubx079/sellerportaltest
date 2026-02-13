'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, Star, Calendar, Check, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ViewForm = ({ isOpen, onClose, guest }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && guest && (
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
            <div className="bg-[#472F97] px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Guest Details</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">View guest information</p>
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
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Guest Avatar */}
                <div className="flex justify-center">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-neutral-100 flex items-center justify-center border-4 border-white shadow-lg">
                    <span className="text-2xl sm:text-3xl font-semibold text-neutral-600">
                      {guest.full_name?.charAt(0)?.toUpperCase() || 'G'}
                    </span>
                  </div>
                </div>

                {/* Basic Info Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Guest Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Full Name</label>
                      <p className="text-base font-semibold text-neutral-900 mt-1">{guest.full_name || 'N/A'}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Phone Number</label>
                        <div className="flex items-center gap-2 mt-1">
                          <Phone className="w-4 h-4 text-neutral-400" />
                          <p className="text-sm text-neutral-700">{guest.phone || 'Not provided'}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">CNIC Number</label>
                        <div className="flex items-center gap-2 mt-1">
                          <CreditCard className="w-4 h-4 text-neutral-400" />
                          <p className="text-sm text-neutral-700">{guest.cnic || 'Not provided'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* VIP Status Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    VIP Status
                  </h3>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-neutral-200">
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${guest.is_vip ? 'bg-amber-500' : 'bg-neutral-300'}`}>
                      {guest.is_vip && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <div className="flex-1">
                      {guest.is_vip ? (
                        <>
                          <span className="text-sm font-medium text-amber-700">VIP Guest</span>
                          <p className="text-xs text-neutral-500 mt-0.5">This guest has VIP privileges</p>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-neutral-700">Regular Guest</span>
                          <p className="text-xs text-neutral-500 mt-0.5">Standard guest account</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Timeline
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Created At</label>
                      <p className="text-sm text-neutral-700 mt-1">{formatDate(guest.created_at)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-4">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2.5 bg-[#472F97] hover:bg-[#3a2578] text-white text-sm font-medium rounded-xl transition-colors"
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

export default ViewForm;
