'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BedDouble, DollarSign, Users, Sparkles, Check, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ViewForm = ({ isOpen, onClose, roomType, amenities, currency = '$' }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  const getAmenityNames = () => {
    if (!roomType?.amenities || roomType.amenities.length === 0) return [];
    return amenities?.filter(a => roomType.amenities.includes(a.id)) || [];
  };

  const selectedAmenities = getAmenityNames();

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && roomType && (
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
            className="fixed right-0 top-0 h-screen w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <BedDouble className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Room Type Details</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">View accommodation information</p>
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
                {/* Image */}
                {roomType.image ? (
                  <div className="rounded-xl overflow-hidden border border-neutral-200">
                    <img
                      src={roomType.image}
                      alt={roomType.title}
                      className="w-full h-64 object-cover"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 h-64 flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="w-16 h-16 text-white/70 mx-auto mb-2" />
                      <p className="text-sm text-neutral-500 font-medium">No image available</p>
                    </div>
                  </div>
                )}

                {/* Basic Info Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <BedDouble className="w-4 h-4" />
                    Basic Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Title</label>
                      <p className="text-base font-semibold text-neutral-900 mt-1">{roomType.title}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Slug</label>
                        <p className="text-sm text-neutral-700 mt-1">{roomType.slug || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Short Code</label>
                        <p className="text-sm mt-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-neutral-100 text-neutral-700 text-xs font-medium">
                            {roomType.short_code || 'N/A'}
                          </span>
                        </p>
                      </div>
                    </div>
                    {roomType.description && (
                      <div>
                        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Description</label>
                        <p className="text-sm text-neutral-700 mt-1 leading-relaxed">{roomType.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Occupancy Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Occupancy Details
                  </h3>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div>
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Base</label>
                      <p className="text-xl sm:text-2xl font-semibold text-neutral-900 mt-1">{roomType.base_occupancy || 0}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Max</label>
                      <p className="text-xl sm:text-2xl font-semibold text-neutral-900 mt-1">{roomType.higher_occupancy || 0}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Kids</label>
                      <p className="text-xl sm:text-2xl font-semibold text-neutral-900 mt-1">{roomType.kids_occupancy || 0}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-neutral-200">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${roomType.extra_bed ? 'bg-[#472F97]' : 'bg-neutral-300'}`}>
                        {roomType.extra_bed && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-sm text-neutral-700">Extra Bed Available</span>
                    </div>
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Pricing
                  </h3>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div>
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Base Price</label>
                      <p className="text-lg sm:text-2xl font-semibold text-neutral-900 mt-1">
                        {currency}{roomType.base_price ? roomType.base_price.toFixed(2) : '0.00'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">+Person</label>
                      <p className="text-lg sm:text-2xl font-semibold text-neutral-900 mt-1">
                        {currency}{roomType.additional_person_price ? roomType.additional_person_price.toFixed(2) : '0.00'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">+Bed</label>
                      <p className="text-lg sm:text-2xl font-semibold text-neutral-900 mt-1">
                        {currency}{roomType.extra_bed_price ? roomType.extra_bed_price.toFixed(2) : '0.00'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Amenities */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Amenities ({selectedAmenities.length})
                  </h3>
                  {selectedAmenities.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedAmenities.map(amenity => (
                        <div key={amenity.id} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-neutral-200">
                          <div className="w-5 h-5 rounded bg-[#472F97] flex items-center justify-center flex-shrink-0">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-sm text-neutral-700">{amenity.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500 text-center py-4">No amenities selected</p>
                  )}
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
