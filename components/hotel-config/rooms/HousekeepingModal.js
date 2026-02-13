'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, ShieldCheck, Users, Search, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

const HousekeepingModal = ({ isOpen, onClose, onSuccess, room, employees, userId }) => {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    housekeeping_status: room?.housekeeping_status || 'clean',
    assigned_to: room?.assigned_to || '',
    remark: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const housekeepingStatuses = [
    { value: 'clean', label: 'Clean', color: 'bg-green-100 text-green-700' },
    { value: 'dirty', label: 'Dirty', color: 'bg-red-100 text-red-700' },
    { value: 'inspected', label: 'Inspected', color: 'bg-blue-100 text-blue-700' },
    { value: 'out of service', label: 'Out of Service', color: 'bg-gray-100 text-gray-700' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      const updateData = {
        housekeeping_status: formData.housekeeping_status,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null
      };

      const { data, error } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', room.id)
        .eq('user_id', userId)
        .select(`
          *,
          floors (name, floor_number),
          room_types (title, short_code)
        `);

      if (error) throw error;

      // Fetch employee data if assigned
      let updatedRoom = data[0];
      if (updatedRoom.assigned_to) {
        const { data: empData } = await supabase
          .from('employees')
          .select('id, full_name')
          .eq('id', updatedRoom.assigned_to)
          .eq('user_id', userId)
          .single();
        updatedRoom.employees = empData;
      } else {
        updatedRoom.employees = null;
      }

      onSuccess(updatedRoom);
      onClose();
    } catch (error) {
      console.error('Error updating housekeeping status:', error);
      alert('Failed to update housekeeping status: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Side Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-screen w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Housekeeping Status</h2>
                  <p className="text-xs text-white/70">Update room status</p>
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
                {/* Room Info */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4">Room Information</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-neutral-600 mb-1.5">Room Number</p>
                      <p className="text-xl font-semibold text-neutral-900">{room?.room_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-neutral-600 mb-1.5">Room Type</p>
                      <p className="text-sm font-semibold text-neutral-900">{room?.room_types?.title || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Housekeeping Status */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Housekeeping Status <span className="text-red-500">*</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {housekeepingStatuses.map(status => (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, housekeeping_status: status.value }))}
                        className={`p-3 rounded-lg border-2 font-medium text-sm transition-all ${
                          formData.housekeeping_status === status.value
                            ? 'border-[#472F97] bg-[#472F97] text-white'
                            : 'border-neutral-200 hover:border-neutral-300 text-neutral-700 bg-white'
                        }`}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assigned To */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Assigned To
                  </h3>
                  <SearchableSelect
                    label="Select Housekeeper"
                    value={formData.assigned_to}
                    onChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}
                    options={employees || []}
                    placeholder="-- Select Housekeeper --"
                    getOptionLabel={(employee) => employee.full_name}
                    getOptionValue={(employee) => employee.id}
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
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default HousekeepingModal;
