'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, Users, Mail, Phone, MapPin, CreditCard, FileText, Briefcase, ChevronDown, Search, Check } from 'lucide-react';
// Removed framer-motion for better performance

// SearchableSelect Component
const SearchableSelect = ({ label, value, onChange, options, placeholder, required, getOptionLabel, getOptionValue }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
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
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-medium text-neutral-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent flex items-center justify-between"
      >
        <span className={selectedOption ? 'text-neutral-900' : 'text-neutral-400'}>
          {selectedOption ? getOptionLabel(selectedOption) : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
          <div
            className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="p-2 border-b border-neutral-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-neutral-500">No options found</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={getOptionValue(option)}
                    type="button"
                    onClick={() => {
                      onChange(getOptionValue(option));
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 flex items-center justify-between ${
                      getOptionValue(option) === value ? 'bg-neutral-50 text-neutral-900' : 'text-neutral-700'
                    }`}
                  >
                    {getOptionLabel(option)}
                    {getOptionValue(option) === value && (
                      <Check className="w-4 h-4 text-neutral-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
    </div>
  );
};

const AddForm = ({ isOpen, onClose, onSuccess, departments = [], designations = [], userId }) => {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    department_id: '',
    designation_id: '',
    country: '',
    region: '',
    city: '',
    address: '',
    cnic_number: '',
    id_upload: '',
    remark: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        full_name: '',
        username: '',
        email: '',
        phone: '',
        department_id: '',
        designation_id: '',
        country: '',
        region: '',
        city: '',
        address: '',
        cnic_number: '',
        id_upload: '',
        remark: ''
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.full_name) {
      alert('Please enter full name');
      return;
    }

    if (!userId) {
      alert('User session not found. Please log in again.');
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase
        .from('employees')
        .insert([{
          user_id: userId,
          full_name: formData.full_name,
          username: formData.username || null,
          email: formData.email || null,
          phone: formData.phone || null,
          department_id: formData.department_id ? parseInt(formData.department_id) : null,
          designation_id: formData.designation_id ? parseInt(formData.designation_id) : null,
          country: formData.country || null,
          region: formData.region || null,
          city: formData.city || null,
          address: formData.address || null,
          cnic_number: formData.cnic_number || null,
          id_upload: formData.id_upload || null,
          remark: formData.remark || null
        }])
        .select(`
          *,
          departments (
            id,
            name
          ),
          designations (
            id,
            name
          )
        `);

      if (error) throw error;

      onSuccess(data[0]);
      onClose();
    } catch (error) {
      console.error('Error adding employee:', error);
      alert('Failed to add employee: ' + error.message);
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
            className="fixed right-0 top-0 h-screen w-full sm:w-[90%] md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/10 flex items-center justify-center">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Add Employee</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">Create new employee record</p>
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
                {/* Personal Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                        placeholder="Enter full name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                        Username
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                        placeholder="Enter username"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                        placeholder="Enter email"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Contact Information
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Phone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                </div>

                {/* Employment Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Employment Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <SearchableSelect
                      label="Department"
                      value={formData.department_id}
                      onChange={(value) => setFormData(prev => ({ ...prev, department_id: value }))}
                      options={departments}
                      placeholder="Select department"
                      getOptionLabel={(option) => option.name}
                      getOptionValue={(option) => option.id}
                    />
                    <SearchableSelect
                      label="Designation"
                      value={formData.designation_id}
                      onChange={(value) => setFormData(prev => ({ ...prev, designation_id: value }))}
                      options={designations}
                      placeholder="Select designation"
                      getOptionLabel={(option) => option.name}
                      getOptionValue={(option) => option.id}
                    />
                  </div>
                </div>

                {/* Address Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Address Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">Country</label>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                        placeholder="Enter country"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">Region</label>
                      <input
                        type="text"
                        value={formData.region}
                        onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                        placeholder="Enter region"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">City</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                        placeholder="Enter city"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">Address</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                        placeholder="Enter address"
                      />
                    </div>
                  </div>
                </div>

                {/* ID Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    ID Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">CNIC Number</label>
                      <input
                        type="text"
                        value={formData.cnic_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, cnic_number: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                        placeholder="Enter CNIC number"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">ID Upload (URL)</label>
                      <input
                        type="text"
                        value={formData.id_upload}
                        onChange={(e) => setFormData(prev => ({ ...prev, id_upload: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                        placeholder="Enter document URL"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Additional Information
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Remark</label>
                    <textarea
                      value={formData.remark}
                      onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                      placeholder="Any additional notes..."
                      rows="3"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons - Sticky */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm sm:text-base font-medium rounded-lg sm:rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#472F97] hover:bg-[#3a2578] text-white text-sm sm:text-base font-medium rounded-lg sm:rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {saving ? 'Saving...' : 'Save Employee'}
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
