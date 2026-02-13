'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, Sparkles, FileText, Upload, Image as ImageIcon } from 'lucide-react';

const EditForm = ({ isOpen, onClose, onSuccess, amenity }) => {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    image: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Update form data when amenity changes
  useEffect(() => {
    if (amenity) {
      setFormData({
        name: amenity.name || '',
        description: amenity.description || '',
        is_active: amenity.is_active !== undefined ? amenity.is_active : true,
        image: amenity.image || ''
      });
      setImageFile(null);
    }
  }, [amenity]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      setImageFile(file);
      // Create preview URL for display
      const previewUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, image: previewUrl }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter amenity name');
      return;
    }

    try {
      setSaving(true);
      let imageUrl = amenity.image; // Keep existing image URL by default

      // Upload new image to Supabase Storage if there's a new file
      if (imageFile) {
        // Delete old image if it exists and is from our bucket
        if (amenity.image && amenity.image.includes('hotel-images')) {
          const oldPath = amenity.image.split('/hotel-images/').pop();
          if (oldPath) {
            await supabase.storage
              .from('hotel-images')
              .remove([oldPath]);
          }
        }

        // Upload new image
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `amenities/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('hotel-images')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Failed to upload image: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('hotel-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const { data, error } = await supabase
        .from('amenities')
        .update({
          name: formData.name,
          description: formData.description,
          is_active: formData.is_active,
          image: imageUrl
        })
        .eq('id', amenity.id)
        .select();

      if (error) throw error;

      onSuccess(data[0]);
      onClose();
    } catch (error) {
      console.error('Error updating amenity:', error);
      alert('Failed to update amenity: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && (
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
                  <h2 className="text-base sm:text-lg font-semibold text-white">Edit Amenity</h2>
                  <p className="text-[10px] sm:text-xs text-neutral-400 hidden sm:block">Update amenity details</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
            </div>

            {/* Form Content - Scrollable */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Basic Information Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Basic Information
                  </h3>
                  <div>
                    <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">
                      Amenity Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-neutral-200 rounded-lg px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      placeholder="e.g., Swimming Pool"
                      required
                    />
                  </div>
                </div>

                {/* Image Upload Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Image Upload
                  </h3>
                  <div>
                    <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">Amenity Image</label>
                    <div className="border-2 border-dashed border-neutral-300 rounded-lg p-3 sm:p-4 text-center hover:border-neutral-400 transition-colors bg-white">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="image-upload-edit"
                      />
                      <label htmlFor="image-upload-edit" className="cursor-pointer">
                        <Upload className="mx-auto mb-1.5 sm:mb-2 text-neutral-400" size={28} />
                        <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                          {imageFile ? imageFile.name : 'Click to change image'}
                        </p>
                        <p className="text-[10px] sm:text-xs text-white/70 mt-0.5 sm:mt-1">PNG, JPG up to 5MB</p>
                      </label>
                    </div>
                    {formData.image && (
                      <div className="mt-2 sm:mt-3">
                        <img
                          src={formData.image}
                          alt="Preview"
                          className="w-full h-40 sm:h-48 object-cover rounded-lg border-2 border-neutral-200"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Description Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Description
                  </h3>
                  <div>
                    <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">Amenity Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows="4"
                      className="w-full border border-neutral-200 rounded-lg px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      placeholder="Enter amenity description..."
                    />
                  </div>
                </div>

                {/* Status Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4">Status</h3>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <input
                      type="checkbox"
                      id="edit-active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-900 border-neutral-300 rounded focus:ring-[#472F97]"
                    />
                    <label htmlFor="edit-active" className="text-xs sm:text-sm font-medium text-neutral-700">
                      Set as Active
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Sticky */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-[#472F97] hover:bg-[#3a2578] text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2"
                >
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {saving ? 'Saving...' : 'Update Amenity'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>,
    document.body
  );
};

export default EditForm;
