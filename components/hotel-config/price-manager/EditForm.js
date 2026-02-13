'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, DollarSign, Calendar, BedDouble, Search, ChevronDown } from 'lucide-react';
import { getCurrentCurrencySymbol } from '@/lib/currency';

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

const EditForm = ({ isOpen, onClose, onSuccess, priceEntry, roomTypes, userId }) => {
  const [mounted, setMounted] = useState(false);
  const [currency, setCurrency] = useState('$');
  const [formData, setFormData] = useState({
    room_type_id: '',
    regular_price: '',
    special_price: '',
    start_date: '',
    end_date: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrency(getCurrentCurrencySymbol());
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (priceEntry) {
      setFormData({
        room_type_id: priceEntry.room_type_id || '',
        regular_price: priceEntry.regular_price || '',
        special_price: priceEntry.special_price || '',
        start_date: priceEntry.start_date || '',
        end_date: priceEntry.end_date || ''
      });
    }
  }, [priceEntry]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.room_type_id) {
      alert('Please select a room type');
      return;
    }

    try {
      setSaving(true);

      const updateData = {
        room_type_id: parseInt(formData.room_type_id),
        regular_price: parseFloat(formData.regular_price) || null,
        special_price: parseFloat(formData.special_price) || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null
      };

      const { data, error } = await supabase
        .from('price_manager')
        .update(updateData)
        .eq('id', priceEntry.id)
        .eq('user_id', userId)
        .select(`
          *,
          room_types (
            id,
            title
          )
        `);

      if (error) throw error;

      onSuccess(data[0]);
      onClose();
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Failed to update price: ' + error.message);
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
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Edit Price Entry</h2>
                  <p className="text-xs text-neutral-400">Update pricing details</p>
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
                {/* Room Type Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <BedDouble className="w-4 h-4" />
                    Room Type
                  </h3>
                  <SearchableSelect
                    label="Select Room Type"
                    value={formData.room_type_id}
                    onChange={(value) => setFormData(prev => ({ ...prev, room_type_id: value }))}
                    options={roomTypes || []}
                    placeholder="Choose a room type..."
                    required
                    getOptionLabel={(roomType) => roomType.title}
                    getOptionValue={(roomType) => roomType.id}
                  />
                </div>

                {/* Pricing Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Pricing
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Regular Price ({currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.regular_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, regular_price: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="100.00"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Special Price ({currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.special_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, special_price: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="80.00"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Date Range Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date Range
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Start Date</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">End Date</label>
                      <input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      />
                    </div>
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
                  {saving ? 'Updating...' : 'Update Price'}
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
