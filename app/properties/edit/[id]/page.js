"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Save, Eye, ArrowLeft, Upload, X, AlertCircle } from 'lucide-react';
import ImageGalleryManager from '@/components/properties/ImageGalleryManager';
import TextEditor from '@/components/forms/TextEditor';
import GooglePlacesAutocomplete from '@/components/forms/GooglePlacesAutocomplete';

const PROPERTY_STATUSES = [
  { value: 'available', label: 'Available - Ready for sale' },
  { value: 'pending', label: 'Pending - Under contract' },
  { value: 'sold', label: 'Sold - Transaction complete' },
  { value: 'under_contract', label: 'Under Contract - In negotiation' }
];

const PROPERTY_TYPES = [
  'Hotel',
  'Resort',
  'Motel',
  'Apartment Complex',
  'Vacation Rental',
  'Boutique Hotel',
  'Hostel',
  'Villa',
  'Luxury Property'
];

const slugToTitle = (slug) => (
  slug
    ? slug.replace(/\d+$/, '').replace(/-+$/, '').replace(/-/g, ' ').trim()
    : ''
);

export default function EditPropertyPage() {
  const router = useRouter();
  const { id } = useParams();
  const [saving, setSaving] = useState(false);
  const [loadingProperty, setLoadingProperty] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [showAllPreviewImages, setShowAllPreviewImages] = useState(false);
  const [userId, setUserId] = useState(null);

  const descRef = useRef(null);
  const repairsRef = useRef(null);
  const initialTitleRef = useRef('');
  const existingSlugRef = useRef('');

  const [formData, setFormData] = useState({
    status: 'draft',
    property_status: 'available',
    property_type: 'Hotel'
  });

  const [imageUploadStatus, setImageUploadStatus] = useState({
    isUploading: false,
    uploadingCount: 0,
    images: []
  });

  const [inspectionReport, setInspectionReport] = useState({
    url: null,
    key: null,
    uploading: false
  });

  useEffect(() => {
    const userStr = localStorage.getItem('hotel_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
    }
  }, []);

  useEffect(() => {
    if (userId && id) {
      fetchProperty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, id]);

  const fetchProperty = async () => {
    try {
      setLoadingProperty(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('properties')
        .select(`
          *,
          property_images (
            id,
            image_url,
            image_key,
            sort_order
          )
        `)
        .eq('id', id)
        .eq('seller_id', userId)
        .single();

      if (fetchError || !data) {
        throw fetchError || new Error('Property not found');
      }

      const derivedTitle = slugToTitle(data.slug);
      initialTitleRef.current = derivedTitle;
      existingSlugRef.current = data.slug || '';

      setFormData({
        title: derivedTitle,
        location: data.address || '',
        price: data.price ?? '',
        bedrooms: data.bedrooms ?? '',
        bathrooms: data.bathrooms ?? '',
        floor_area: data.floor_area ?? '',
        property_type: data.property_type || 'Hotel',
        property_status: data.property_status || 'available',
        status: data.status || 'draft',
        latitude: data.latitude ?? '',
        longitude: data.longitude ?? '',
        county: data.county ?? '',
        city: data.city ?? '',
        zipcode: data.zipcode ?? '',
        state: data.state ?? '',
        description: data.description || '',
        repairs: data.repairs || '',
        seo_title: data.seo_title || '',
        seo_description: data.seo_description || '',
        social_title: data.social_title || '',
        social_description: data.social_description || '',
        social_image_url: data.social_image_url || ''
      });

      const sortedImages = (data.property_images || [])
        .sort((a, b) => a.sort_order - b.sort_order);

      const mappedImages = sortedImages.map((img, index) => ({
        id: img.id || `existing-${index}`,
        status: 'completed',
        imageUrl: img.image_url,
        imageKey: img.image_key,
        preview: img.image_url,
        isFeatured: index === 0
      }));

      setImageUploadStatus({
        images: mappedImages,
        isUploading: false,
        uploadingCount: 0
      });

      setInspectionReport({
        url: data.inspection_report_url || null,
        key: data.inspection_report_key || null,
        uploading: false
      });
    } catch (err) {
      console.error('Failed to load property:', err);
      setError('Failed to load property. Please try again.');
    } finally {
      setLoadingProperty(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddressSelect = (addressData) => {
    setFormData(prev => ({
      ...prev,
      location: addressData.address,
      latitude: addressData.latitude,
      longitude: addressData.longitude,
      county: addressData.county,
      city: addressData.city,
      zipcode: addressData.zipcode,
      state: addressData.stateShort
    }));
  };

  const handleTabChange = (tabId) => {
    // Save editor content before switching tabs
    if (descRef.current) {
      const cleanDescription = descRef.current.getCleanHTML?.() || descRef.current.getHTML?.() || '';
      setFormData(prev => ({ ...prev, description: cleanDescription }));
    }
    if (repairsRef.current) {
      const cleanRepairs = repairsRef.current.getCleanHTML?.() || repairsRef.current.getHTML?.() || '';
      setFormData(prev => ({ ...prev, repairs: cleanRepairs }));
    }
    setActiveTab(tabId);
  };

  const handleSave = async (publishStatus = 'draft') => {
    if (!formData.title || !formData.location) {
      setError('Please fill in Title and Address before saving.');
      return;
    }

    if (imageUploadStatus.isUploading) {
      setError(`Please wait for ${imageUploadStatus.uploadingCount} image${imageUploadStatus.uploadingCount > 1 ? 's' : ''} to finish uploading.`);
      return;
    }

    // Save editor content before submitting
    if (descRef.current) {
      const cleanDescription = descRef.current.getCleanHTML?.() || descRef.current.getHTML?.() || '';
      formData.description = cleanDescription;
    }
    if (repairsRef.current) {
      const cleanRepairs = repairsRef.current.getCleanHTML?.() || repairsRef.current.getHTML?.() || '';
      formData.repairs = cleanRepairs;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const trimmedTitle = formData.title.trim();
    const slugBase = trimmedTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const shouldUpdateSlug = trimmedTitle &&
      trimmedTitle.toLowerCase() !== (initialTitleRef.current || '').toLowerCase();

    const slugToSave = shouldUpdateSlug && slugBase
      ? `${slugBase}-${Date.now()}`
      : existingSlugRef.current;

    // Create save data object matching the actual database schema
    const saveData = {
      status: publishStatus,
      slug: slugToSave,
      address: formData.location || '',
      property_status: formData.property_status || 'available',
      property_type: formData.property_type || 'Hotel',
      description: formData.description || '',
      repairs: formData.repairs || ''
    };

    // Add numeric fields
    if (formData.price) saveData.price = parseFloat(formData.price);
    if (formData.bedrooms) saveData.bedrooms = parseInt(formData.bedrooms);
    if (formData.bathrooms) saveData.bathrooms = parseFloat(formData.bathrooms);
    if (formData.floor_area) saveData.floor_area = parseInt(formData.floor_area);

    // Add location coordinates from Google Places
    if (formData.latitude) saveData.latitude = formData.latitude;
    if (formData.longitude) saveData.longitude = formData.longitude;
    if (formData.state) saveData.state = formData.state;

    // Add SEO fields (using correct column names from schema)
    if (formData.seo_title) saveData.seo_title = formData.seo_title;
    if (formData.seo_description) saveData.seo_description = formData.seo_description;
    if (formData.social_image_url) saveData.social_image_url = formData.social_image_url;

    // Add inspection report if provided
    if (inspectionReport.url) saveData.inspection_report_url = inspectionReport.url;
    if (inspectionReport.key) saveData.inspection_report_key = inspectionReport.key;

    try {
      const { data, error: updateError } = await supabase
        .from('properties')
        .update(saveData)
        .eq('id', id)
        .eq('seller_id', userId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Replace images in database
      const { error: deleteImagesError } = await supabase
        .from('property_images')
        .delete()
        .eq('property_id', data.id);

      if (deleteImagesError) {
        console.error('Images delete error:', deleteImagesError);
      }

      if (imageUploadStatus.images.length > 0) {
        const completedImages = imageUploadStatus.images.filter(
          img => img.status === 'completed' && img.imageUrl
        );

        if (completedImages.length > 0) {
          const imageRecords = completedImages.map((img, index) => ({
            property_id: data.id,
            image_url: img.imageUrl,
            image_key: img.imageKey,
            sort_order: index
          }));

          const { error: imagesError } = await supabase
            .from('property_images')
            .insert(imageRecords);

          if (imagesError) {
            console.error('Images save error:', imagesError);
          }
        }
      }

      setSuccess(
        publishStatus === 'active'
          ? 'Property updated and published!'
          : 'Property updated successfully!'
      );

      setTimeout(() => {
        router.push('/properties');
      }, 1500);
    } catch (err) {
      console.error('Update failed:', err);
      setError(err?.message || 'Failed to update property. Please try again.');
      setSaving(false);
    }
  };

  const handleImagesChange = (data) => {
    setImageUploadStatus({
      images: data.images,
      isUploading: data.isUploading,
      uploadingCount: data.uploadingCount
    });
  };

  const handleInspectionUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF or DOC file');
      return;
    }

    setInspectionReport(prev => ({ ...prev, uploading: true }));
    setError(null);

    try {
      const fileName = `inspection-reports/${userId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('sellerpropertyimages')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('sellerpropertyimages')
        .getPublicUrl(fileName);

      setInspectionReport({
        url: publicUrl,
        key: fileName,
        uploading: false
      });

    } catch (err) {
      console.error('Upload failed:', err);
      setError('Failed to upload inspection report');
      setInspectionReport(prev => ({ ...prev, uploading: false }));
    }
  };

  const handleRemoveInspection = async () => {
    if (inspectionReport.key) {
      try {
        await supabase.storage
          .from('sellerpropertyimages')
          .remove([inspectionReport.key]);
      } catch (err) {
        console.error('Failed to delete file:', err);
      }
    }
    setInspectionReport({ url: null, key: null, uploading: false });
  };

  if (loadingProperty) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-900 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-neutral-600" />
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Edit Property</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Update your wholesale property listing</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={saving || imageUploadStatus.isUploading}
            className="flex items-center justify-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            <span>
              {imageUploadStatus.isUploading
                ? `Uploading ${imageUploadStatus.uploadingCount}...`
                : saving ? 'Saving…' : 'Save Draft'
              }
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSave('active')}
            disabled={saving || imageUploadStatus.isUploading}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye size={16} />
            <span>
              {imageUploadStatus.isUploading
                ? 'Please wait...'
                : saving ? 'Publishing…' : 'Publish'
              }
            </span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Warning */}
      {imageUploadStatus.isUploading && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Uploading Images</h4>
            <p className="text-sm text-blue-700">
              Please wait for {imageUploadStatus.uploadingCount} image{imageUploadStatus.uploadingCount > 1 ? 's' : ''} to finish uploading before publishing.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="flex border-b border-neutral-200 overflow-x-auto scrollbar-hide">
          {[
            { id: 'basic', label: 'Basic Info' },
            { id: 'images', label: 'Images' },
            { id: 'inspection', label: 'Inspection Report' },
            { id: 'content', label: 'Content' },
            { id: 'seo', label: 'SEO & Social' },
            { id: 'preview', label: 'Preview' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 md:px-6 py-3 md:py-4 font-medium transition-colors whitespace-nowrap text-xs md:text-sm ${
                activeTab === tab.id
                  ? 'text-[#472F97] border-b-2 border-[#472F97] bg-[#F5F3FF]'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Property Title *</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
                  placeholder="Luxury Beachfront Hotel in Miami"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Location *</label>
                <GooglePlacesAutocomplete
                  onAddressSelect={handleAddressSelect}
                  defaultValue={formData.location || ''}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Start typing to search for an address
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Price ($)</label>
                  <input
                    type="number"
                    value={formData.price || ''}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
                    placeholder="2500000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Property Type</label>
                  <select
                    value={formData.property_type || 'Hotel'}
                    onChange={(e) => handleInputChange('property_type', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
                  >
                    {PROPERTY_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Rooms/Units</label>
                  <input
                    type="number"
                    value={formData.bedrooms || ''}
                    onChange={(e) => handleInputChange('bedrooms', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
                    placeholder="50"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Bathrooms</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.bathrooms || ''}
                    onChange={(e) => handleInputChange('bathrooms', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
                    placeholder="50"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Floor Area (sqft)</label>
                  <input
                    type="number"
                    value={formData.floor_area || ''}
                    onChange={(e) => handleInputChange('floor_area', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
                    placeholder="25000"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Property Status</label>
                <select
                  value={formData.property_status || 'available'}
                  onChange={(e) => handleInputChange('property_status', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
                >
                  {PROPERTY_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>

              {/* Featured Image Preview */}
              {imageUploadStatus.images.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Featured Image</label>
                  <div className="border-2 border-neutral-200 rounded-xl p-4 bg-neutral-50">
                    {imageUploadStatus.images.some(img => img.status === 'completed' && img.isFeatured) ? (
                      <div className="flex items-center gap-4">
                        <img
                          src={imageUploadStatus.images.find(img => img.status === 'completed' && img.isFeatured)?.imageUrl}
                          alt="Featured"
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                        <div>
                          <p className="text-sm font-medium text-neutral-900 mb-1">Featured image selected</p>
                          <p className="text-xs text-neutral-500">You can change or clear this in the Images tab</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-neutral-500">Select a featured image in the Images tab</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Images Tab */}
          <div className={activeTab === 'images' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Property Images</h3>
            <p className="text-sm text-neutral-600 mb-6">
              Upload property images. They will be automatically compressed and uploaded immediately. The first image will be set as the featured image.
            </p>
            <ImageGalleryManager
              images={imageUploadStatus.images}
              onImagesChange={handleImagesChange}
              sellerId={userId}
            />
          </div>

          {/* Inspection Report Tab */}
          {activeTab === 'inspection' && (
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Inspection Report</h3>
              <p className="text-sm text-neutral-600 mb-6">
                Upload the inspection report for this property (PDF or DOC format)
              </p>

              {!inspectionReport.url ? (
                <div className="border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center">
                  <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                  <p className="text-sm text-neutral-600 mb-4">
                    Upload PDF or DOC file
                  </p>
                  <input
                    type="file"
                    id="inspection-upload"
                    accept=".pdf,.doc,.docx"
                    onChange={handleInspectionUpload}
                    className="hidden"
                    disabled={inspectionReport.uploading}
                  />
                  <label
                    htmlFor="inspection-upload"
                    className={`inline-flex items-center gap-2 px-4 py-2 bg-[#472F97] hover:bg-[#3a2578] text-white rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      inspectionReport.uploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {inspectionReport.uploading ? 'Uploading...' : 'Choose File'}
                  </label>
                </div>
              ) : (
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F5F3FF] rounded-lg flex items-center justify-center">
                        <Upload className="w-5 h-5 text-[#472F97]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">Inspection Report</p>
                        <a
                          href={inspectionReport.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#472F97] hover:underline"
                        >
                          View Document
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveInspection}
                      className="p-2 rounded-lg hover:bg-neutral-200 text-neutral-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content Tab */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Property Description</label>
                <TextEditor
                  ref={descRef}
                  id="description-editor"
                  content={formData.description || ''}
                  placeholder="Describe the property, its features, amenities, and unique selling points..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Repairs & Renovation</label>
                <TextEditor
                  ref={repairsRef}
                  id="repairs-editor"
                  content={formData.repairs || ''}
                  placeholder="Detail any repairs needed, recent renovations, or planned improvements..."
                />
              </div>
            </div>
          )}

          {/* SEO & Social Tab */}
          {activeTab === 'seo' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Search Engine Optimization</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">SEO Title</label>
                    <input
                      type="text"
                      value={formData.seo_title || ''}
                      onChange={(e) => handleInputChange('seo_title', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
                      placeholder="Luxury Beachfront Hotel Investment Opportunity"
                      maxLength="60"
                    />
                    <div className="text-xs text-neutral-500 mt-1">
                      {(formData.seo_title || '').length}/60 characters
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">SEO Description</label>
                    <textarea
                      value={formData.seo_description || ''}
                      onChange={(e) => handleInputChange('seo_description', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
                      rows="3"
                      placeholder="Discover this stunning wholesale hotel property..."
                      maxLength="160"
                    />
                    <div className="text-xs text-neutral-500 mt-1">
                      {(formData.seo_description || '').length}/160 characters
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Social Media</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Social Title</label>
                    <input
                      type="text"
                      value={formData.social_title || ''}
                      onChange={(e) => handleInputChange('social_title', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
                      placeholder="Same as SEO title"
                      maxLength="60"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Social Description</label>
                    <textarea
                      value={formData.social_description || ''}
                      onChange={(e) => handleInputChange('social_description', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
                      rows="3"
                      placeholder="Same as SEO description"
                      maxLength="160"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Social Image URL</label>
                    <input
                      type="url"
                      value={formData.social_image_url || ''}
                      onChange={(e) => handleInputChange('social_image_url', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
                      placeholder="https://example.com/image.jpg"
                    />
                    <div className="text-xs text-neutral-500 mt-1">
                      Leave empty to use first uploaded image
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Property Preview</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Title</p>
                    <p className="text-base font-semibold text-neutral-900">{formData.title || 'No title'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Location</p>
                    <p className="text-sm text-neutral-700">{formData.location || 'No location'}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Price</p>
                      <p className="text-sm font-semibold text-neutral-900">${parseFloat(formData.price || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Rooms</p>
                      <p className="text-sm text-neutral-700">{formData.bedrooms || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Area</p>
                      <p className="text-sm text-neutral-700">{formData.floor_area ? `${formData.floor_area} sqft` : 'N/A'}</p>
                    </div>
                  </div>
                  {formData.description && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-2">Description</p>
                      <div
                        className="text-sm text-neutral-700 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: formData.description }}
                      />
                    </div>
                  )}
                  {formData.repairs && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-2">Repairs & Renovation</p>
                      <div
                        className="text-sm text-neutral-700 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: formData.repairs }}
                      />
                    </div>
                  )}
                  {imageUploadStatus.images.filter(img => img.status === 'completed').length > 0 && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-2">
                        Images ({imageUploadStatus.images.filter(img => img.status === 'completed').length})
                        {imageUploadStatus.images.filter(img => img.status === 'completed').length > 8 &&
                          <span className="text-neutral-400">
                            {showAllPreviewImages ? ' • Showing all' : ' • Showing first 8'}
                          </span>
                        }
                      </p>
                      {imageUploadStatus.images.filter(img => img.status === 'completed').length > 8 && (
                        <button
                          type="button"
                          onClick={() => setShowAllPreviewImages(prev => !prev)}
                          className="text-xs font-medium text-[#472F97] hover:text-[#3a2578] mb-3"
                        >
                          {showAllPreviewImages ? 'Show first 8' : 'Show all'}
                        </button>
                      )}
                      <div className="grid grid-cols-4 gap-3">
                        {imageUploadStatus.images
                          .filter(img => img.status === 'completed')
                          .slice(0, showAllPreviewImages ? undefined : 8)
                          .map((img, idx) => (
                            <div key={idx} className="relative group">
                              <img
                                src={img.imageUrl}
                                alt={`Preview ${idx + 1}`}
                                className="w-full h-32 object-cover rounded-lg border-2 border-neutral-200"
                              />
                              {img.isFeatured && (
                                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-yellow-500 text-white text-[10px] font-medium rounded">
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
          )}
        </div>
      </div>
    </div>
  );
}

