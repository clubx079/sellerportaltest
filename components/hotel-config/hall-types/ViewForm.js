'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Building2, DollarSign, Users, Sparkles, Image as ImageIcon } from 'lucide-react';

const ViewForm = ({ isOpen, onClose, hallType, amenities }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const getAmenityNames = () => {
    if (!hallType?.amenities || hallType.amenities.length === 0) return [];
    return amenities?.filter(a => hallType.amenities.includes(a.id)) || [];
  };

  const selectedAmenities = getAmenityNames();

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && hallType && (
        <>
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

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
                  <h2 className="text-lg font-semibold text-white">Hall Type Details</h2>
                  <p className="text-xs text-white/70">View hall information</p>
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
                {/* Image */}
                {hallType.image && (
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Hall Image
                    </h3>
                    <img
                      src={hallType.image}
                      alt={hallType.title}
                      className="w-full h-64 object-cover rounded-lg border border-neutral-200"
                    />
                  </div>
                )}

                {/* Basic Info Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Basic Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Title</label>
                      <p className="text-sm font-semibold text-neutral-900">{hallType.title}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Slug</label>
                        <p className="text-sm text-neutral-700">{hallType.slug || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Short Code</label>
                        <p className="text-sm text-neutral-700">{hallType.short_code || 'N/A'}</p>
                      </div>
                    </div>
                    {hallType.description && (
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Description</label>
                        <p className="text-sm text-neutral-700 leading-relaxed">{hallType.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Occupancy Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Occupancy Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Best Occupancy</label>
                      <p className="text-2xl font-bold text-neutral-900">{hallType.best_occupancy || 0}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Max Occupancy</label>
                      <p className="text-2xl font-bold text-neutral-900">{hallType.higher_occupancy || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Pricing
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Best Price</label>
                    <p className="text-2xl font-bold text-neutral-900">
                      ${hallType.best_price ? hallType.best_price.toFixed(2) : '0.00'}
                    </p>
                  </div>
                </div>

                {/* Amenities */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Amenities ({selectedAmenities.length})
                  </h3>
                  {selectedAmenities.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedAmenities.map(amenity => (
                        <div key={amenity.id} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-neutral-200">
                          <div className="w-5 h-5 rounded bg-[#472F97] flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs">✓</span>
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
