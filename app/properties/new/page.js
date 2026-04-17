"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Save, Eye, ArrowLeft, Upload, X, AlertCircle, Home, FileText, Zap, Star, TrendingUp, Package, Check, Lock, ChevronRight } from 'lucide-react';
import ImageGalleryManager from '@/components/properties/ImageGalleryManager';
import TextEditor from '@/components/forms/TextEditor';
import GooglePlacesAutocomplete from '@/components/forms/GooglePlacesAutocomplete';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

const ADD_ONS = [
  { id: 'highlight', label: 'Highlight Listing', desc: 'Pin to top of search results and show a highlighted badge', price: 999, icon: Star },
  { id: 'boost',     label: 'Boost Listing',     desc: 'Promote your deal to more buyers across the platform',    price: 1499, icon: TrendingUp },
  { id: 'homepage',  label: 'Feature on Homepage', desc: 'Get your deal in the Featured section on the homepage', price: 2900, icon: Zap },
  { id: 'bundle',    label: 'Visibility Bundle',  desc: 'Highlight + Boost together at a 20% discount',            price: 2200, icon: Package },
]

const PROPERTY_STATUSES = [
  { value: 'available', label: 'Available - Ready for sale' },
  { value: 'pending', label: 'Pending - Under contract' },
  { value: 'sold', label: 'Sold - Transaction complete' },
  { value: 'under_contract', label: 'Under Contract - In negotiation' }
];

// Main property types for real estate (buying/selling)
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

