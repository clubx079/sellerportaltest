'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UtensilsCrossed, DollarSign, Tag, FileText, Calendar, ToggleLeft, Image as ImageIcon } from 'lucide-react';
// Removed framer-motion for better performance

const MenuView = ({ isOpen, onClose, menuItem, currency = '$' }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && menuItem && (
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
                  <UtensilsCrossed className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Menu Item Details</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">View menu item information</p>
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
                {/* Item Name */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4" />
                    Item Name
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Name</label>
                    <p className="text-base font-semibold text-neutral-900">{menuItem.name || 'N/A'}</p>
                  </div>
                </div>

                {/* Category and Price */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Category & Price
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Category</label>
                      <p className="text-sm text-neutral-700">{menuItem.category || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Price</label>
                      <p className="text-sm font-semibold text-neutral-900">{currency}{parseFloat(menuItem.price || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {menuItem.description && (
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Description
                    </h3>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Details</label>
                      <p className="text-sm text-neutral-700">{menuItem.description}</p>
                    </div>
                  </div>
                )}

                {/* Image */}
                {menuItem.image && (
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Image
                    </h3>
                    <div className="rounded-lg overflow-hidden border border-neutral-200">
                      <img
                        src={menuItem.image}
                        alt={menuItem.name}
                        className="w-full h-64 object-cover"
                        onError={(e) => {
                          e.target.src = '/placeholder-food.jpg';
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <ToggleLeft className="w-4 h-4" />
                    Status
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Availability</label>
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${
                      menuItem.is_active
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-red-100 text-red-700 border-red-200'
                    }`}>
                      {menuItem.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>

                {/* Created At */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Record Information
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Created At</label>
                    <p className="text-sm text-neutral-700">{formatDate(menuItem.created_at)}</p>
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

export default MenuView;
