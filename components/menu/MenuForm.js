'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, UtensilsCrossed, Tag, FileText, Image as ImageIcon, ToggleLeft, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MenuForm = ({ isOpen, onClose, onSuccess, mode = 'add', menuItem = null, userId, currency = '$' }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image: '',
    is_active: true
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && menuItem) {
      setFormData({
        name: menuItem.name || '',
        description: menuItem.description || '',
        price: menuItem.price || '',
        category: menuItem.category || '',
        image: menuItem.image || '',
        is_active: menuItem.is_active !== undefined ? menuItem.is_active : true
      });
      setImagePreview(menuItem.image || null);
      setImageFile(null);
    } else {
      setFormData({
        name: '',
        description: '',
        price: '',
        category: '',
        image: '',
        is_active: true
      });
      setImagePreview(null);
      setImageFile(null);
    }
  }, [mode, menuItem, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.price) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      let imageUrl = formData.image;

      // Upload image to Supabase Storage if there's a new file
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `menu/${fileName}`;

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

      if (mode === 'edit' && menuItem) {
        // Update existing menu item
        const { data, error } = await supabase
          .from('menu')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            price: parseFloat(formData.price),
            category: formData.category.trim() || null,
            image: imageUrl || null,
            is_active: formData.is_active
          })
          .eq('id', menuItem.id)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;

        onSuccess(data);
      } else {
        // Add new menu item
        const { data, error } = await supabase
          .from('menu')
          .insert([{
            user_id: userId,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            price: parseFloat(formData.price),
            category: formData.category.trim() || null,
            image: imageUrl || null,
            is_active: formData.is_active
          }])
          .select()
          .single();

        if (error) throw error;

        onSuccess(data);
      }

      // Reset form
      setFormData({
        name: '',
        description: '',
        price: '',
        category: '',
        image: '',
        is_active: true
      });
      setImageFile(null);
      setImagePreview(null);
      onClose();
    } catch (error) {
      console.error('Error saving menu item:', error);
      alert('Failed to save menu item: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      setImageFile(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Side Panel */}
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
                  <UtensilsCrossed className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">
                    {mode === 'edit' ? 'Edit Menu Item' : 'Add New Menu Item'}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-white/70">Fill in menu item details</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Form Content - Scrollable */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Basic Info Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4" />
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                        Item Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="Enter item name"
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Category</label>
                      <input
                        type="text"
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        placeholder="e.g., Breakfast, Drinks"
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                        Price <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="price"
                        value={formData.price}
                        onChange={handleChange}
                        required
                        placeholder="0.00"
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Description Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Description
                  </h3>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Enter item description"
                    rows={4}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent resize-none"
                  />
                </div>

                {/* Image Upload Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Image
                  </h3>

                  <input
                    id="menu-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />

                  {/* Image Preview */}
                  {imagePreview && (
                    <div className="mb-3 rounded-lg overflow-hidden border-2 border-neutral-200">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover"
                      />
                    </div>
                  )}

                  {/* File Upload Button */}
                  <div className="mb-3">
                    <label
                      htmlFor="menu-image-upload"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-neutral-300 rounded-lg hover:border-neutral-400 hover:bg-neutral-50 transition-all cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-neutral-600" />
                      <span className="text-sm font-medium text-neutral-700">Upload Image</span>
                    </label>
                    <p className="text-xs text-neutral-500 mt-1.5">Maximum file size: 5MB</p>
                  </div>

                  {/* OR Divider */}
                  <div className="relative my-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-neutral-300"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-neutral-50 px-2 text-neutral-600 font-medium">OR</span>
                    </div>
                  </div>

                  {/* URL Input */}
                  <input
                    type="text"
                    name="image"
                    value={formData.image}
                    onChange={handleChange}
                    placeholder="Or enter image URL"
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                  />
                </div>

                {/* Status Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <ToggleLeft className="w-4 h-4" />
                    Status
                  </h3>
                  <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-neutral-200 hover:border-neutral-300 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                      className="w-4 h-4 text-[#472F97] rounded focus:ring-2 focus:ring-[#472F97]"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-800">Active</p>
                      <p className="text-xs text-neutral-600">This item will be available for ordering</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons - Sticky */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-3 shadow-lg">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#472F97] hover:bg-[#3a2578] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : mode === 'edit' ? 'Update Item' : 'Save Item'}
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

export default MenuForm;
