"use client";

import { X, MapPin, DollarSign, Home, Maximize, Star, Link2 } from 'lucide-react';

export default function PropertyViewModal({ property, onClose, onOpenUTMLinks }) {
  if (!property) return null;

  const getFeaturedImage = () => {
    const sortedImages = property.property_images?.sort((a, b) => a.sort_order - b.sort_order);
    return sortedImages?.[0]?.image_url || null;
  };

  const allImages = property.property_images?.sort((a, b) => a.sort_order - b.sort_order) || [];

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[14px] border-[1.5px] border-ink shadow-offset-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-[1.5px] border-ink px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold tracking-[-0.01em] text-body">
              {property.slug?.replace(/-/g, ' ').replace(/\d+$/, '').trim() || 'Property Details'}
            </h2>
            <p className="font-mono text-[12px] text-muted">ID: {property.id.split('-')[0]}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-tint rounded-[8px] transition-colors duration-120"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Featured Image */}
          {getFeaturedImage() && (
            <div className="relative rounded-[12px] border-[1.5px] border-ink bg-stripes overflow-hidden h-80">
              <img
                src={getFeaturedImage()}
                alt="Featured"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 px-2.5 py-1 bg-body text-white font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] rounded-pill flex items-center gap-1.5">
                <Star size={14} fill="currentColor" />
                Featured Image
              </div>
            </div>
          )}

          {/* Basic Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-tint-2 border border-hairline rounded-[10px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-muted" />
                <p className="font-mono text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em]">Price</p>
              </div>
              <p className="font-display text-lg font-bold text-body">
                ${parseFloat(property.price || 0).toLocaleString()}
              </p>
            </div>

            <div className="bg-tint-2 border border-hairline rounded-[10px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-muted" />
                <p className="font-mono text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em]">Bedrooms</p>
              </div>
              <p className="font-mono text-lg font-bold text-body">{property.bedrooms || 0}</p>
            </div>

            <div className="bg-tint-2 border border-hairline rounded-[10px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-muted" />
                <p className="font-mono text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em]">Bathrooms</p>
              </div>
              <p className="font-mono text-lg font-bold text-body">{property.bathrooms || 0}</p>
            </div>

            <div className="bg-tint-2 border border-hairline rounded-[10px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Maximize className="w-4 h-4 text-muted" />
                <p className="font-mono text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em]">Area</p>
              </div>
              <p className="font-mono text-lg font-bold text-body">
                {property.floor_area ? `${property.floor_area.toLocaleString()} sqft` : 'N/A'}
              </p>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink mb-2">Address</label>
            <div className="flex items-start gap-2 p-4 bg-tint-2 border border-hairline rounded-[10px]">
              <MapPin className="w-5 h-5 text-mist flex-shrink-0 mt-0.5" />
              <p className="text-sm text-smoke-2">{property.address || 'N/A'}</p>
            </div>
          </div>

          {/* Status Tags */}
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted mb-2">Status</label>
              <span className={`inline-flex items-center px-3 py-1 rounded-pill font-mono text-[11px] font-semibold uppercase tracking-[0.05em] border ${
                property.status === 'draft'
                  ? 'bg-muted text-white border-muted'
                  : property.status === 'published' || property.status === 'active'
                  ? 'bg-ink text-white border-ink'
                  : 'bg-mist text-white border-mist'
              }`}>
                {property.status?.charAt(0).toUpperCase() + property.status?.slice(1)}
              </span>
            </div>

            <div>
              <label className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted mb-2">Property Status</label>
              <span className={`inline-flex items-center px-3 py-1 rounded-pill font-mono text-[11px] font-semibold uppercase tracking-[0.05em] border ${
                property.property_status === 'available'
                  ? 'bg-ink text-white border-ink'
                  : property.property_status === 'sold'
                  ? 'bg-mist text-white border-mist'
                  : property.property_status === 'under_contract'
                  ? 'bg-muted text-white border-muted'
                  : 'bg-muted text-white border-muted'
              }`}>
                {property.property_status?.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </span>
            </div>
          </div>

          {/* UTM Share Links */}
          {onOpenUTMLinks && (
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink mb-2">Share links (UTM)</label>
              <p className="text-xs text-muted mb-2">
                Generate platform-specific links to track where your views come from.
              </p>
              <button
                type="button"
                onClick={() => onOpenUTMLinks(property)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-ink hover:bg-smoke-2 text-white border-[1.5px] border-ink text-sm font-semibold rounded-[10px] shadow-soft-3 transition-all duration-120"
              >
                <Link2 className="w-4 h-4" />
                Open UTM links
              </button>
            </div>
          )}

          {/* Description */}
          {property.description && (
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink mb-2">Description</label>
              <div
                className="prose prose-sm max-w-none p-4 bg-tint-2 border border-hairline rounded-[10px]"
                dangerouslySetInnerHTML={{ __html: property.description }}
              />
            </div>
          )}

          {/* Repairs */}
          {property.repairs && (
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink mb-2">Repairs & Renovation</label>
              <div
                className="prose prose-sm max-w-none p-4 bg-tint-2 border border-hairline rounded-[10px]"
                dangerouslySetInnerHTML={{ __html: property.repairs }}
              />
            </div>
          )}

          {/* All Images */}
          {allImages.length > 1 && (
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink mb-3">
                All Images ({allImages.length})
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {allImages.map((img, idx) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.image_url}
                      alt={`Property image ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-[10px] border-[1.5px] border-ink"
                    />
                    {idx === 0 && (
                      <div className="absolute top-2 left-2 px-2.5 py-0.5 bg-body text-white font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] rounded-pill">
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
