'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, Sparkles, Upload, Plus, Search, ChevronDown } from 'lucide-react';

// Searchable Select Component
const SearchableSelect = ({ label, value, onChange, options, placeholder, required, getOptionLabel, getOptionValue }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    getOptionLabel(option).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOption = options.find(option => getOptionValue(option) === value);

  return (
    <div ref={dropdownRef} className="relative">
      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm bg-white cursor-pointer hover:border-neutral-300 transition-colors flex items-center justify-between"
      >
        <span className={selectedOption ? 'text-neutral-900' : 'text-neutral-400'}>
          {selectedOption ? getOptionLabel(selectedOption) : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-neutral-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-neutral-500 text-center">No options found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={getOptionValue(option)}
                  onClick={() => {
                    onChange(getOptionValue(option));
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-neutral-100 transition-colors ${
                    getOptionValue(option) === value ? 'bg-neutral-50 font-medium' : ''
                  }`}
                >
                  {getOptionLabel(option)}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AddForm = ({ isOpen, onClose, onSuccess, userId }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [amenityEntries, setAmenityEntries] = useState([{
    name: '',
    description: '',
    is_active: true,
    image: null,
    imageFile: null,
    imagePreview: ''
  }]);
  const [saving, setSaving] = useState(false);

  const statusOptions = [
    { value: true, label: 'Active' },
    { value: false, label: 'Inactive' }
  ];

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmenityEntries([{
        name: '',
        description: '',
        is_active: true,
        image: null,
        imageFile: null,
        imagePreview: ''
      }]);
    }
  }, [isOpen]);

  const addMoreAmenity = () => {
    setAmenityEntries([...amenityEntries, {
      name: '',
      description: '',
      is_active: true,
      image: null,
      imageFile: null,
      imagePreview: ''
    }]);
  };

  const removeAmenity = (index) => {
    if (amenityEntries.length > 1) {
      setAmenityEntries(amenityEntries.filter((_, i) => i !== index));
    }
  };

  const updateAmenityEntry = (index, field, value) => {
    const newEntries = [...amenityEntries];
    newEntries[index][field] = value;
    setAmenityEntries(newEntries);
  };

  const handleImageChange = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      const newEntries = [...amenityEntries];
      newEntries[index].imageFile = file;
      newEntries[index].imagePreview = previewUrl;
      setAmenityEntries(newEntries);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all entries
    for (let i = 0; i < amenityEntries.length; i++) {
      const entry = amenityEntries[i];
      if (!entry.name.trim()) {
        alert(`Please enter amenity name for Amenity ${i + 1}`);
        return;
      }
    }

    try {
      setSaving(true);

      const amenitiesToInsert = [];

      for (const entry of amenityEntries) {
        let imageUrl = null;

        // Upload image to Supabase Storage if there's a file
        if (entry.imageFile) {
          const fileExt = entry.imageFile.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `amenities/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('hotel-images')
            .upload(filePath, entry.imageFile, {
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

        amenitiesToInsert.push({
          user_id: userId,
          name: entry.name,
          description: entry.description,
          is_active: entry.is_active,
          image: imageUrl
        });
      }

      const { data, error } = await supabase
        .from('amenities')
        .insert(amenitiesToInsert)
        .select();

      if (error) throw error;

      onSuccess(data);
      onClose();
    } catch (error) {
      console.error('Error adding amenities:', error);
      alert('Failed to add amenities: ' + error.message);
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
                  <h2 className="text-base sm:text-lg font-semibold text-white">Add Amenity</h2>
                  <p className="text-[10px] sm:text-xs text-neutral-400 hidden sm:block">Create new amenity entry</p>
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
                {amenityEntries.map((entry, index) => (
                  <div key={index} className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 flex items-center gap-1.5 sm:gap-2">
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Amenity {index + 1} Information
                      </h3>
                      {amenityEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAmenity(index)}
                          className="p-1 sm:p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                        >
                          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3 sm:space-y-4">
                      {/* Amenity Name Field */}
                      <div>
                        <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">
                          Amenity Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={entry.name}
                          onChange={(e) => updateAmenityEntry(index, 'name', e.target.value)}
                          className="w-full border border-neutral-200 rounded-lg px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                          placeholder="e.g., Swimming Pool"
                          required
                        />
                      </div>

                      {/* Description Field */}
                      <div>
                        <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">
                          Description
                        </label>
                        <textarea
                          value={entry.description}
                          onChange={(e) => updateAmenityEntry(index, 'description', e.target.value)}
                          rows="3"
                          className="w-full border border-neutral-200 rounded-lg px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                          placeholder="Enter amenity description..."
                        />
                      </div>

                      {/* Image Upload Field */}
                      <div>
                        <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">
                          Amenity Image
                        </label>
                        <div className="border-2 border-dashed border-neutral-300 rounded-lg p-3 sm:p-4 text-center hover:border-neutral-400 transition-colors bg-white">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageChange(index, e)}
                            className="hidden"
                            id={`image-upload-${index}`}
                          />
                          <label htmlFor={`image-upload-${index}`} className="cursor-pointer">
                            <Upload className="mx-auto mb-1.5 sm:mb-2 text-neutral-400" size={28} />
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                              {entry.imageFile ? entry.imageFile.name : 'Click to upload image'}
                            </p>
                            <p className="text-[10px] sm:text-xs text-white/70 mt-0.5 sm:mt-1">PNG, JPG up to 5MB</p>
                          </label>
                        </div>
                        {entry.imagePreview && (
                          <div className="mt-2 sm:mt-3">
                            <img
                              src={entry.imagePreview}
                              alt="Preview"
                              className="w-full h-28 sm:h-32 object-cover rounded-lg border border-neutral-200"
                            />
                          </div>
                        )}
                      </div>

                      {/* Status Field */}
                      <SearchableSelect
                        label="Status"
                        value={entry.is_active}
                        onChange={(value) => updateAmenityEntry(index, 'is_active', value)}
                        options={statusOptions}
                        placeholder="Select Status"
                        getOptionLabel={(option) => option.label}
                        getOptionValue={(option) => option.value}
                      />
                    </div>
                  </div>
                ))}

                {/* Add More Button */}
                <button
                  type="button"
                  onClick={addMoreAmenity}
                  className="w-full flex items-center justify-center gap-1.5 sm:gap-2 border-2 border-dashed border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 text-neutral-600 hover:text-neutral-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-all"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Add Another Amenity
                </button>
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
                  {saving ? 'Saving...' : `Save Amenity${amenityEntries.length > 1 ? 's' : ''}`}
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

export default AddForm;