export default function NewPropertyPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [continuedTabs, setContinuedTabs] = useState(new Set());
  const [showAllPreviewImages, setShowAllPreviewImages] = useState(false);
  const [userId, setUserId] = useState(null);
  const [trialPlan, setTrialPlan] = useState(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState(null);
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [addOnClientSecret, setAddOnClientSecret] = useState(null);
  const [addOnLoading, setAddOnLoading] = useState(false);
  const [addOnError, setAddOnError] = useState(null);
  const [pendingPublishData, setPendingPublishData] = useState(null);

  const descRef = useRef(null);
  const repairsRef = useRef(null);

  const [formData, setFormData] = useState({
    status: 'draft',
    property_status: 'available',
    property_type: ''
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

  const [sellerType, setSellerType] = useState('');
  const [contractUpload, setContractUpload] = useState({
    url: null,
    key: null,
    filename: null,
    uploading: false
  });
  const [featuredImageModal, setFeaturedImageModal] = useState({
    open: false,
    publishStatus: 'draft',
    imageCount: 0
  });

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
      // Fetch plan to check trial/subscription status
      supabase
        .from('seller_plans')
        .select('status, plan_type, billing_cycle, listings_used_this_period, trial_ends_at, current_period_end')
        .eq('seller_id', user.id)
        .maybeSingle()
        .then(({ data }) => { if (data) setTrialPlan(data) });
    }
  }, []);

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

  const buildSeoDefaults = (data) => {
    const addr = data.location || '';
    const beds = data.bedrooms ? `${data.bedrooms} bed` : '';
    const baths = data.bathrooms ? `${data.bathrooms} bath` : '';
    const type = data.property_type || '';
    const price = data.price ? `$${Number(data.price).toLocaleString()}` : '';
    const parts = [beds, baths, type].filter(Boolean).join(', ');
    const title = addr ? addr.slice(0, 60) : '';
    const rawDesc = [
      addr ? `${type || 'Property'} for sale at ${addr}.` : '',
      parts ? `${parts}.` : '',
      price ? `Asking ${price}.` : '',
      'Contact seller for more details on this wholesale deal.'
    ].filter(Boolean).join(' ');
    const desc = rawDesc.length <= 160 ? rawDesc : rawDesc.slice(0, 160).replace(/\s+\S*$/, '');
    return { title, desc };
  };

  const TAB_ORDER = ['basic', 'images', 'ownership', 'content', 'seo', 'addons'];

  // ── Step completion ──────────────────────────────────────────────────────────
  const isBasicComplete = !!(formData.location && formData.price && formData.property_type && formData.bedrooms && formData.bathrooms && formData.floor_area);
  const isImagesComplete = imageUploadStatus.images.filter(img => img.status === 'completed').length > 0 && !imageUploadStatus.isUploading;
  const isOwnershipComplete = !!(sellerType && (sellerType !== 'wholesaler' || contractUpload.url));

  const isTabAccessible = (tabId) => {
    const idx = TAB_ORDER.indexOf(tabId);
    if (idx <= 0) return true;
    if (!isBasicComplete) return false;
    if (idx <= 1) return true;
    if (!isImagesComplete) return false;
    if (idx <= 2) return true;
    if (!isOwnershipComplete) return false;
    return true;
  };

  const isTabComplete = (tabId) => {
    if (tabId === 'basic') return isBasicComplete;
    if (tabId === 'images') return isImagesComplete;
    if (tabId === 'ownership') return isOwnershipComplete;
    if (tabId === 'content') return continuedTabs.has('content');
    if (tabId === 'seo') return continuedTabs.has('seo');
    if (tabId === 'addons') return continuedTabs.has('addons');
    return false;
  };

  const handleTabChange = (tabId) => {
    if (!isTabAccessible(tabId)) return;
    if (descRef.current) {
      const cleanDescription = descRef.current.getCleanHTML?.() || descRef.current.getHTML?.() || '';
      setFormData(prev => ({ ...prev, description: cleanDescription }));
    }
    if (repairsRef.current) {
      const cleanRepairs = repairsRef.current.getCleanHTML?.() || repairsRef.current.getHTML?.() || '';
      setFormData(prev => ({ ...prev, repairs: cleanRepairs }));
    }
    setError(null);
    // Auto-fill SEO fields when entering the SEO tab for the first time
    if (tabId === 'seo') {
      setFormData(prev => {
        const { title, desc } = buildSeoDefaults(prev);
        return {
          ...prev,
          seo_title: prev.seo_title || title,
          seo_description: prev.seo_description || desc,
          social_title: prev.social_title || title,
          social_description: prev.social_description || desc,
        };
      });
    }
    setActiveTab(tabId);
  };

  const handleContinue = () => {
    // Validate required fields before advancing
    if (activeTab === 'basic') {
      if (!formData.location)      { setError('Please enter the property location.'); return; }
      if (!formData.price)         { setError('Please enter the property price.'); return; }
      if (!formData.property_type) { setError('Please select a property type.'); return; }
      if (!formData.bedrooms)      { setError('Please enter the number of bedrooms.'); return; }
      if (!formData.bathrooms)     { setError('Please enter the number of bathrooms.'); return; }
      if (!formData.floor_area)    { setError('Please enter the floor area.'); return; }
    }
    setError(null);
    setContinuedTabs(prev => new Set([...prev, activeTab]));
    const nextTab = TAB_ORDER[TAB_ORDER.indexOf(activeTab) + 1];
    if (nextTab) handleTabChange(nextTab);
  };

  const handleSave = async (publishStatus = 'draft', options = {}) => {
    const { skipFeaturedPrompt = false, forceAutoSelectFeatured = false, addOnFlags = null, bypassLimit = false, addonPaymentIntentId = null } = options;

    if (!bypassLimit) {
      // Block publishing if subscription has ended
      if (publishStatus === 'active' && trialPlan?.status === 'canceled') {
        setError('Your subscription has ended. Please renew your subscription on the Plans page to publish listings.');
        return;
      }

      // Block publishing if payment is overdue
      if (publishStatus === 'active' && trialPlan?.status === 'past_due') {
        setError('Your payment is overdue. Please update your payment method on the Billing page to publish listings.');
        return;
      }

      // Trial limit: only 1 published listing allowed during free trial
      if (publishStatus === 'active' && trialPlan?.status === 'trialing') {
        if ((trialPlan.listings_used_this_period ?? 0) >= 1) {
          setShowUpgradePrompt(true);
          return;
        }
      }
      // Pro plan: max 10 listings per billing period
      if (publishStatus === 'active' && trialPlan?.plan_type === 'pro' && trialPlan?.status === 'active') {
        if ((trialPlan.listings_used_this_period ?? 0) >= 10) {
          setShowUpgradePrompt(true);
          return;
        }
      }
    }

    if (!formData.location) {
      setError('Please fill in the property address.');
      setActiveTab('basic');
      return;
    }

    if (publishStatus === 'active' && !formData.price) {
      setError('Please enter the asking price.');
      setActiveTab('basic');
      return;
    }

    if (publishStatus === 'active' && !formData.property_type) {
      setError('Please select a property type.');
      setActiveTab('basic');
      return;
    }

    if (publishStatus === 'active' && !formData.bedrooms) {
      setError('Please enter the number of beds.');
      setActiveTab('basic');
      return;
    }

    if (publishStatus === 'active' && !formData.bathrooms) {
      setError('Please enter the number of baths.');
      setActiveTab('basic');
      return;
    }

    if (publishStatus === 'active' && !formData.floor_area) {
      setError('Please enter the floor area.');
      setActiveTab('basic');
      return;
    }

    if (publishStatus === 'active') {
      const completed = imageUploadStatus.images.filter(img => img.status === 'completed');
      if (completed.length === 0) {
        setError('Please upload at least one image.');
        setActiveTab('images');
        return;
      }
    }

    if (publishStatus === 'active' && !sellerType) {
      setError('Please select your relationship to this property in the Ownership tab.');
      setActiveTab('ownership');
      return;
    }

    if (publishStatus === 'active' && sellerType === 'wholesaler' && !contractUpload.url) {
      setError('A signed contract is required for wholesaler listings. Please upload it in the Ownership tab.');
      setActiveTab('ownership');
      return;
    }

    if (imageUploadStatus.isUploading) {
      setError(`Please wait for ${imageUploadStatus.uploadingCount} image${imageUploadStatus.uploadingCount > 1 ? 's' : ''} to finish uploading.`);
      return;
    }

    const completedImages = imageUploadStatus.images.filter(
      (img) => img.status === 'completed' && img.imageUrl
    );
    let completedImagesForSave = completedImages;
    const hasFeaturedImage = completedImages.some((img) => !!img.isFeatured);

    if (completedImages.length > 0 && !hasFeaturedImage && !skipFeaturedPrompt) {
      setFeaturedImageModal({
        open: true,
        publishStatus,
        imageCount: completedImages.length
      });
      return;
    }

    if (completedImages.length > 0 && !hasFeaturedImage && forceAutoSelectFeatured) {
      const firstCompletedId = completedImages[0].id;
      completedImagesForSave = completedImages.map((img, index) => ({
        ...img,
        isFeatured: index === 0
      }));

      setImageUploadStatus((prev) => ({
        ...prev,
        images: prev.images.map((img) =>
          img.status === 'completed'
            ? { ...img, isFeatured: img.id === firstCompletedId }
            : img
        )
      }));
    }

    // Resolve seller id at submit time (state may not be set yet); required to link property to seller
    let sellerId = userId;
    if (sellerId == null) {
      try {
        const userStr = localStorage.getItem('seller_user');
        if (userStr) {
          const user = JSON.parse(userStr);
          sellerId = user?.id ?? null;
        }
      } catch (_) {}
    }
    if (sellerId == null) {
      setError('You must be logged in to add a property. Please refresh and try again.');
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

    // Short unique slug: 7 alphabets + 2 numerics (e.g. kxmnpqr29) — more readable, less numeric
    const alpha = 'abcdefghjkmnpqrstuvwxyz';
    const nums = '23456789';
    const part1 = Array.from({ length: 7 }, () => alpha[Math.floor(Math.random() * alpha.length)]).join('');
    const part2 = Array.from({ length: 2 }, () => nums[Math.floor(Math.random() * nums.length)]).join('');
    const shortSlug = part1 + part2;

    // Create save data object matching the actual database schema
    // When publishing, set under_review so AI moderation can run first
    const actualStatus = publishStatus === 'active' ? 'under_review' : publishStatus;
    const saveData = {
      seller_id: sellerId,
      status: actualStatus,
      slug: shortSlug,
      address: formData.location || '', // 'location' in form maps to 'address' in DB
      property_status: formData.property_status || 'available',
      property_type: formData.property_type || null,
      description: formData.description || '',
      repairs: formData.repairs || ''
    };

    // Add numeric fields
    if (formData.price) saveData.price = parseFloat(formData.price);
    if (formData.bedrooms) saveData.bedrooms = parseInt(formData.bedrooms);
    if (formData.bathrooms) saveData.bathrooms = parseFloat(formData.bathrooms);
    if (formData.floor_area) saveData.floor_area = parseInt(formData.floor_area);

    // Add location coordinates and parsed fields from Google Places
    if (formData.latitude) saveData.latitude = formData.latitude;
    if (formData.longitude) saveData.longitude = formData.longitude;
    if (formData.state) saveData.state = formData.state;
    if (formData.city) saveData.city = formData.city;
    if (formData.zipcode) saveData.zipcode = formData.zipcode;

    // Add SEO fields (using correct column names from schema)
    saveData.seo_title = formData.seo_title || formData.meta_title || formData.location || '';
    if (formData.meta_description) saveData.seo_description = formData.meta_description;
    if (formData.social_share_image) saveData.social_image_url = formData.social_share_image;

    // Add inspection report if provided
    if (inspectionReport.url) saveData.inspection_report_url = inspectionReport.url;
    if (inspectionReport.key) saveData.inspection_report_key = inspectionReport.key;

    // Add ownership info
    if (sellerType) saveData.seller_type = sellerType;
    if (contractUpload.url) saveData.contract_url = contractUpload.url;

    console.log('Saving property with data:', saveData);

    try {
      // Create property
      const { data, error: saveErr } = await supabase
        .from('properties')
        .insert([saveData])
        .select()
        .single();

      if (saveErr) throw saveErr;

      // Save images to database
      if (completedImagesForSave.length > 0) {
        const orderedImages = [...completedImagesForSave].sort((a, b) => {
          const aFeatured = a.isFeatured ? 1 : 0;
          const bFeatured = b.isFeatured ? 1 : 0;
          return bFeatured - aFeatured;
        });

        if (orderedImages.length > 0) {
          const imageRecords = orderedImages.map((img, index) => ({
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

      // Increment listing counter on publish (trial OR active pro)
      const shouldIncrementCounter = publishStatus === 'active' && (
        trialPlan?.status === 'trialing' ||
        (trialPlan?.plan_type === 'pro' && trialPlan?.status === 'active')
      );
      if (shouldIncrementCounter) {
        await supabase
          .from('seller_plans')
          .update({ listings_used_this_period: (trialPlan.listings_used_this_period ?? 0) + 1 })
          .eq('seller_id', sellerId);
        setTrialPlan(prev => prev ? { ...prev, listings_used_this_period: (prev.listings_used_this_period ?? 0) + 1 } : prev);
      }

      // Apply add-on flags if paid — use addOnFlags from options directly (not state,
      // which is async and would still be stale at this point in the same call)
      if (publishStatus === 'active' && addOnFlags && Object.keys(addOnFlags).length > 0) {
        const now = new Date()
        const ms  = (d) => d * 24 * 60 * 60 * 1000

        // Include expiry timestamps alongside the boolean flags
        const flagsWithExpiry = { ...addOnFlags }
        if (addOnFlags.is_highlighted)      flagsWithExpiry.highlight_ends_at          = new Date(now.getTime() + ms(30)).toISOString()
        if (addOnFlags.is_boosted)          flagsWithExpiry.boost_ends_at              = new Date(now.getTime() + ms(7)).toISOString()
        if (addOnFlags.is_homepage_featured) flagsWithExpiry.homepage_feature_ends_at  = new Date(now.getTime() + ms(7)).toISOString()

        await supabase
          .from('properties')
          .update(flagsWithExpiry)
          .eq('id', data.id)
          .eq('seller_id', sellerId);

        // Record each add-on in listing_addons via server route (uses service role key)
        fetch('/api/seller/listing-addons/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seller_id: sellerId, property_id: data.id, add_ons: selectedAddOns, stripe_payment_intent_id: addonPaymentIntentId }),
        }).catch(() => {})
      }

      // Kick off AI moderation in background for published listings
      if (publishStatus === 'active') {
        fetch('/api/seller/moderate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: data.id }),
        }).catch(() => {});
      }

      setSuccess(
        publishStatus === 'active'
          ? 'Property submitted for review! You\'ll be notified when it\'s approved.'
          : 'Property saved as draft!'
      );

      setTimeout(() => {
        router.push('/properties');
      }, 1500);

    } catch (err) {
      console.error('Save failed:', err);
      setError(err?.message || 'Failed to save property. Please try again.');
      setSaving(false);
    }
  };

  const handleFeaturedModalSelectManually = () => {
    setFeaturedImageModal((prev) => ({ ...prev, open: false }));
    setActiveTab('images');
    setError('Please select a featured image in the Images tab before continuing.');
  };

  const handleFeaturedModalAutoSelect = () => {
    const publishStatus = featuredImageModal.publishStatus || 'draft';
    setFeaturedImageModal((prev) => ({ ...prev, open: false }));
    handleSave(publishStatus, { skipFeaturedPrompt: true, forceAutoSelectFeatured: true });
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

      const { data, error: uploadError } = await supabase.storage
        .from('scraperpropertyphotos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('scraperpropertyphotos')
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
          .from('scraperpropertyphotos')
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
      const fileName = `contracts/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('scraperpropertyphotos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('scraperpropertyphotos')
        .getPublicUrl(fileName);

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
        await supabase.storage.from('scraperpropertyphotos').remove([contractUpload.key]);
      } catch (err) {
        console.error('Failed to delete contract:', err);
      }
    }
    setContractUpload({ url: null, key: null, filename: null, uploading: false });
  };

  return (
    <div className="space-y-3 md:space-y-4" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>

      {/* Trial banner */}
      {trialPlan?.status === 'trialing' && (trialPlan.listings_used_this_period ?? 0) < 1 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#FEF3E2] border border-[#F3C97D] rounded text-[13px] text-[#B5620A]">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>During your free trial, your listing will only be live for 7 days.</span>
        </div>
      )}

      {/* Upgrade modal — end trial early and publish */}
      {showUpgradePrompt && (() => {
        const planLabel = trialPlan?.plan_type === 'enterprise' ? 'Enterprise' : 'Pro Seller';
        const planPrice = trialPlan?.plan_type === 'enterprise'
          ? (trialPlan?.billing_cycle === 'annual' ? '$239/mo' : '$299/mo')
          : (trialPlan?.billing_cycle === 'annual' ? '$79/mo' : '$99/mo');
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-[#1A1816]">Start your subscription</h3>
                <button onClick={() => { setShowUpgradePrompt(false); setUpgradeError(null); }} className="p-1.5 rounded hover:bg-[#F0F0EE] transition-colors">
                  <X size={16} className="text-[#737370]" />
                </button>
              </div>
              <p className="text-[13px] text-[#737370]">
                Your free trial allows 1 published listing. To publish more, your trial will end now and your <strong>{planLabel}</strong> subscription ({planPrice}) will begin immediately.{selectedAddOns.length > 0 ? ' You\'ll then be taken back to complete your add-on payment.' : ''}
              </p>
              <div className="bg-[#FAFAF8] border border-[#E8E8E4] rounded p-3 flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#1A1816]">{planLabel}</span>
                <span className="text-[13px] font-bold text-[#1A1816]">{planPrice}</span>
              </div>
              {upgradeError && <p className="text-[12px] text-red-600">{upgradeError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowUpgradePrompt(false); setUpgradeError(null); }}
                  className="flex-1 h-[40px] border border-[#E8E8E4] rounded text-[13px] font-medium text-[#1A1816] hover:border-[#1A1816] transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={upgradeLoading}
                  onClick={async () => {
                    setUpgradeLoading(true);
                    setUpgradeError(null);
                    try {
                      const res = await fetch('/api/seller/plan/end-trial', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ seller_id: userId }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed to start subscription');
                      setTrialPlan(prev => ({ ...prev, status: 'active', listings_used_this_period: 0 }));
                      setShowUpgradePrompt(false);
                      if (selectedAddOns.length > 0) {
                        // Reset any stale PaymentIntent — a fresh one will be created on the add-ons tab
                        setAddOnClientSecret(null);
                        setAddOnError(null);
                        setActiveTab('addons');
                      } else {
                        handleSave('active', { bypassLimit: true });
                      }
                    } catch (err) {
                      setUpgradeError(err.message);
                    } finally {
                      setUpgradeLoading(false);
                    }
                  }}
                  className="flex-1 h-[40px] bg-[#D03839] hover:bg-[#E0493B] rounded text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
                >
                  {upgradeLoading ? 'Processing…' : 'Confirm & Publish'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded hover:bg-[#F0F0EE] transition-colors"
          >
            <ArrowLeft size={20} className="text-[#737370]" />
          </button>
          <div>
            <h1 className="text-[18px] md:text-[20px] font-bold tracking-[-0.4px] text-[#1A1816]">Post a Deal</h1>
            <p className="text-[12px] text-[#737370] mt-0.5">Create a new wholesale property listing</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleSave('draft')}
          disabled={saving || imageUploadStatus.isUploading}
          className="flex items-center justify-center gap-2 bg-[#FAFAF8] hover:bg-[#E8E8E4] text-[#1A1816] px-3 py-2 rounded text-[13px] font-medium border border-[#E8E8E4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={16} />
          <span>
            {imageUploadStatus.isUploading
              ? `Uploading ${imageUploadStatus.uploadingCount}...`
              : saving ? 'Saving…' : 'Save Draft'
            }
          </span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-3 p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[#D03839]">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[13px] font-medium">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-[#D03839]/60 hover:text-[#D03839]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-3 bg-[#E4F5EC] border border-[#A8DFBA] rounded text-[#0F6E56]">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[13px] font-medium">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-[#0F6E56]/60 hover:text-[#0F6E56]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {featuredImageModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#E8E8E4] rounded shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E8E8E4] bg-[#FAFAF8]">
              <h3 className="text-[15px] font-semibold text-[#1A1816]">Select featured image</h3>
              <p className="text-[12px] text-[#737370] mt-1">
                Your listing has {featuredImageModal.imageCount} uploaded image{featuredImageModal.imageCount > 1 ? 's' : ''} but no featured one selected.
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[13px] text-[#1A1816] leading-6">
                Featured image is used as the main thumbnail on listings. You can choose one manually, or continue and automatically use the first uploaded image.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-[#E8E8E4] bg-white flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleFeaturedModalSelectManually}
                className="px-3.5 py-2 text-[13px] font-medium rounded border border-[#E8E8E4] text-[#1A1816] hover:bg-[#FAFAF8] transition-colors"
              >
                Select manually
              </button>
              <button
                type="button"
                onClick={handleFeaturedModalAutoSelect}
                className="px-3.5 py-2 text-[13px] font-medium rounded bg-[#D03839] text-white hover:bg-[#E0493B] transition-colors"
              >
                Use first image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Warning */}
      {imageUploadStatus.isUploading && (
        <div className="flex items-start gap-3 p-4 bg-[#EBF3FC] border border-[#B3D4F5] rounded">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#4A90E2]"></div>
          <div>
            <h4 className="font-medium text-[#1A1816] mb-1 text-[13px]">Uploading Images</h4>
            <p className="text-[13px] text-[#737370]">
              Please wait for {imageUploadStatus.uploadingCount} image{imageUploadStatus.uploadingCount > 1 ? 's' : ''} to finish uploading before publishing.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded border border-[#E8E8E4] overflow-hidden">
        {/* Step indicator */}
        <div className="flex border-b border-[#E8E8E4]">
          {[
            { id: 'basic',     label: 'Basic Info' },
            { id: 'images',    label: 'Images' },
            { id: 'ownership', label: 'Ownership' },
            { id: 'content',   label: 'Content' },
            { id: 'seo',       label: 'SEO & Social' },
            { id: 'addons',    label: 'Add-Ons' },
          ].map((tab, idx) => {
            const accessible = isTabAccessible(tab.id);
            const complete   = isTabComplete(tab.id);
            const active     = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => accessible && handleTabChange(tab.id)}
                disabled={!accessible}
                className={`flex-1 flex items-center justify-center gap-1.5 px-1 md:px-5 py-3.5 text-[12px] font-medium transition-colors border-b-2
                  ${active    ? 'border-[#D03839] text-[#D03839] bg-[#FEF0EF]/30'
                  : complete  ? 'border-transparent text-[#0F6E56] hover:bg-[#FAFAF8]'
                  : accessible ? 'border-transparent text-[#737370] hover:text-[#1A1816] hover:bg-[#FAFAF8]'
                  : 'border-transparent text-[#C4C4C0] cursor-not-allowed'}`}
              >
                <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                  ${active    ? 'bg-[#D03839] text-white'
                  : complete  ? 'bg-[#0F6E56] text-white'
                  : accessible ? 'bg-[#E8E8E4] text-[#737370]'
                  : 'bg-[#F0F0EE] text-[#C4C4C0]'}`}
                >
                  {complete ? <Check className="w-2.5 h-2.5" /> : !accessible ? <Lock className="w-2.5 h-2.5" /> : idx + 1}
                </span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Location *</label>
                <GooglePlacesAutocomplete
                  onAddressSelect={handleAddressSelect}
                  defaultValue={formData.location || ''}
                />
                <p className="text-[12px] text-[#737370] mt-1">
                  Start typing to search for an address
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Price ($) *</label>
                  <input
                    type="number"
                    value={formData.price || ''}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    className="w-full px-4 py-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:outline-none transition-colors text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4]"
                    placeholder="2500000"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Property Type *</label>
                  <select
                    value={formData.property_type ?? ''}
                    onChange={(e) => handleInputChange('property_type', e.target.value)}
                    className="w-full px-4 py-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:outline-none transition-colors text-[13px] text-[#1A1816]"
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
                  <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Beds *</label>
                  <input
                    type="number"
                    value={formData.bedrooms || ''}
                    onChange={(e) => handleInputChange('bedrooms', e.target.value)}
                    className="w-full px-4 py-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:outline-none transition-colors text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4]"
                    placeholder="50"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Baths *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.bathrooms || ''}
                    onChange={(e) => handleInputChange('bathrooms', e.target.value)}
                    className="w-full px-4 py-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:outline-none transition-colors text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4]"
                    placeholder="50"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Floor Area (sqft) *</label>
                  <input
                    type="number"
                    value={formData.floor_area || ''}
                    onChange={(e) => handleInputChange('floor_area', e.target.value)}
                    className="w-full px-4 py-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:outline-none transition-colors text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4]"
                    placeholder="25000"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Property Status</label>
                <select
                  value={formData.property_status || 'available'}
                  onChange={(e) => handleInputChange('property_status', e.target.value)}
                  className="w-full px-4 py-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:outline-none transition-colors text-[13px] text-[#1A1816]"
                >
                  {PROPERTY_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>

              {/* Featured Image Preview */}
              {imageUploadStatus.images.length > 0 && (
                <div>
                  <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Featured Image</label>
                  <div className="border border-[#E8E8E4] rounded p-4 bg-[#FAFAF8]">
                    {imageUploadStatus.images.some(img => img.status === 'completed' && img.isFeatured) ? (
                      <div className="flex items-center gap-4">
                        <img
                          src={imageUploadStatus.images.find(img => img.status === 'completed' && img.isFeatured)?.imageUrl}
                          alt="Featured"
                          className="w-24 h-24 object-cover rounded"
                        />
                        <div>
                          <p className="text-[13px] font-medium text-[#1A1816] mb-1">Featured image selected</p>
                          <p className="text-[12px] text-[#737370]">You can change or clear this in the Images tab</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-[13px] text-[#737370]">Select a featured image in the Images tab</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Images Tab */}
          <div className={activeTab === 'images' ? '' : 'hidden'}>
            <h3 className="text-[15px] font-semibold text-[#1A1816] mb-2">Property Images</h3>
            <p className="text-[13px] text-[#737370] mb-6">
              Upload property images. They will be automatically compressed and uploaded immediately. The first image will be set as the featured image.
            </p>
            <ImageGalleryManager
              images={imageUploadStatus.images}
              onImagesChange={handleImagesChange}
              sellerId={userId}
              storageBucket="scraperpropertyphotos"
              uploadPathPrefix="manual"
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
                  <h3 className="text-[15px] font-semibold text-[#1A1816] mb-1">
                    Assignment Contract <span className="text-[#D03839]">*</span>
                  </h3>
                  <p className="text-[13px] text-[#737370] mb-4">
                    Upload your signed assignment contract. Required before publishing. (PDF or DOC)
                  </p>

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
                        className={`inline-flex items-center gap-2 px-4 py-2 bg-[#D03839] hover:bg-[#E0493B] text-white rounded text-[13px] font-medium transition-colors cursor-pointer ${
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
                            <a
                              href={contractUpload.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[12px] text-[#D03839] hover:underline"
                            >
                              View Document
                            </a>
                          </div>
                        </div>
                        <button
                          onClick={handleRemoveContract}
                          className="p-2 rounded hover:bg-[#E8E8E4] text-[#737370] transition-colors"
                        >
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
                <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Property Description</label>
                <TextEditor
                  ref={descRef}
                  id="description-editor"
                  content={formData.description || ''}
                  placeholder="Describe the property, its features, amenities, and unique selling points..."
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1A1816] mb-1">Repairs & Renovation <span className="text-[#A8A8A4] font-normal">(optional)</span></label>
                <TextEditor
                  ref={repairsRef}
                  id="repairs-editor"
                  content={formData.repairs || ''}
                  placeholder="Detail any repairs needed, recent renovations, or planned improvements..."
                />
              </div>

              {/* Inspection Report (optional) */}
              <div>
                <label className="block text-[13px] font-semibold text-[#1A1816] mb-1">Inspection Report <span className="text-[#A8A8A4] font-normal">(optional)</span></label>
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
                      className={`inline-flex items-center gap-2 px-4 py-2 bg-[#D03839] hover:bg-[#E0493B] text-white rounded text-[13px] font-medium transition-colors cursor-pointer ${
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
                          <a href={inspectionReport.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#D03839] hover:underline">
                            View Document
                          </a>
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
                <h3 className="text-[15px] font-semibold text-[#1A1816] mb-4">Search Engine Optimization</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">SEO Title</label>
                    <input
                      type="text"
                      value={formData.seo_title || ''}
                      onChange={(e) => handleInputChange('seo_title', e.target.value)}
                      className="w-full px-4 py-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:outline-none transition-colors text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4]"
                      placeholder="Luxury Beachfront Hotel Investment Opportunity"
                      maxLength="60"
                    />
                    <div className="text-[12px] text-[#737370] mt-1">
                      {(formData.seo_title || '').length}/60 characters
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">SEO Description</label>
                    <textarea
                      value={formData.seo_description || ''}
                      onChange={(e) => handleInputChange('seo_description', e.target.value)}
                      className="w-full px-4 py-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:outline-none transition-colors text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4]"
                      rows="3"
                      placeholder="Discover this stunning wholesale hotel property..."
                      maxLength="160"
                    />
                    <div className="text-[12px] text-[#737370] mt-1">
                      {(formData.seo_description || '').length}/160 characters
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[15px] font-semibold text-[#1A1816] mb-4">Social Media</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Social Title</label>
                    <input
                      type="text"
                      value={formData.social_title || ''}
                      onChange={(e) => handleInputChange('social_title', e.target.value)}
                      className="w-full px-4 py-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:outline-none transition-colors text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4]"
                      placeholder="Same as SEO title"
                      maxLength="60"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Social Description</label>
                    <textarea
                      value={formData.social_description || ''}
                      onChange={(e) => handleInputChange('social_description', e.target.value)}
                      className="w-full px-4 py-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:outline-none transition-colors text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4]"
                      rows="3"
                      placeholder="Same as SEO description"
                      maxLength="160"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-[#1A1816] mb-2">Social Image URL</label>
                    <input
                      type="url"
                      value={formData.social_image_url || ''}
                      onChange={(e) => handleInputChange('social_image_url', e.target.value)}
                      className="w-full px-4 py-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:outline-none transition-colors text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4]"
                      placeholder="https://example.com/image.jpg"
                    />
                    <div className="text-[12px] text-[#737370] mt-1">
                      Leave empty to use first uploaded image
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add-Ons Tab */}
          {activeTab === 'addons' && (
            <AddOnsTab
              selectedAddOns={selectedAddOns}
              setSelectedAddOns={setSelectedAddOns}
              addOnClientSecret={addOnClientSecret}
              setAddOnClientSecret={setAddOnClientSecret}
              addOnLoading={addOnLoading}
              setAddOnLoading={setAddOnLoading}
              addOnError={addOnError}
              setAddOnError={setAddOnError}
              pendingPublishData={pendingPublishData}
              setPendingPublishData={setPendingPublishData}
              userId={userId}
              onPublish={handleSave}
              saving={saving}
              onBack={() => handleTabChange('seo')}
              formData={formData}
              images={imageUploadStatus.images}
              trialPlan={trialPlan}
              onShowUpgradePrompt={() => setShowUpgradePrompt(true)}
            />
          )}

          {/* ── Step footer ──────────────────────────────────────────────── */}
          {activeTab !== 'addons' && (
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-[#E8E8E4]">
              <button
                type="button"
                onClick={() => {
                  const prevIdx = TAB_ORDER.indexOf(activeTab) - 1;
                  if (prevIdx >= 0) handleTabChange(TAB_ORDER[prevIdx]);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded border border-[#E8E8E4] text-[13px] font-medium text-[#737370] hover:border-[#1A1816] hover:text-[#1A1816] transition-colors ${activeTab === 'basic' ? 'invisible' : ''}`}
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Add-Ons Checkout Form (Stripe) ──────────────────────────────────────────
function AddOnsCheckoutForm({ amount, onSuccess, onError, onBack }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = React.useState(false)

  const handlePay = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    const { error: submitErr } = await elements.submit()
    if (submitErr) { onError(submitErr.message); setProcessing(false); return }
    const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })
    if (confirmErr) {
      onError(confirmErr.message)
    } else {
      onSuccess(paymentIntent?.id || null)
    }
    setProcessing(false)
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full h-[46px] bg-[#D03839] hover:bg-[#E0493B] active:scale-[0.98] text-white text-[14px] font-semibold rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {processing
          ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Processing…</>
          : `Pay $${(amount / 100).toFixed(2)} & Publish`}
      </button>
      {onBack && (
        <button type="button" onClick={onBack} className="w-full text-[12px] text-[#737370] hover:text-[#1A1816] transition-colors text-center">
          ← Change add-ons
        </button>
      )}
    </form>
  )
}

// ─── Add-Ons Tab ──────────────────────────────────────────────────────────────
function AddOnsTab({
  selectedAddOns, setSelectedAddOns,
  addOnClientSecret, setAddOnClientSecret,
  addOnLoading, setAddOnLoading,
  addOnError, setAddOnError,
  userId, onPublish, saving, onBack,
  formData, images, trialPlan, onShowUpgradePrompt,
}) {
  const toggleAddOn = (id) => {
    setSelectedAddOns(prev => {
      if (prev.includes(id)) return prev.filter(a => a !== id)
      let next = [...prev, id]
      if (id === 'bundle') next = next.filter(a => a !== 'highlight' && a !== 'boost')
      if (id === 'highlight' || id === 'boost') next = next.filter(a => a !== 'bundle')
      return next
    })
    setAddOnClientSecret(null)
    setAddOnError(null)
  }

  const total = selectedAddOns.reduce((sum, id) => {
    const ao = ADD_ONS.find(a => a.id === id)
    return sum + (ao?.price || 0)
  }, 0)

  const handleInitPayment = async () => {
    if (!userId || selectedAddOns.length === 0) return

    // If trial limit exceeded, show upgrade prompt BEFORE taking any payment.
    // After the trial ends the user comes back here with status='active' and pays once.
    if (trialPlan?.status === 'trialing' && (trialPlan.listings_used_this_period ?? 0) >= 1) {
      onShowUpgradePrompt()
      return
    }

    setAddOnLoading(true)
    setAddOnError(null)
    try {
      const res = await fetch('/api/seller/listing-addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: userId, add_ons: selectedAddOns }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to initialize payment')
      setAddOnClientSecret(d.clientSecret)
    } catch (err) {
      setAddOnError(err.message)
    } finally {
      setAddOnLoading(false)
    }
  }

  const addOnFlags = {}
  if (selectedAddOns.includes('highlight') || selectedAddOns.includes('bundle')) addOnFlags.is_highlighted = true
  if (selectedAddOns.includes('boost') || selectedAddOns.includes('bundle')) addOnFlags.is_boosted = true
  if (selectedAddOns.includes('homepage')) addOnFlags.is_homepage_featured = true

  const featuredImage = (images || []).find(img => img.isFeatured && img.status === 'completed')
    || (images || []).find(img => img.status === 'completed')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

      {/* ── Left: add-on cards + payment form ── */}
      <div className="space-y-5">
        <div>
          <h3 className="text-[15px] font-semibold text-[#1A1816] mb-1">Boost your listing <span className="text-[13px] font-normal text-[#737370]">(optional)</span></h3>
          <p className="text-[13px] text-[#737370]">Add-ons are optional. Your listing will be published free with your subscription — these just get it more visibility.</p>
        </div>

        <div className="space-y-2.5">
          {ADD_ONS.map((ao) => {
            const selected = selectedAddOns.includes(ao.id)
            const Icon = ao.icon
            return (
              <button
                key={ao.id}
                type="button"
                onClick={() => toggleAddOn(ao.id)}
                className={`w-full flex items-center gap-3 p-4 border rounded text-left transition-all ${selected ? 'border-[#D03839] bg-[#FEF0EF]' : 'border-[#E8E8E4] hover:border-[#D4D4CF] bg-white'}`}
              >
                <div className={`w-9 h-9 rounded flex items-center justify-center flex-shrink-0 ${selected ? 'bg-[#D03839]' : 'bg-[#F3F3F0]'}`}>
                  <Icon className={`w-4 h-4 ${selected ? 'text-white' : 'text-[#737370]'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1A1816] leading-tight">{ao.label}</p>
                  <p className="text-[12px] text-[#737370]">{ao.desc}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[13px] font-bold text-[#1A1816]">+${(ao.price / 100).toFixed(2)}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-[#D03839] bg-[#D03839]' : 'border-[#D4D4CF]'}`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {addOnError && (
          <div className="p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[13px] text-[#D03839]">{addOnError}</div>
        )}

        {/* Payment form when client secret is ready */}
        {addOnClientSecret && stripePromise && (
          <div className="border border-[#E8E8E4] rounded p-5 bg-white">
            <p className="text-[14px] font-semibold text-[#1A1816] mb-1">Payment Details</p>
            <p className="text-[13px] text-[#737370] mb-5">
              Your card will be charged <span className="font-semibold text-[#1A1816]">${(total / 100).toFixed(2)}</span> upon publishing.
            </p>
            <Elements stripe={stripePromise} options={{ clientSecret: addOnClientSecret }}>
              <AddOnsCheckoutForm
                amount={total}
                onSuccess={(piId) => {
                  window.__addOnFlags = addOnFlags
                  onPublish('active', { skipFeaturedPrompt: true, forceAutoSelectFeatured: true, addOnFlags, addonPaymentIntentId: piId })
                }}
                onError={(msg) => setAddOnError(msg)}
                onBack={() => { setAddOnClientSecret(null); setAddOnError(null) }}
              />
            </Elements>
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-2 rounded border border-[#E8E8E4] text-[13px] font-medium text-[#737370] hover:border-[#1A1816] hover:text-[#1A1816] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>

      {/* ── Right: order summary ── */}
      <div className="border border-[#E8E8E4] rounded overflow-hidden bg-white flex flex-col">

        {/* Property preview */}
        <div className="p-4 bg-[#FAFAF8] border-b border-[#E8E8E4]">
          <p className="text-[10px] font-semibold text-[#A8A8A4] uppercase tracking-widest mb-3">Your Listing</p>
          <div className="flex items-center gap-3">
            {featuredImage?.imageUrl ? (
              <img src={featuredImage.imageUrl} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0 border border-[#E8E8E4]" />
            ) : (
              <div className="w-14 h-14 rounded bg-[#F3F3F0] flex-shrink-0 flex items-center justify-center border border-[#E8E8E4]">
                <Home className="w-6 h-6 text-[#A8A8A4]" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#1A1816] truncate leading-tight">{formData?.location || 'Untitled'}</p>
              {formData?.property_type && (
                <p className="text-[11px] text-[#737370] truncate mt-0.5">{formData.property_type}</p>
              )}
            </div>
          </div>
        </div>

        {/* Order lines */}
        <div className="p-4 flex-1">
          <p className="text-[10px] font-semibold text-[#A8A8A4] uppercase tracking-widest mb-3">Order Summary</p>
          {selectedAddOns.length === 0 ? (
            <p className="text-[12px] text-[#A8A8A4] italic">No add-ons selected — listing is free</p>
          ) : (
            <div className="space-y-2.5">
              {selectedAddOns.map(id => {
                const ao = ADD_ONS.find(a => a.id === id)
                if (!ao) return null
                return (
                  <div key={id} className="flex justify-between items-center">
                    <span className="text-[12px] text-[#444441]">{ao.label}</span>
                    <span className="text-[12px] font-medium text-[#1A1816]">+${(ao.price / 100).toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Total */}
        <div className="px-4 py-3 border-t border-[#E8E8E4]">
          <div className="flex justify-between items-baseline">
            <span className="text-[13px] font-semibold text-[#1A1816]">Total due today</span>
            <span className="text-[20px] font-bold text-[#1A1816]">${(total / 100).toFixed(2)}</span>
          </div>
          {total === 0 && (
            <p className="text-[11px] text-[#A8A8A4] mt-0.5">Included in your subscription</p>
          )}
        </div>

        {/* CTA — shown when no payment form open yet */}
        {!addOnClientSecret && (
          <div className="px-4 pb-4 space-y-3">
            {selectedAddOns.length > 0 ? (
              <button
                type="button"
                onClick={handleInitPayment}
                disabled={addOnLoading}
                className="w-full h-[44px] bg-[#D03839] hover:bg-[#E0493B] active:scale-[0.98] text-white text-[13px] font-semibold rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addOnLoading
                  ? <><span className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />Preparing…</>
                  : 'Proceed to Payment'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onPublish('active', { skipFeaturedPrompt: true, forceAutoSelectFeatured: true })}
                disabled={saving}
                className="w-full h-[44px] bg-[#D03839] hover:bg-[#E0493B] active:scale-[0.98] text-white text-[13px] font-semibold rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving
                  ? <><span className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />Publishing…</>
                  : <>Publish for Free <Eye className="w-4 h-4" /></>}
              </button>
            )}
            <div className="flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3 text-[#A8A8A4]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-[11px] text-[#A8A8A4]">Secured by Stripe</span>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
