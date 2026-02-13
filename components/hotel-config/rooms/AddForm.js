'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, BedDouble, Building2, Layers, Plus, Search, ChevronDown } from 'lucide-react';

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
        <span className={selectedOption ? 'text-[#472F97]' : 'text-white/70'}>
          {selectedOption ? getOptionLabel(selectedOption) : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-neutral-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
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

const AddForm = ({ isOpen, onClose, onSuccess, floors, roomTypes, userId }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [roomEntries, setRoomEntries] = useState([{
    floor_id: '',
    room_type_id: '',
    room_number: '',
    housekeeping_status: 'clean'
  }]);
  const [saving, setSaving] = useState(false);

  const housekeepingOptions = [
    { value: 'clean', label: 'Clean' },
    { value: 'dirty', label: 'Dirty' },
    { value: 'inspected', label: 'Inspected' },
    { value: 'out of service', label: 'Out of Service' }
  ];

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setRoomEntries([{
        floor_id: '',
        room_type_id: '',
        room_number: '',
        housekeeping_status: 'clean'
      }]);
    }
  }, [isOpen]);

  const addMoreRoom = () => {
    setRoomEntries([...roomEntries, {
      floor_id: '',
      room_type_id: '',
      room_number: '',
      housekeeping_status: 'clean'
    }]);
  };

  const removeRoom = (index) => {
    if (roomEntries.length > 1) {
      setRoomEntries(roomEntries.filter((_, i) => i !== index));
    }
  };

  const updateRoomEntry = (index, field, value) => {
    const newEntries = [...roomEntries];
    newEntries[index][field] = value;
    setRoomEntries(newEntries);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all entries
    for (let i = 0; i < roomEntries.length; i++) {
      const entry = roomEntries[i];
      if (!entry.floor_id || !entry.room_type_id || !entry.room_number.trim()) {
        alert(`Please fill in all required fields for Room ${i + 1}`);
        return;
      }
    }

    try {
      setSaving(true);

      const roomsToInsert = roomEntries.map(entry => ({
        user_id: userId,
        floor_id: parseInt(entry.floor_id),
        room_type_id: parseInt(entry.room_type_id),
        room_number: entry.room_number,
        housekeeping_status: entry.housekeeping_status,
        assigned_to: null,
        is_active: true
      }));

      const { data, error } = await supabase
        .from('rooms')
        .insert(roomsToInsert)
        .select(`
          *,
          floors (name, floor_number),
          room_types (title, short_code)
        `);

      if (error) throw error;

      onSuccess(data);
      onClose();
    } catch (error) {
      console.error('Error adding rooms:', error);
      alert('Failed to add rooms: ' + error.message);
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
                  <BedDouble className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Add Room</h2>
                  <p className="text-xs text-white/70">Create new accommodation</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Form Content - Scrollable */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {roomEntries.map((entry, index) => (
                  <div key={index} className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-[#472F97] flex items-center gap-2">
                        <BedDouble className="w-4 h-4" />
                        Room {index + 1} Information
                      </h3>
                      {roomEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRoom(index)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {/* Room Number Field */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                          Room Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={entry.room_number}
                          onChange={(e) => updateRoomEntry(index, 'room_number', e.target.value)}
                          className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                          placeholder="e.g., 101"
                          required
                        />
                      </div>

                      {/* Floor Field */}
                      <SearchableSelect
                        label="Floor"
                        value={entry.floor_id}
                        onChange={(value) => updateRoomEntry(index, 'floor_id', value)}
                        options={floors}
                        placeholder="Select Floor"
                        required
                        getOptionLabel={(floor) => `${floor.floor_number} - ${floor.name}`}
                        getOptionValue={(floor) => floor.id}
                      />

                      {/* Room Type Field */}
                      <SearchableSelect
                        label="Room Type"
                        value={entry.room_type_id}
                        onChange={(value) => updateRoomEntry(index, 'room_type_id', value)}
                        options={roomTypes || []}
                        placeholder="Select Room Type"
                        required
                        getOptionLabel={(roomType) => roomType.title}
                        getOptionValue={(roomType) => roomType.id}
                      />

                      {/* Housekeeping Status */}
                      <SearchableSelect
                        label="Housekeeping Status"
                        value={entry.housekeeping_status}
                        onChange={(value) => updateRoomEntry(index, 'housekeeping_status', value)}
                        options={housekeepingOptions}
                        placeholder="Select Status"
                        getOptionLabel={(option) => option.label}
                        getOptionValue={(option) => option.value}
                      />
                    </div>
                  </div>
                ))}

                {/* Add More Button */}
                <button
                  type="button"
                  onClick={addMoreRoom}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 text-neutral-600 hover:text-neutral-700 px-4 py-3 rounded-lg font-medium transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Room
                </button>
              </div>

              {/* Action Buttons - Sticky */}
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
                  {saving ? 'Saving...' : `Save Room${roomEntries.length > 1 ? 's' : ''}`}
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
