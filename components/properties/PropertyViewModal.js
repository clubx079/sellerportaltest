"use client";

import { X, MapPin, DollarSign, Home, Maximize, Star } from 'lucide-react';

export default function PropertyViewModal({ property, onClose }) {
  if (!property) return null;

  const getFeaturedImage = () => {
    const sortedImages = property.property_images?.sort((a, b) => a.sort_order - b.sort_order);
    return sortedImages?.[0]?.image_url || null;
  };

  const allImages = property.property_images?.sort((a, b) => a.sort_order - b.sort_order) || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              {property.slug?.replace(/-/g, ' ').replace(/\d+$/, '').trim() || 'Property Details'}
            </h2>
            <p className="text-sm text-neutral-500">ID: {property.id.split('-')[0]}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Featured Image */}
          {getFeaturedImage() && (
            <div className="relative rounded-xl overflow-hidden h-80">
              <img
                src={getFeaturedImage()}
                alt="Featured"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-yellow-500 text-white text-sm font-medium rounded-lg flex items-center gap-1.5">
                <Star size={14} fill="currentColor" />
                Featured Image
              </div>
            </div>
          )}

          {/* Basic Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-neutral-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-neutral-500" />
                <p className="text-xs font-medium text-neutral-500 uppercase">Price</p>
              </div>
              <p className="text-lg font-bold text-neutral-900">
                ${parseFloat(property.price || 0).toLocaleString()}
              </p>
            </div>

            <div className="bg-neutral-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-neutral-500" />
                <p className="text-xs font-medium text-neutral-500 uppercase">Bedrooms</p>
              </div>
              <p className="text-lg font-bold text-neutral-900">{property.bedrooms || 0}</p>
            </div>

            <div className="bg-neutral-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-neutral-500" />
                <p className="text-xs font-medium text-neutral-500 uppercase">Bathrooms</p>
              </div>
              <p className="text-lg font-bold text-neutral-900">{property.bathrooms || 0}</p>
            </div>

            <div className="bg-neutral-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Maximize className="w-4 h-4 text-neutral-500" />
                <p className="text-xs font-medium text-neutral-500 uppercase">Area</p>
              </div>
              <p className="text-lg font-bold text-neutral-900">
                {property.floor_area ? `${property.floor_area.toLocaleString()} sqft` : 'N/A'}
              </p>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">Address</label>
            <div className="flex items-start gap-2 p-4 bg-neutral-50 rounded-xl">
              <MapPin className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-neutral-700">{property.address || 'N/A'}</p>
            </div>
          </div>

          {/* Status Tags */}
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-2">Status</label>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${
                property.status === 'draft'
                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                  : property.status === 'published'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-neutral-100 text-neutral-700 border-neutral-200'
              }`}>
                {property.status?.charAt(0).toUpperCase() + property.status?.slice(1)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-2">Property Status</label>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${
                property.property_status === 'available'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : property.property_status === 'sold'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : property.property_status === 'under_contract'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-neutral-100 text-neutral-700 border-neutral-200'
              }`}>
                {property.property_status?.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </span>
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">Description</label>
              <div
                className="prose prose-sm max-w-none p-4 bg-neutral-50 rounded-xl"
                dangerouslySetInnerHTML={{ __html: property.description }}
              />
            </div>
          )}

          {/* Repairs */}
          {property.repairs && (
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">Repairs & Renovation</label>
              <div
                className="prose prose-sm max-w-none p-4 bg-neutral-50 rounded-xl"
                dangerouslySetInnerHTML={{ __html: property.repairs }}
              />
            </div>
          )}

          {/* All Images */}
          {allImages.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-3">
                All Images ({allImages.length})
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {allImages.map((img, idx) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.image_url}
                      alt={`Property image ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-lg border-2 border-neutral-200"
                    />
                    {idx === 0 && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-yellow-500 text-white text-xs font-medium rounded">
                        Featured
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
