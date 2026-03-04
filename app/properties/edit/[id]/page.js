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

// Main property types for real estate (buying/selling) – same as add property
const PROPERTY_TYPES = [
  'Single Family',
  'Multi-Family',
  'Condo',
  'Townhouse',
  'Apartment Building',
  'Commercial',
  'Land',
  'Other'
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
  const [sourceType, setSourceType] = useState(null); // 'manual' | 'scraped'
  const [tempSellerId, setTempSellerId] = useState(null); // for scraped fetch/save

  const descRef = useRef(null);
  const repairsRef = useRef(null);
  const initialTitleRef = useRef('');
  const initialLocationRef = useRef('');
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

  // Use scraper bucket for both (sellerpropertyimages often not created); manual uploads use path prefix "manual/"
  const storageBucket = 'scraperpropertyphotos';
  const uploadPathPrefix = sourceType === 'manual' ? 'manual' : null;

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user');
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
      setSourceType(null);

      // 1) Try manual property first (properties table)
      const { data: manualData, error: manualError } = await supabase
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
        .maybeSingle();

      if (manualError) throw manualError;

      if (manualData) {
        setSourceType('manual');
        const data = manualData;
        const derivedTitle = slugToTitle(data.slug);
        initialTitleRef.current = derivedTitle;
        initialLocationRef.current = data.address || '';
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
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        const mappedImages = sortedImages.map((img, index) => ({
          id: img.id || `existing-${index}`,
          status: 'completed',
          imageUrl: img.image_url,
          imageKey: img.image_key,
          preview: img.image_url,
          isFeatured: index === 0
        }));
        setImageUploadStatus({ images: mappedImages, isUploading: false, uploadingCount: 0 });
        setInspectionReport({
          url: data.inspection_report_url || null,
          key: data.inspection_report_key || null,
          uploading: false
        });
        return;
      }

      // 2) Not manual: try scraped (wholesale_deals) via temp_seller_id
      const { data: sellerRow } = await supabase
        .from('seller_applications')
        .select('temp_seller_id')
        .eq('id', userId)
        .maybeSingle();

      const tsid = sellerRow?.temp_seller_id;
      if (!tsid) {
        setError('Property not found.');
        return;
      }

      setTempSellerId(tsid);

      const { data: scrapedData, error: scrapedError } = await supabase
        .from('wholesale_deals')
        .select(`
          *,
          property_photos (
            id,
            photo_url,
            display_order,
            is_featured
          )
        `)
        .eq('id', id)
        .eq('temp_seller_id', tsid)
        .maybeSingle();

      if (scrapedError || !scrapedData) {
        setError('Property not found.');
        return;
      }

      setSourceType('scraped');
      const d = scrapedData;

      const derivedTitle = d.slug ? slugToTitle(d.slug) : (d.full_address || d.display_address || d.address || '').trim();
      const locationLine = d.full_address || d.display_address || d.address || '';
      initialTitleRef.current = derivedTitle;
      initialLocationRef.current = locationLine || '';
      existingSlugRef.current = d.slug || '';

      setFormData({
        title: derivedTitle,
        location: locationLine,
        price: d.price ?? '',
        bedrooms: d.bedrooms ?? d.rooms ?? '',
        bathrooms: d.bathrooms ?? '',
        floor_area: d.sqft ?? '',
        property_type: d.property_type || 'Hotel',
        property_status: 'available',
        status: d.status || 'draft',
        latitude: d.latitude ?? '',
        longitude: d.longitude ?? '',
        county: d.county ?? '',
        city: d.city ?? '',
        zipcode: d.zip_code ?? '',
        state: d.state ?? '',
        description: d.description || '',
        repairs: Array.isArray(d.features) ? d.features.join('\n') : (d.repair_cost != null ? String(d.repair_cost) : ''),
        seo_title: d.seo_title || '',
        seo_description: d.seo_description || '',
        social_title: d.social_title || '',
        social_description: d.social_description || '',
        social_image_url: d.social_image_url || ''
      });

      const sortedPhotos = (d.property_photos || []).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      const mappedImages = sortedPhotos.map((img, index) => ({
        id: img.id != null ? `photo-${img.id}` : `existing-${index}`,
        status: 'completed',
        imageUrl: img.photo_url ? String(img.photo_url).trim() : '',
        imageKey: null,
        preview: img.photo_url || '',
        isFeatured: !!img.is_featured || index === 0
      })).filter((img) => img.imageUrl);
      setImageUploadStatus({ images: mappedImages, isUploading: false, uploadingCount: 0 });
      setInspectionReport({
        url: d.inspection_report_url || null,
        key: d.inspection_report_key || null,
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

    // Short unique slug when address changes (e.g. k2m9x4np)
    const locationForSlug = (formData.location || '').trim();
    const shouldUpdateSlug = locationForSlug &&
      locationForSlug.toLowerCase() !== (initialLocationRef.current || '').trim().toLowerCase();
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const newShortSlug = () => Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const slugToSave = shouldUpdateSlug ? newShortSlug() : existingSlugRef.current;

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
      if (sourceType === 'scraped') {
        const locationLine = formData.location || '';
        const scrapedPayload = {
          updated_at: new Date().toISOString(),
          slug: slugToSave,
          address: locationLine,
          full_address: locationLine,
          display_address: locationLine,
          city: formData.city || null,
          state: formData.state || null,
          zip_code: formData.zipcode || null,
          county: formData.county || null,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          price: formData.price ? parseFloat(formData.price) : null,
          bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
          bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : null,
          sqft: formData.floor_area ? parseInt(formData.floor_area) : null,
          property_type: formData.property_type || null,
          status: publishStatus,
          description: formData.description || null,
          features: formData.repairs ? formData.repairs.split(/\n/).filter(Boolean) : null,
          inspection_report_url: inspectionReport.url || null,
          inspection_report_key: inspectionReport.key || null,
          seo_title: formData.seo_title || null,
          seo_description: formData.seo_description || null,
          social_title: formData.social_title || null,
          social_description: formData.social_description || null,
          social_image_url: formData.social_image_url || null
        };

        const { error: updateError } = await supabase
          .from('wholesale_deals')
          .update(scrapedPayload)
          .eq('id', id)
          .eq('temp_seller_id', tempSellerId);

        if (updateError) throw updateError;

        const { error: deletePhotosError } = await supabase
          .from('property_photos')
          .delete()
          .eq('deal_id', id);
        if (deletePhotosError) {
          console.error('Property photos delete error:', deletePhotosError);
          throw new Error('Failed to clear existing photos. Please try again.');
        }

        const completedImages = imageUploadStatus.images.filter(
          (img) => img.status === 'completed' && img.imageUrl && String(img.imageUrl).trim()
        );
        if (completedImages.length > 0) {
          const photoRows = completedImages.map((img, index) => ({
            deal_id: id,
            photo_url: String(img.imageUrl).trim(),
            display_order: index,
            is_featured: !!img.isFeatured
          }));
          const { error: photosError } = await supabase
            .from('property_photos')
            .insert(photoRows);
          if (photosError) {
            console.error('Property photos insert error:', photosError);
            throw new Error(photosError.message || 'Failed to save photos. Please try again.');
          }
        }

        setSuccess(
          publishStatus === 'active'
            ? 'Property updated and published!'
            : 'Property updated successfully!'
        );
        setTimeout(() => router.push('/properties'), 1500);
        setSaving(false);
        return;
      }

      const { data, error: updateError } = await supabase
        .from('properties')
        .update(saveData)
        .eq('id', id)
        .eq('seller_id', userId)
        .select()
        .single();

      if (updateError) throw updateError;

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
    } finally {
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
        .from(storageBucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(storageBucket)
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
          .from(storageBucket)
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
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
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
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                    placeholder="2500000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Property Type</label>
                  <select
                    value={formData.property_type ?? ''}
                    onChange={(e) => handleInputChange('property_type', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                  >
                    <option value="">Select property type</option>
                    {PROPERTY_TYPES.map((type) => (
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
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                    placeholder="25000"
                    min="0"
                  />
                </div>
              </div>

              {sourceType !== 'scraped' && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Property Status</label>
                  <select
                    value={formData.property_status || 'available'}
                    onChange={(e) => handleInputChange('property_status', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                  >
                    {PROPERTY_STATUSES.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              )}

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
              sellerId={userId || tempSellerId || id}
              storageBucket={storageBucket}
              uploadPathPrefix={uploadPathPrefix}
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
                    className={`inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer ${
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
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Upload className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">Inspection Report</p>
                        <a
                          href={inspectionReport.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
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
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                      placeholder="Same as SEO title"
                      maxLength="60"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Social Description</label>
                    <textarea
                      value={formData.social_description || ''}
                      onChange={(e) => handleInputChange('social_description', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                          className="text-xs font-medium text-primary hover:text-primary-700 mb-3"
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

