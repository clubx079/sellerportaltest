"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Save, ArrowLeft, Upload, X, AlertCircle, AlertTriangle, Home, FileText } from 'lucide-react';
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

function parseRejectionReasons(raw) {
  if (!raw) return {}
  const map = {}
  const prefixes = [
    ['photo',       'Photo'],
    ['description', 'Description'],
    ['repairs',     'Repairs'],
    ['inspection',  'Inspection report'],
    ['contract',    'Contract'],
  ]
  for (const [key, prefix] of prefixes) {
    const regex = new RegExp(`${prefix}:\\s*(.+?)(?=\\s*(?:Photo \\d+|Photo|Description|Repairs|Inspection report|Contract):|$)`, 'i')
    const m = raw.match(regex)
    if (m) map[key] = m[1].replace(/\.\s*$/, '').trim()
  }
  // Also catch "Photo 1:", "Photo 2:" etc.
  const photoNumMatch = raw.match(/Photo \d+:\s*(.+?)(?=\s*(?:Photo \d+|Description|Repairs|Inspection report|Contract):|$)/i)
  if (photoNumMatch && !map.photo) map.photo = photoNumMatch[1].replace(/\.\s*$/, '').trim()
  return map
}

export default function EditPropertyPage() {
  const router = useRouter();
  const { id } = useParams();
  const fromDraft = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('from_draft') === '1';
  const [saving, setSaving] = useState(false);
  const [loadingProperty, setLoadingProperty] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [rejectionReason, setRejectionReason] = useState(null);
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

  const [sellerType, setSellerType] = useState('owner');
  const [sellerProfileContact, setSellerProfileContact] = useState({ name: '', phone: '' });
  const [useCustomContact, setUseCustomContact] = useState(false);
  const [contractUpload, setContractUpload] = useState({
    url: null,
    key: null,
    filename: null,
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
      const name = user.contactPersonName || user.businessName || '';
      const phone = user.phone || '';
      setSellerProfileContact({ name, phone });
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
          social_image_url: data.social_image_url || '',
          contact_name: data.contact_name || '',
          contact_phone: data.contact_phone || '',
          _savedContactName: data.contact_name || '',
          _savedContactPhone: data.contact_phone || '',
        });

        // If listing has contact info saved, treat it as custom until we know the seller's profile
        if (data.contact_name || data.contact_phone) setUseCustomContact(true);

        // Set rejection reason and auto-navigate to the first tab with issues
        if (data.status === 'rejected' && data.rejection_reason) {
          setRejectionReason(data.rejection_reason)
          const rMap = parseRejectionReasons(data.rejection_reason)
          if (rMap.photo) setActiveTab('images')
          else if (rMap.description || rMap.repairs || rMap.inspection) setActiveTab('content')
          else if (rMap.contract) setActiveTab('ownership')
        }

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
        setSellerType(data.seller_type || 'owner');
        setContractUpload({
          url: data.contract_url || null,
          key: data.contract_key || null,
          filename: data.contract_url ? 'Contract' : null,
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
      setSellerType(d.seller_type || 'owner');
      setContractUpload({
        url: d.contract_url || null,
        key: d.contract_key || null,
        filename: d.contract_url ? 'Contract' : null,
        uploading: false
      });
    } catch (err) {
      console.error('Failed to load property:', err);
      setError('Failed to load property. Please try again.');
    } finally {
      setLoadingProperty(false);
    }
  };

  // When seller profile loads, check if saved contact matches profile → if so, switch to "seller data" mode
  useEffect(() => {
    if (!sellerProfileContact.name && !sellerProfileContact.phone) return;
    setFormData(prev => {
      const savedName = prev._savedContactName || '';
      const savedPhone = prev._savedContactPhone || '';
      const matchesProfile = savedName === sellerProfileContact.name && savedPhone === sellerProfileContact.phone;
      const isEmpty = !savedName && !savedPhone;
      if (matchesProfile || isEmpty) {
        setUseCustomContact(false);
        return { ...prev, contact_name: sellerProfileContact.name, contact_phone: sellerProfileContact.phone };
      }
      return prev;
    });
  }, [sellerProfileContact.name, sellerProfileContact.phone]);

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

    // Short unique slug when address changes: 7 alphabets + 2 numerics (e.g. kxmnpqr29)
    const locationForSlug = (formData.location || '').trim();
    const shouldUpdateSlug = locationForSlug &&
      locationForSlug.toLowerCase() !== (initialLocationRef.current || '').trim().toLowerCase();
    const alpha = 'abcdefghjkmnpqrstuvwxyz';
    const nums = '23456789';
    const newShortSlug = () => {
      const p1 = Array.from({ length: 7 }, () => alpha[Math.floor(Math.random() * alpha.length)]).join('');
      const p2 = Array.from({ length: 2 }, () => nums[Math.floor(Math.random() * nums.length)]).join('');
      return p1 + p2;
    };
    const slugToSave = shouldUpdateSlug ? newShortSlug() : existingSlugRef.current;

    // If listing is active/rejected, send back to under_review for re-moderation
    const effectiveStatus = publishStatus === 'active' ? 'under_review' : publishStatus;

    // Create save data object matching the actual database schema
    const saveData = {
      status: effectiveStatus,
      // Clear rejection reason whenever resubmitting for review
      ...(effectiveStatus === 'under_review' ? { rejection_reason: null } : {}),
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

    // Ownership
    if (sellerType) saveData.seller_type = sellerType;
    if (contractUpload.url) saveData.contract_url = contractUpload.url;
    if (contractUpload.key) saveData.contract_key = contractUpload.key;

    // Contact info
    saveData.contact_name = formData.contact_name || null;
    saveData.contact_phone = formData.contact_phone || null;

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
          status: effectiveStatus,
          ...(effectiveStatus === 'under_review' ? { rejection_reason: null } : {}),
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

        if (publishStatus === 'active') {
          fetch('/api/seller/moderate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ property_id: id }),
          }).catch(() => {});
        }
        setSuccess(
          publishStatus === 'active'
            ? 'Property updated and sent for review!'
            : 'Property updated successfully!'
        );
        setTimeout(() => router.push(fromDraft ? `/properties/enhance?id=${id}` : '/properties'), 1500);
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

      if (publishStatus === 'active') {
        fetch('/api/seller/moderate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: data.id }),
        }).catch(() => {});
      }
      setSuccess(
        publishStatus === 'active'
          ? 'Property updated and sent for review!'
          : 'Property updated successfully!'
      );

      setTimeout(() => {
        router.push(fromDraft ? `/properties/enhance?id=${data.id}` : '/properties');
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

  const handleContractUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF or DOC file');
      return;
    }
    setContractUpload(prev => ({ ...prev, uploading: true }));
    setError(null);
    try {
      const fileName = `contracts/${userId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from(storageBucket).getPublicUrl(fileName);
      setContractUpload({ url: publicUrl, key: fileName, filename: file.name, uploading: false });
    } catch (err) {
      console.error('Contract upload failed:', err);
      setError('Failed to upload contract');
      setContractUpload(prev => ({ ...prev, uploading: false }));
    }
  };

  const handleRemoveContract = async () => {
    if (contractUpload.key) {
      try {
        await supabase.storage.from(storageBucket).remove([contractUpload.key]);
      } catch (err) {
        console.error('Failed to delete contract:', err);
      }
    }
    setContractUpload({ url: null, key: null, filename: null, uploading: false });
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
            className="p-2 rounded hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-neutral-600" />
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-[#1A1816]">Edit Property</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={saving || imageUploadStatus.isUploading}
            className="flex items-center justify-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-2 rounded text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="flex items-center justify-center gap-2 bg-[#D03839] hover:bg-[#B82F30] text-white px-3 py-2 rounded text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>
              {imageUploadStatus.isUploading
                ? 'Please wait...'
                : saving ? 'Sending…' : 'Send for Review'
              }
            </span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-3 p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[#B82F30]">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-[#F5C4C0] hover:text-[#B82F30]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-3 bg-[#E4F5EC] border border-[#9FDBB8] rounded text-[#0F6E56]">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-[#9FDBB8] hover:text-[#0F6E56]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Warning */}
      {imageUploadStatus.isUploading && (
        <div className="flex items-start gap-3 p-4 bg-[#FAFAF8] border border-[#E8E8E4] rounded">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1A1816]"></div>
          <div>
            <h4 className="font-medium text-[#1A1816] mb-1">Uploading Images</h4>
            <p className="text-sm text-[#737370]">
              Please wait for {imageUploadStatus.uploadingCount} image{imageUploadStatus.uploadingCount > 1 ? 's' : ''} to finish uploading before sending for review.
            </p>
          </div>
        </div>
      )}

      {/* Rejection Banner */}
      {rejectionReason && (() => {
        const rMap = parseRejectionReasons(rejectionReason)
        return (
          <div className="bg-[#FEF3F2] border border-[#FECDCA] rounded p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded bg-[#FEE4E2] flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-[#B42318]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#B42318] mb-1">Your listing wasn&apos;t approved</p>
                <p className="text-[13px] text-[#B42318]/80 mb-3">Fix the issues below and click &quot;Send for Review&quot; — your listing will go back under review automatically.</p>
                <div className="space-y-1.5">
                  {Object.entries(rMap).map(([key, reason]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#B42318] flex-shrink-0 mt-1.5" />
                      <p className="text-[12px] text-[#B42318]">
                        <span className="font-semibold capitalize">{key === 'inspection' ? 'Inspection Report' : key}:</span> {reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Tabs */}
      {(() => {
        const rMap = rejectionReason ? parseRejectionReasons(rejectionReason) : {}
        const tabHasIssue = {
          images:    !!rMap.photo,
          content:   !!(rMap.description || rMap.repairs || rMap.inspection),
          ownership: !!rMap.contract,
        }
        return (
      <div className="bg-white rounded border border-[#E8E8E4] overflow-hidden">
        <div className="flex border-b border-[#E8E8E4]">
          {[
            { id: 'basic',     label: 'Basic Info' },
            { id: 'images',    label: 'Images' },
            { id: 'ownership', label: 'Ownership' },
            { id: 'content',   label: 'Content' },
            { id: 'seo',       label: 'SEO & Social' },
          ].map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-1 md:px-5 py-3.5 text-[12px] font-medium transition-colors border-b-2
                ${activeTab === tab.id
                  ? 'border-[#D03839] text-[#D03839] bg-[#FEF0EF]/30'
                  : 'border-transparent text-[#737370] hover:text-[#1A1816] hover:bg-[#FAFAF8]'}`}
            >
              <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                ${activeTab === tab.id ? 'bg-[#D03839] text-white' : 'bg-[#E8E8E4] text-[#737370]'}`}
              >
                {idx + 1}
              </span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tabHasIssue[tab.id] && <span className="w-1.5 h-1.5 rounded-full bg-[#B42318] flex-shrink-0" />}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
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
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                    placeholder="2500000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Property Type</label>
                  <select
                    value={formData.property_type ?? ''}
                    onChange={(e) => handleInputChange('property_type', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                  <select
                    value={formData.bedrooms || ''}
                    onChange={(e) => handleInputChange('bedrooms', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                  >
                    <option value="">Select</option>
                    {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                    <option value="5">5+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Bathrooms</label>
                  <select
                    value={formData.bathrooms || ''}
                    onChange={(e) => handleInputChange('bathrooms', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                  >
                    <option value="">Select</option>
                    {[1,1.5,2,2.5,3,3.5,4,4.5].map(n => <option key={n} value={n}>{n}</option>)}
                    <option value="5">5+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Floor Area (sqft)</label>
                  <input
                    type="number"
                    value={formData.floor_area || ''}
                    onChange={(e) => handleInputChange('floor_area', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                  >
                    {PROPERTY_STATUSES.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Contact Info */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#1A1816]">Contact Info</h3>
                    <p className="text-[13px] text-[#737370] mt-0.5">How buyers can reach you about this listing.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !useCustomContact;
                      setUseCustomContact(next);
                      if (!next) {
                        setFormData(prev => ({ ...prev, contact_name: sellerProfileContact.name, contact_phone: sellerProfileContact.phone }));
                      } else {
                        setFormData(prev => ({ ...prev, contact_name: '', contact_phone: '' }));
                      }
                    }}
                    className={`text-[12px] font-medium px-3 py-1.5 rounded border transition-colors ${
                      useCustomContact
                        ? 'bg-[#FEF0EF] border-[#F5C4C0] text-[#D03839]'
                        : 'bg-[#FAFAF8] border-[#E8E8E4] text-[#737370] hover:border-[#1A1816]'
                    }`}
                  >
                    {useCustomContact ? 'Using custom contact' : 'Use different contact'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Contact Name</label>
                    <input
                      type="text"
                      value={formData.contact_name || ''}
                      onChange={(e) => handleInputChange('contact_name', e.target.value)}
                      readOnly={!useCustomContact}
                      placeholder="Your name or company"
                      className={`w-full px-4 py-3 border rounded text-[13px] text-[#1A1816] transition-colors ${
                        useCustomContact
                          ? 'border-[#E8E8E4] focus:border-[#D03839] focus:outline-none'
                          : 'border-[#E8E8E4] bg-[#FAFAF8] text-[#737370] cursor-default outline-none'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Contact Phone</label>
                    <input
                      type="tel"
                      value={formData.contact_phone || ''}
                      onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                      readOnly={!useCustomContact}
                      placeholder="+1 (555) 000-0000"
                      className={`w-full px-4 py-3 border rounded text-[13px] text-[#1A1816] transition-colors ${
                        useCustomContact
                          ? 'border-[#E8E8E4] focus:border-[#D03839] focus:outline-none'
                          : 'border-[#E8E8E4] bg-[#FAFAF8] text-[#737370] cursor-default outline-none'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Featured Image Preview */}
              {imageUploadStatus.images.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Featured Image</label>
                  <div className="border-2 border-neutral-200 rounded p-4 bg-neutral-50">
                    {imageUploadStatus.images.some(img => img.status === 'completed' && img.isFeatured) ? (
                      <div className="flex items-center gap-4">
                        <img
                          src={imageUploadStatus.images.find(img => img.status === 'completed' && img.isFeatured)?.imageUrl}
                          alt="Featured"
                          className="w-24 h-24 object-cover rounded"
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
            <p className="text-sm text-neutral-600 mb-4">
              Upload property images. They will be automatically compressed and uploaded immediately. The first image will be set as the featured image.
            </p>
            {rejectionReason && parseRejectionReasons(rejectionReason).photo && (
              <div className="flex items-start gap-2.5 bg-[#FEF3F2] border border-[#FECDCA] rounded px-3 py-2.5 mb-5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#B42318] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#B42318]"><span className="font-semibold">Issue:</span> {parseRejectionReasons(rejectionReason).photo}</p>
              </div>
            )}
            <ImageGalleryManager
              images={imageUploadStatus.images}
              onImagesChange={handleImagesChange}
              sellerId={userId || tempSellerId || id}
              storageBucket={storageBucket}
              uploadPathPrefix={uploadPathPrefix}
            />
          </div>

          {/* Ownership Tab */}
          {activeTab === 'ownership' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1A1816] mb-1">Your relationship to this property</h3>
                <p className="text-[13px] text-[#737370] mb-5">This helps buyers understand the deal structure.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSellerType('owner')}
                    className={`flex flex-col items-center gap-3 p-5 rounded border-2 transition-all ${
                      sellerType === 'owner'
                        ? 'border-[#D03839] bg-[#FEF0EF]'
                        : 'border-[#E8E8E4] bg-white hover:border-[#1A1816]'
                    }`}
                  >
                    <Home className={`w-7 h-7 ${sellerType === 'owner' ? 'text-[#D03839]' : 'text-[#737370]'}`} />
                    <div className="text-center">
                      <p className={`text-[13px] font-semibold ${sellerType === 'owner' ? 'text-[#D03839]' : 'text-[#1A1816]'}`}>I&apos;m the Owner</p>
                      <p className="text-[11px] text-[#737370] mt-0.5">I own this property directly</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellerType('wholesaler')}
                    className={`flex flex-col items-center gap-3 p-5 rounded border-2 transition-all ${
                      sellerType === 'wholesaler'
                        ? 'border-[#D03839] bg-[#FEF0EF]'
                        : 'border-[#E8E8E4] bg-white hover:border-[#1A1816]'
                    }`}
                  >
                    <FileText className={`w-7 h-7 ${sellerType === 'wholesaler' ? 'text-[#D03839]' : 'text-[#737370]'}`} />
                    <div className="text-center">
                      <p className={`text-[13px] font-semibold ${sellerType === 'wholesaler' ? 'text-[#D03839]' : 'text-[#1A1816]'}`}>I&apos;m a Wholesaler</p>
                      <p className="text-[11px] text-[#737370] mt-0.5">I have a contract to assign</p>
                    </div>
                  </button>
                </div>
              </div>

              {sellerType === 'wholesaler' && (
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1A1816] mb-1">Assignment Contract</h3>
                  <p className="text-[13px] text-[#737370] mb-3">Upload your signed assignment contract. (PDF or DOC)</p>
                  {rejectionReason && parseRejectionReasons(rejectionReason).contract && (
                    <div className="flex items-start gap-2.5 bg-[#FEF3F2] border border-[#FECDCA] rounded px-3 py-2.5 mb-4">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#B42318] flex-shrink-0 mt-0.5" />
                      <p className="text-[12px] text-[#B42318]"><span className="font-semibold">Issue:</span> {parseRejectionReasons(rejectionReason).contract}</p>
                    </div>
                  )}
                  {!contractUpload.url ? (
                    <div className="border border-dashed border-[#E8E8E4] rounded p-8 text-center">
                      <FileText className="w-12 h-12 text-[#A8A8A4] mx-auto mb-4" />
                      <p className="text-[13px] text-[#737370] mb-4">Upload PDF or DOC file</p>
                      <input
                        type="file"
                        id="contract-upload"
                        accept=".pdf,.doc,.docx"
                        onChange={handleContractUpload}
                        className="hidden"
                        disabled={contractUpload.uploading}
                      />
                      <label
                        htmlFor="contract-upload"
                        className={`inline-flex items-center gap-2 px-4 py-2 bg-[#D03839] hover:bg-[#B82F30] text-white rounded text-[13px] font-medium transition-colors cursor-pointer ${
                          contractUpload.uploading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {contractUpload.uploading ? 'Uploading...' : 'Choose File'}
                      </label>
                    </div>
                  ) : (
                    <div className="bg-[#FAFAF8] border border-[#E8E8E4] rounded p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#D03839]/10 rounded flex items-center justify-center">
                            <FileText className="w-5 h-5 text-[#D03839]" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-[#1A1816]">{contractUpload.filename || 'Contract'}</p>
                            <a href={contractUpload.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#D03839] hover:underline">View Document</a>
                          </div>
                        </div>
                        <button onClick={handleRemoveContract} className="p-2 rounded hover:bg-[#E8E8E4] text-[#737370] transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Content Tab */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Property Description</label>
                {rejectionReason && parseRejectionReasons(rejectionReason).description && (
                  <div className="flex items-start gap-2.5 bg-[#FEF3F2] border border-[#FECDCA] rounded px-3 py-2.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B42318] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#B42318]"><span className="font-semibold">Issue:</span> {parseRejectionReasons(rejectionReason).description}</p>
                  </div>
                )}
                <TextEditor
                  ref={descRef}
                  id="description-editor"
                  content={formData.description || ''}
                  placeholder="Describe the property, its features, amenities, and unique selling points..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Repairs & Renovation</label>
                {rejectionReason && parseRejectionReasons(rejectionReason).repairs && (
                  <div className="flex items-start gap-2.5 bg-[#FEF3F2] border border-[#FECDCA] rounded px-3 py-2.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B42318] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#B42318]"><span className="font-semibold">Issue:</span> {parseRejectionReasons(rejectionReason).repairs}</p>
                  </div>
                )}
                <TextEditor
                  ref={repairsRef}
                  id="repairs-editor"
                  content={formData.repairs || ''}
                  placeholder="Detail any repairs needed, recent renovations, or planned improvements..."
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1A1816] mb-1">Inspection Report <span className="text-[#A8A8A4] font-normal">(optional)</span></label>
                {rejectionReason && parseRejectionReasons(rejectionReason).inspection && (
                  <div className="flex items-start gap-2.5 bg-[#FEF3F2] border border-[#FECDCA] rounded px-3 py-2.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B42318] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#B42318]"><span className="font-semibold">Issue:</span> {parseRejectionReasons(rejectionReason).inspection}</p>
                  </div>
                )}
                <p className="text-[12px] text-[#737370] mb-3">Upload the inspection report for this property (PDF or DOC)</p>
                {!inspectionReport.url ? (
                  <div className="border border-dashed border-[#E8E8E4] rounded p-6 text-center">
                    <Upload className="w-8 h-8 text-[#A8A8A4] mx-auto mb-3" />
                    <p className="text-[13px] text-[#737370] mb-3">PDF or DOC file</p>
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
                      className={`inline-flex items-center gap-2 px-4 py-2 bg-[#D03839] hover:bg-[#B82F30] text-white rounded text-[13px] font-medium transition-colors cursor-pointer ${
                        inspectionReport.uploading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {inspectionReport.uploading ? 'Uploading...' : 'Choose File'}
                    </label>
                  </div>
                ) : (
                  <div className="bg-[#FAFAF8] border border-[#E8E8E4] rounded p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#D03839]/10 rounded flex items-center justify-center">
                          <Upload className="w-4 h-4 text-[#D03839]" />
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-[#1A1816]">Inspection Report</p>
                          <a href={inspectionReport.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#D03839] hover:underline">View Document</a>
                        </div>
                      </div>
                      <button onClick={handleRemoveInspection} className="p-2 rounded hover:bg-[#E8E8E4] text-[#737370] transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
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
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                      placeholder="Same as SEO title"
                      maxLength="60"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Social Description</label>
                    <textarea
                      value={formData.social_description || ''}
                      onChange={(e) => handleInputChange('social_description', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                      className="w-full px-4 py-3 border-2 border-neutral-200 rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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

        </div>
      </div>
        )
      })()}
    </div>
  );
}

