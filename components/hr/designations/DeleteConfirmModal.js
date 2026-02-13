'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
// Removed framer-motion for better performance

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, itemName }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
            <div
              className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Header */}
              <div className="relative bg-[#472F97] p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold text-white">Confirm Deletion</h3>
                    <p className="text-xs sm:text-sm text-white/70 mt-0.5">This action cannot be undone</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6">
                <p className="text-neutral-700 text-sm sm:text-base leading-relaxed">
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-neutral-900">"{itemName}"</span>?
                </p>
                <p className="text-xs sm:text-sm text-neutral-500 mt-2 sm:mt-3">
                  This will permanently remove this designation from your system. All associated data will be lost.
                </p>
              </div>

              {/* Actions */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex items-center gap-2 sm:gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg sm:rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base bg-[#472F97] hover:bg-[#3a2578] text-white font-medium rounded-lg sm:rounded-xl transition-colors"
                >
                  Delete
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

export default DeleteConfirmModal;
