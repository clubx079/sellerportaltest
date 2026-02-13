'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, Award } from 'lucide-react';
// Removed framer-motion for better performance

const AddForm = ({ isOpen, onClose, onSuccess, userId }) => {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    name: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: ''
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter designation name');
      return;
    }

    if (!userId) {
      alert('User session not found. Please log in again.');
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase
        .from('designations')
        .insert([{
          user_id: userId,
          name: formData.name.trim()
        }])
        .select();

      if (error) throw error;

      onSuccess(data[0]);
      onClose();
    } catch (error) {
      console.error('Error adding designation:', error);
      alert('Failed to add designation: ' + error.message);
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
                  <Award className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Add Designation</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">Create new designation</p>
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
                {/* Designation Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Designation Information
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                      Designation Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                      placeholder="e.g., Manager, Receptionist, Accountant"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons - Sticky */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg sm:rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base bg-[#472F97] hover:bg-[#3a2578] text-white font-medium rounded-lg sm:rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {saving ? 'Saving...' : 'Save Designation'}
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
