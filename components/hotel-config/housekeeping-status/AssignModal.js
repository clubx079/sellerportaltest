'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, User, ClipboardCheck, Hash, Search, ChevronDown } from 'lucide-react';

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
            {/* Unassign option */}
            <div
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearchQuery('');
              }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-neutral-100 transition-colors ${
                value === '' ? 'bg-neutral-50 font-medium' : ''
              }`}
            >
              -- Unassign --
            </div>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-neutral-500 text-center">No employees found</div>
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

const AssignModal = ({ isOpen, onClose, onSuccess, item, type, housekeepers, userId }) => {
  const [mounted, setMounted] = useState(false);
  const [selectedHousekeeper, setSelectedHousekeeper] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Update selected housekeeper when item changes
  useEffect(() => {
    if (item) {
      setSelectedHousekeeper(item.assigned_to || '');
    }
  }, [item]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'clean':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'dirty':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'inspected':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'out of service':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      const table = type === 'room' ? 'rooms' : 'halls';
      const { error } = await supabase
        .from(table)
        .update({ assigned_to: selectedHousekeeper || null })
        .eq('id', item.id)
        .eq('user_id', userId);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error assigning housekeeper:', error);
      alert('Failed to assign housekeeper: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted || !item) return null;

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
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Assign Housekeeper</h2>
                  <p className="text-[10px] sm:text-xs text-neutral-400 hidden sm:block">Assign staff to {type === 'room' ? 'room' : 'hall'}</p>
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
                {/* Item Information Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <Hash className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {type === 'room' ? 'Room' : 'Hall'} Information
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">
                        {type === 'room' ? 'Room' : 'Hall'} Number
                      </label>
                      <p className="text-base sm:text-lg font-semibold text-neutral-900">{item.number}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">Category</label>
                        <p className="text-xs sm:text-sm text-neutral-700">{item.typeName || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-[11px] sm:text-xs font-medium text-neutral-600 mb-1 sm:mb-1.5">Floor</label>
                        <p className="text-xs sm:text-sm text-neutral-700">{item.floors?.name || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current Status Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <ClipboardCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Current Status
                  </h3>
                  <div>
                    <span className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold border ${getStatusColor(item.housekeeping_status)}`}>
                      {item.housekeeping_status?.charAt(0).toUpperCase() + item.housekeeping_status?.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Assignment Section */}
                <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Housekeeper Assignment
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    <SearchableSelect
                      label="Select Housekeeper"
                      value={selectedHousekeeper}
                      onChange={(value) => setSelectedHousekeeper(value)}
                      options={housekeepers || []}
                      placeholder="Select an employee..."
                      getOptionLabel={(housekeeper) => `${housekeeper.full_name} (${housekeeper.email || 'No email'})`}
                      getOptionValue={(housekeeper) => housekeeper.id}
                    />
                    {item.assigned_employee && (
                      <p className="text-[10px] sm:text-xs text-neutral-500">
                        Currently assigned to: <span className="font-semibold">{item.assigned_employee.full_name}</span>
                      </p>
                    )}
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
                  {saving ? 'Assigning...' : 'Assign'}
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

export default AssignModal;
