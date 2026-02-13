'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, BedDouble, DollarSign, Users, Sparkles, Upload, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EditForm = ({ isOpen, onClose, onSuccess, roomType, amenities, userId }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    short_code: '',
    description: '',
    base_occupancy: '',
    higher_occupancy: '',
    extra_bed: false,
    kids_occupancy: '',
    amenities: [],
    base_price: '',
    additional_person_price: '',
    extra_bed_price: ''
  });
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (roomType) {
      setFormData({
        title: roomType.title || '',
        slug: roomType.slug || '',
        short_code: roomType.short_code || '',
        description: roomType.description || '',
        base_occupancy: roomType.base_occupancy || '',
        higher_occupancy: roomType.higher_occupancy || '',
        extra_bed: roomType.extra_bed || false,
        kids_occupancy: roomType.kids_occupancy || '',
        amenities: roomType.amenities || [],
        base_price: roomType.base_price || '',
        additional_person_price: roomType.additional_person_price || '',
        extra_bed_price: roomType.extra_bed_price || ''
      });
      setImagePreview(roomType.image || null);
      setImageFile(null);
    }
  }, [roomType]);

  const handleTitleChange = (title) => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    setFormData(prev => ({ ...prev, title, slug }));
  };

  const handleAmenityToggle = (amenityId) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter(id => id !== amenityId)
        : [...prev.amenities, amenityId]
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Please enter room type title');
      return;
    }

    if (!userId) {
      alert('User not authenticated');
      return;
    }

    try {
      setSaving(true);
      let imageUrl = roomType.image;

      if (imageFile) {
        if (roomType.image && roomType.image.includes('hotel-images')) {
          const oldPath = roomType.image.split('/hotel-images/').pop();
          if (oldPath) {
            await supabase.storage
              .from('hotel-images')
              .remove([oldPath]);
          }
        }

        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `room-types/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('hotel-images')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Failed to upload image: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('hotel-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const updateData = {
        title: formData.title,
        slug: formData.slug,
        short_code: formData.short_code,
        description: formData.description,
        base_occupancy: parseInt(formData.base_occupancy) || null,
        higher_occupancy: parseInt(formData.higher_occupancy) || null,
        extra_bed: formData.extra_bed,
        kids_occupancy: parseInt(formData.kids_occupancy) || null,
        amenities: formData.amenities,
        base_price: parseFloat(formData.base_price) || null,
        additional_person_price: parseFloat(formData.additional_person_price) || null,
        extra_bed_price: parseFloat(formData.extra_bed_price) || null,
        image: imageUrl
      };

      const { data, error } = await supabase
        .from('room_types')
        .update(updateData)
        .eq('id', roomType.id)
        .eq('user_id', userId)
        .select();

      if (error) throw error;

      onSuccess(data[0]);
      onClose();
    } catch (error) {
      console.error('Error updating room type:', error);
      alert('Failed to update room type: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
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
                  <h2 className="text-base sm:text-lg font-semibold text-white">Edit Room Type</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">Update accommodation details</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Basic Info Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <BedDouble className="w-4 h-4" />
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="e.g., Deluxe Room"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Slug</label>
                      <input
                        type="text"
                        value={formData.slug}
                        readOnly
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm bg-neutral-100 text-neutral-500"
                        placeholder="auto-generated"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Short Code</label>
                      <input
                        type="text"
                        value={formData.short_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, short_code: e.target.value.toUpperCase() }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="e.g., DLX"
                      />
                    </div>
                  </div>
                </div>

                {/* Occupancy Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Occupancy Details
                  </h3>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Base</label>
                      <input
                        type="number"
                        value={formData.base_occupancy}
                        onChange={(e) => setFormData(prev => ({ ...prev, base_occupancy: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-2 sm:px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="2"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Max</label>
                      <input
                        type="number"
                        value={formData.higher_occupancy}
                        onChange={(e) => setFormData(prev => ({ ...prev, higher_occupancy: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-2 sm:px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="4"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Kids</label>
                      <input
                        type="number"
                        value={formData.kids_occupancy}
                        onChange={(e) => setFormData(prev => ({ ...prev, kids_occupancy: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-2 sm:px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="1"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.extra_bed}
                        onChange={(e) => setFormData(prev => ({ ...prev, extra_bed: e.target.checked }))}
                        className="w-4 h-4 text-[#472F97] rounded focus:ring-[#472F97] border-neutral-300"
                      />
                      <span className="text-sm text-neutral-700">Extra Bed Available</span>
                    </label>
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Pricing
                  </h3>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Base Price</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.base_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, base_price: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-2 sm:px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="100.00"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">+Person</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.additional_person_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, additional_person_price: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-2 sm:px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="20.00"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">+Bed</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.extra_bed_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, extra_bed_price: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-2 sm:px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="15.00"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Image Upload Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Room Image
                  </h3>
                  <div className="space-y-3">
                    {imagePreview && !imageFile && (
                      <div className="relative">
                        <p className="text-xs font-medium text-neutral-600 mb-2">Current Image</p>
                        <img
                          src={imagePreview}
                          alt="Current room"
                          className="w-full h-48 object-cover rounded-lg border border-neutral-200"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-2">
                        {imagePreview && !imageFile ? 'Change Image' : 'Upload Image'}
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="image-upload-edit"
                      />
                      <label
                        htmlFor="image-upload-edit"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white border-2 border-dashed border-neutral-300 rounded-lg cursor-pointer hover:border-neutral-400 hover:bg-neutral-50 transition-all"
                      >
                        <Upload className="w-5 h-5 text-neutral-500" />
                        <span className="text-sm font-medium text-neutral-600">
                          {imageFile ? imageFile.name : 'Choose a new image'}
                        </span>
                      </label>
                      <p className="text-xs text-neutral-500 mt-2">Max file size: 5MB (JPG, PNG, WEBP)</p>
                    </div>

                    {imagePreview && imageFile && (
                      <div className="relative">
                        <p className="text-xs font-medium text-neutral-600 mb-2">New Image Preview</p>
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-48 object-cover rounded-lg border border-neutral-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(roomType?.image || null);
                          }}
                          className="absolute top-8 right-2 p-1.5 bg-[#472F97] hover:bg-[#3a2578] text-white rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent resize-none"
                    placeholder="Describe the room type..."
                  />
                </div>

                {/* Amenities */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Amenities ({formData.amenities.length} selected)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {amenities.length === 0 ? (
                      <p className="text-sm text-neutral-500 sm:col-span-2 text-center py-4">
                        No amenities available
                      </p>
                    ) : (
                      amenities.map(amenity => (
                        <label key={amenity.id} className="flex items-center gap-2 cursor-pointer hover:bg-neutral-100 rounded-lg p-2 transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.amenities.includes(amenity.id)}
                            onChange={() => handleAmenityToggle(amenity.id)}
                            className="w-4 h-4 text-[#472F97] rounded focus:ring-[#472F97] border-neutral-300"
                          />
                          <span className="text-sm text-neutral-700">{amenity.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-3 sm:px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-3 sm:px-4 py-2.5 bg-[#472F97] hover:bg-[#3a2578] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">{saving ? 'Saving...' : 'Update Room Type'}</span>
                  <span className="sm:hidden">{saving ? 'Saving...' : 'Update'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default EditForm;
