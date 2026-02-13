'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, Building2, Search, ChevronDown } from 'lucide-react';

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

const EditForm = ({ isOpen, onClose, onSuccess, hall, floors, hallTypes, userId }) => {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    floor_id: '',
    hall_type_id: '',
    hall_number: '',
    housekeeping_status: 'clean'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (hall) {
      setFormData({
        floor_id: hall.floor_id || '',
        hall_type_id: hall.hall_type_id || '',
        hall_number: hall.hall_number || '',
        housekeeping_status: hall.housekeeping_status || 'clean'
      });
    }
  }, [hall]);

  const housekeepingOptions = [
    { value: 'clean', label: 'Clean' },
    { value: 'dirty', label: 'Dirty' },
    { value: 'inspected', label: 'Inspected' },
    { value: 'out of service', label: 'Out of Service' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.floor_id || !formData.hall_type_id || !formData.hall_number.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const updateData = {
        floor_id: parseInt(formData.floor_id),
        hall_type_id: parseInt(formData.hall_type_id),
        hall_number: formData.hall_number,
        housekeeping_status: formData.housekeeping_status
      };

      const { data, error } = await supabase
        .from('halls')
        .update(updateData)
        .eq('id', hall.id)
        .eq('user_id', userId)
        .select(`
          *,
          floors (name, floor_number),
          hall_types (title, short_code)
        `);

      if (error) throw error;

      let updatedHall = data[0];
      if (updatedHall.assigned_to) {
        const { data: empData } = await supabase
          .from('employees')
          .select('id, full_name')
          .eq('id', updatedHall.assigned_to)
          .single();
        updatedHall.employees = empData;
      } else {
        updatedHall.employees = null;
      }

      onSuccess(updatedHall);
      onClose();
    } catch (error) {
      console.error('Error updating hall:', error);
      alert('Failed to update hall: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && (
        <>
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          <div
            className="fixed right-0 top-0 h-screen w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Edit Hall</h2>
                  <p className="text-xs text-white/70">Update hall information</p>
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
              <div className="p-6 space-y-5">
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Hall Information
                  </h3>

                  <div className="space-y-4">
                    {/* Floor Field */}
                    <SearchableSelect
                      label="Floor"
                      value={formData.floor_id}
                      onChange={(value) => setFormData({ ...formData, floor_id: value })}
                      options={floors || []}
                      placeholder="Select Floor"
                      required
                      getOptionLabel={(floor) => `${floor.floor_number} - ${floor.name}`}
                      getOptionValue={(floor) => floor.id}
                    />

                    {/* Hall Type Field */}
                    <SearchableSelect
                      label="Hall Type"
                      value={formData.hall_type_id}
                      onChange={(value) => setFormData({ ...formData, hall_type_id: value })}
                      options={hallTypes || []}
                      placeholder="Select Hall Type"
                      required
                      getOptionLabel={(hallType) => hallType.title}
                      getOptionValue={(hallType) => hallType.id}
                    />

                    {/* Hall Number Field */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                        Hall Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.hall_number}
                        onChange={(e) => setFormData({ ...formData, hall_number: e.target.value })}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="e.g., H101"
                        required
                      />
                    </div>

                    {/* Housekeeping Status */}
                    <SearchableSelect
                      label="Housekeeping Status"
                      value={formData.housekeeping_status}
                      onChange={(value) => setFormData({ ...formData, housekeeping_status: value })}
                      options={housekeepingOptions}
                      placeholder="Select Status"
                      required={false}
                      getOptionLabel={(option) => option.label}
                      getOptionValue={(option) => option.value}
                    />
                  </div>
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
                  {saving ? 'Saving...' : 'Save Changes'}
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
