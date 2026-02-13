'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, User, Phone, Star, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EditForm = ({ isOpen, onClose, onSuccess, guest, userId }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    cnic: '',
    is_vip: false
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && guest) {
      setFormData({
        full_name: guest.full_name || '',
        phone: guest.phone || '',
        cnic: guest.cnic || '',
        is_vip: guest.is_vip || false
      });
    }
  }, [isOpen, guest]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.full_name.trim()) {
      alert('Please enter guest name');
      return;
    }

    if (!userId) {
      alert('User not authenticated');
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase
        .from('guests')
        .update({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          cnic: formData.cnic.trim() || null,
          is_vip: formData.is_vip
        })
        .eq('id', guest.id)
        .eq('user_id', userId)
        .select();

      if (error) throw error;

      onSuccess(data[0]);
      onClose();
    } catch (error) {
      console.error('Error updating guest:', error);
      alert('Failed to update guest: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && guest && (
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
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Edit Guest</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">Update guest information</p>
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
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Basic Info Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Guest Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="Enter guest's full name"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            Phone Number
                          </span>
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
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
                          value={formData.cnic}
                          onChange={(e) => setFormData(prev => ({ ...prev, cnic: e.target.value }))}
                          className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                          placeholder="e.g., 12345-1234567-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* VIP Status Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    VIP Status
                  </h3>
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.is_vip}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_vip: e.target.checked }))}
                      className="w-4 h-4 text-[#472F97] rounded focus:ring-[#472F97] border-neutral-300"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-neutral-700">Mark as VIP Guest</span>
                      <p className="text-xs text-neutral-500 mt-0.5">VIP guests receive special treatment and priority service</p>
                    </div>
                  </label>
                </div>
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
                  <span className="hidden sm:inline">{saving ? 'Saving...' : 'Update Guest'}</span>
                  <span className="sm:hidden">{saving ? 'Saving...' : 'Update'}</span>
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

export default EditForm;
