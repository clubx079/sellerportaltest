'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, Tag, Calendar, Percent, BedDouble, Briefcase, Search, ChevronDown } from 'lucide-react';
import { getCurrentCurrencySymbol } from '@/lib/currency';

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

// Multi-select Component
const MultiSelect = ({ label, value, onChange, options, placeholder, getOptionLabel, getOptionValue }) => {
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

  const selectedOptions = options.filter(option => value.includes(getOptionValue(option)));

  const toggleOption = (optionValue) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <label className="block text-xs font-medium text-neutral-600 mb-1.5">{label}</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm bg-white cursor-pointer hover:border-neutral-300 transition-colors flex items-center justify-between min-h-[42px]"
      >
        <div className="flex-1 flex flex-wrap gap-1">
          {selectedOptions.length > 0 ? (
            selectedOptions.map(option => (
              <span key={getOptionValue(option)} className="inline-flex items-center px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-xs">
                {getOptionLabel(option)}
              </span>
            ))
          ) : (
            <span className="text-neutral-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
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
                    toggleOption(getOptionValue(option));
                  }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-neutral-100 transition-colors flex items-center gap-2 ${
                    value.includes(getOptionValue(option)) ? 'bg-neutral-50 font-medium' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={value.includes(getOptionValue(option))}
                    onChange={() => {}}
                    className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-[#472F97]"
                  />
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

const EditForm = ({ isOpen, onClose, onSuccess, coupon, roomTypes, paidServices, userId }) => {
  const [mounted, setMounted] = useState(false);
  const [currency, setCurrency] = useState('$');
  const [formData, setFormData] = useState({
    offer_title: '',
    coupon_code: '',
    coupon_type: '',
    coupon_value: '',
    coupon_period_start: '',
    coupon_period_end: '',
    include_room_type: [],
    exclude_room_type: [],
    paid_services: []
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrency(getCurrentCurrencySymbol());
    return () => setMounted(false);
  }, []);

  const couponTypeOptions = [
    { value: 'percentage', label: 'Percentage' },
    { value: 'fixed', label: 'Fixed Amount' }
  ];

  // Parse coupon period from PostgreSQL DATERANGE format
  // DATERANGE returns: ["2024-01-01","2024-12-31") or [2024-01-01,2024-12-31)
  const parseCouponPeriod = (dateRange) => {
    if (!dateRange) return { start: '', end: '' };

    // Match various DATERANGE formats with or without quotes
    const matches = dateRange.match(/[\[\(]["']?([^"',\[\]()]+)["']?\s*,\s*["']?([^"',\[\]()]+)["']?[\]\)]/);

    if (matches) {
      // Clean the date strings - remove quotes and get just the date part (YYYY-MM-DD)
      const start = matches[1].replace(/"/g, '').trim().substring(0, 10);
      const end = matches[2].replace(/"/g, '').trim().substring(0, 10);
      return { start, end };
    }
    return { start: '', end: '' };
  };

  // Update form data when coupon changes
  useEffect(() => {
    if (coupon) {
      const period = parseCouponPeriod(coupon.coupon_period);
      setFormData({
        offer_title: coupon.offer_title || '',
        coupon_code: coupon.coupon_code || '',
        coupon_type: coupon.coupon_type || '',
        coupon_value: coupon.coupon_value || '',
        coupon_period_start: period.start,
        coupon_period_end: period.end,
        include_room_type: coupon.include_room_type || [],
        exclude_room_type: coupon.exclude_room_type || [],
        paid_services: coupon.paid_services || []
      });
    }
  }, [coupon]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.offer_title || !formData.coupon_code) {
      alert('Please fill in required fields');
      return;
    }

    try {
      setSaving(true);

      // Format coupon period for PostgreSQL DATERANGE
      // DATERANGE expects format: [YYYY-MM-DD,YYYY-MM-DD] (dates only)
      let couponPeriod = null;
      if (formData.coupon_period_start && formData.coupon_period_end) {
        // Get just the date part (YYYY-MM-DD)
        const startDate = formData.coupon_period_start.substring(0, 10);
        const endDate = formData.coupon_period_end.substring(0, 10);
        couponPeriod = `[${startDate},${endDate}]`;
      }

      const { data, error } = await supabase
        .from('coupons')
        .update({
          offer_title: formData.offer_title,
          coupon_code: formData.coupon_code,
          coupon_type: formData.coupon_type || null,
          coupon_value: parseFloat(formData.coupon_value) || 0,
          coupon_period: couponPeriod,
          include_room_type: formData.include_room_type.length > 0 ? formData.include_room_type : null,
          exclude_room_type: formData.exclude_room_type.length > 0 ? formData.exclude_room_type : null,
          paid_services: formData.paid_services.length > 0 ? formData.paid_services : null
        })
        .eq('id', coupon.id)
        .eq('user_id', userId)
        .select();

      if (error) throw error;

      onSuccess(data[0]);
      onClose();
    } catch (error) {
      console.error('Error updating coupon:', error);
      alert('Failed to update coupon: ' + error.message);
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
          <div
            className="fixed right-0 top-0 h-screen w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Tag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Edit Coupon</h2>
                  <p className="text-xs text-neutral-400">Update coupon details</p>
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
              <div className="p-6 space-y-6">
                {/* Basic Info Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Coupon Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                        Offer Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.offer_title}
                        onChange={(e) => setFormData(prev => ({ ...prev, offer_title: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="e.g., Summer Sale 2024"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Coupon Code & Type Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    Coupon Configuration
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                        Coupon Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.coupon_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, coupon_code: e.target.value.toUpperCase() }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent uppercase"
                        placeholder="SAVE20"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <SearchableSelect
                        label="Coupon Type"
                        value={formData.coupon_type}
                        onChange={(value) => setFormData(prev => ({ ...prev, coupon_type: value }))}
                        options={couponTypeOptions}
                        placeholder="Select type..."
                        getOptionLabel={(option) => option.label}
                        getOptionValue={(option) => option.value}
                      />
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Coupon Value ({currency})</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.coupon_value}
                          onChange={(e) => setFormData(prev => ({ ...prev, coupon_value: e.target.value }))}
                          className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                          placeholder="20"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Date Range Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Validity Period
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Start Date</label>
                      <input
                        type="date"
                        value={formData.coupon_period_start}
                        onChange={(e) => setFormData(prev => ({ ...prev, coupon_period_start: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">End Date</label>
                      <input
                        type="date"
                        value={formData.coupon_period_end}
                        onChange={(e) => setFormData(prev => ({ ...prev, coupon_period_end: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Room Type Restrictions Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <BedDouble className="w-4 h-4" />
                    Room Type Restrictions
                  </h3>
                  <div className="space-y-4">
                    <MultiSelect
                      label="Include Room Types"
                      value={formData.include_room_type}
                      onChange={(value) => setFormData(prev => ({ ...prev, include_room_type: value }))}
                      options={roomTypes || []}
                      placeholder="Select room types to include..."
                      getOptionLabel={(roomType) => roomType.title}
                      getOptionValue={(roomType) => roomType.id}
                    />
                    <MultiSelect
                      label="Exclude Room Types"
                      value={formData.exclude_room_type}
                      onChange={(value) => setFormData(prev => ({ ...prev, exclude_room_type: value }))}
                      options={roomTypes || []}
                      placeholder="Select room types to exclude..."
                      getOptionLabel={(roomType) => roomType.title}
                      getOptionValue={(roomType) => roomType.id}
                    />
                  </div>
                </div>

                {/* Paid Services Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Applicable Services
                  </h3>
                  <MultiSelect
                    label="Paid Services"
                    value={formData.paid_services}
                    onChange={(value) => setFormData(prev => ({ ...prev, paid_services: value }))}
                    options={paidServices || []}
                    placeholder="Select paid services..."
                    getOptionLabel={(service) => service.title}
                    getOptionValue={(service) => service.id}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#472F97] hover:bg-[#3a2578] text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Updating...' : 'Update Coupon'}
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
