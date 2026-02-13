'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, User, Phone, Star, CreditCard, Plus, Trash2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AddForm = ({ isOpen, onClose, onSuccess, userId }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Head guest data
  const [headGuest, setHeadGuest] = useState({
    full_name: '',
    phone: '',
    cnic: '',
    is_vip: false
  });

  // Additional guests array
  const [additionalGuests, setAdditionalGuests] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHeadGuest({
        full_name: '',
        phone: '',
        cnic: '',
        is_vip: false
      });
      setAdditionalGuests([]);
    }
  }, [isOpen]);

  const addAdditionalGuest = () => {
    setAdditionalGuests(prev => [...prev, {
      id: Date.now(), // temporary ID for React key
      full_name: '',
      phone: '',
      cnic: '',
      is_vip: false
    }]);
  };

  const removeAdditionalGuest = (id) => {
    setAdditionalGuests(prev => prev.filter(guest => guest.id !== id));
  };

  const updateAdditionalGuest = (id, field, value) => {
    setAdditionalGuests(prev => prev.map(guest =>
      guest.id === id ? { ...guest, [field]: value } : guest
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!headGuest.full_name.trim()) {
      alert('Please enter head guest name');
      return;
    }

    if (!userId) {
      alert('User not authenticated');
      return;
    }

    try {
      setSaving(true);

      // Prepare all guests to insert (head guest + additional guests)
      const guestsToInsert = [
        {
          user_id: userId,
          full_name: headGuest.full_name.trim(),
          phone: headGuest.phone.trim() || null,
          cnic: headGuest.cnic.trim() || null,
          is_vip: headGuest.is_vip
        }
      ];

      // Add additional guests if they have names
      additionalGuests.forEach(guest => {
        if (guest.full_name.trim()) {
          guestsToInsert.push({
            user_id: userId,
            full_name: guest.full_name.trim(),
            phone: guest.phone.trim() || null,
            cnic: guest.cnic.trim() || null,
            is_vip: guest.is_vip
          });
        }
      });

      const { data, error } = await supabase
        .from('guests')
        .insert(guestsToInsert)
        .select();

      if (error) throw error;

      // Call onSuccess with all created guests
      onSuccess(data);
      onClose();
    } catch (error) {
      console.error('Error adding guests:', error);
      alert('Failed to add guests: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0 }}
            className="fixed right-0 top-0 h-screen w-full md:w-[500px] lg:w-[550px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Add Guests</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">Create new guest profiles</p>
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
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Head Guest Section */}
                <div className="bg-gradient-to-br from-[#F5F3FF] to-white rounded-xl p-4 border-2 border-[#472F97]/20">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Head Guest <span className="text-red-500">*</span>
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={headGuest.full_name}
                        onChange={(e) => setHeadGuest(prev => ({ ...prev, full_name: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent bg-white"
                        placeholder="Enter head guest's full name"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            Phone Number
                          </span>
                        </label>
                        <input
                          type="tel"
                          value={headGuest.phone}
                          onChange={(e) => setHeadGuest(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent bg-white"
                          placeholder="e.g., +1 234 567 8900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            CNIC Number
                          </span>
                        </label>
                        <input
                          type="text"
                          value={headGuest.cnic}
                          onChange={(e) => setHeadGuest(prev => ({ ...prev, cnic: e.target.value }))}
                          className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent bg-white"
                          placeholder="e.g., 12345-1234567-1"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg border border-neutral-200 hover:border-[#472F97]/30 transition-colors">
                      <input
                        type="checkbox"
                        checked={headGuest.is_vip}
                        onChange={(e) => setHeadGuest(prev => ({ ...prev, is_vip: e.target.checked }))}
                        className="w-4 h-4 text-[#472F97] rounded focus:ring-[#472F97] border-neutral-300"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-neutral-700 flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          Mark as VIP Guest
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Additional Guests Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Additional Guests (Optional)
                    </h3>
                    <button
                      type="button"
                      onClick={addAdditionalGuest}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#472F97] hover:bg-[#3a2578] text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Guest
                    </button>
                  </div>

                  {additionalGuests.length === 0 ? (
                    <div className="text-center py-6 bg-white rounded-lg border border-dashed border-neutral-300">
                      <Users className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-xs text-neutral-500">No additional guests added</p>
                      <p className="text-[10px] text-neutral-400 mt-1">Click "Add Guest" to add more guests</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {additionalGuests.map((guest, index) => (
                        <div key={guest.id} className="bg-white rounded-lg p-4 border border-neutral-200">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-neutral-700">Guest {index + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeAdditionalGuest(guest.id)}
                              className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors"
                              title="Remove guest"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                                Full Name
                              </label>
                              <input
                                type="text"
                                value={guest.full_name}
                                onChange={(e) => updateAdditionalGuest(guest.id, 'full_name', e.target.value)}
                                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#472F97] focus:border-transparent"
                                placeholder="Enter guest's full name"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                                  Phone Number
                                </label>
                                <input
                                  type="tel"
                                  value={guest.phone}
                                  onChange={(e) => updateAdditionalGuest(guest.id, 'phone', e.target.value)}
                                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#472F97] focus:border-transparent"
                                  placeholder="Phone number"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                                  CNIC Number
                                </label>
                                <input
                                  type="text"
                                  value={guest.cnic}
                                  onChange={(e) => updateAdditionalGuest(guest.id, 'cnic', e.target.value)}
                                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#472F97] focus:border-transparent"
                                  placeholder="CNIC number"
                                />
                              </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={guest.is_vip}
                                onChange={(e) => updateAdditionalGuest(guest.id, 'is_vip', e.target.checked)}
                                className="w-3.5 h-3.5 text-[#472F97] rounded focus:ring-[#472F97] border-neutral-300"
                              />
                              <span className="text-xs text-neutral-700 flex items-center gap-1">
                                <Star className="w-3 h-3 text-amber-500" />
                                VIP Guest
                              </span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Summary */}
                {additionalGuests.length > 0 && (
                  <div className="bg-[#472F97]/5 rounded-lg p-3 border border-[#472F97]/20">
                    <p className="text-xs text-[#472F97] font-medium">
                      Total guests to add: <span className="font-bold">{1 + additionalGuests.filter(g => g.full_name.trim()).length}</span>
                      {' '}(1 head guest + {additionalGuests.filter(g => g.full_name.trim()).length} additional)
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-3 sm:px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-3 sm:px-4 py-2.5 bg-[#472F97] hover:bg-[#3a2578] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">{saving ? 'Saving...' : `Save ${1 + additionalGuests.filter(g => g.full_name.trim()).length} Guest${1 + additionalGuests.filter(g => g.full_name.trim()).length > 1 ? 's' : ''}`}</span>
                  <span className="sm:hidden">{saving ? 'Saving...' : 'Save'}</span>
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

export default AddForm;
