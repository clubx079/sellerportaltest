'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Tags } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

const CategoryForm = ({ isOpen, onClose, onSuccess, mode = 'add', category = null, userId }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [formData, setFormData] = useState({
    name: ''
  });
  const [saving, setSaving] = useState(false);

  // Populate form when editing or reset when adding
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && category) {
        setFormData({
          name: category.name || ''
        });
      } else {
        setFormData({
          name: ''
        });
      }
    }
  }, [mode, category, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter a category name');
      return;
    }

    if (!userId) {
      alert('User not authenticated');
      return;
    }

    try {
      setSaving(true);

      if (mode === 'add') {
        const { data, error } = await supabase
          .from('expense_categories')
          .insert([{
            name: formData.name.trim(),
            user_id: userId
          }])
          .select()
          .single();

        if (error) throw error;

        onSuccess(data);
        onClose();
      } else {
        const { data, error } = await supabase
          .from('expense_categories')
          .update({
            name: formData.name.trim()
          })
          .eq('id', category.id)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;

        onSuccess(data);
        onClose();
      }
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category: ' + error.message);
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
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0 }}
            className="fixed right-0 top-0 h-screen w-full md:w-[500px] lg:w-[600px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Tags className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">
                    {mode === 'add' ? 'Add Category' : 'Edit Category'}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-white/70">
                    {mode === 'add' ? 'Create a new expense category' : 'Update category details'}
                  </p>
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
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Tags className="w-4 h-4 text-neutral-600" />
                    <h3 className="text-sm font-semibold text-neutral-900">Category Information</h3>
                  </div>

                  <div className="space-y-4">
                    {/* Category Name Field */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                        Category Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                        placeholder="e.g., Food, Salary, Maintenance"
                        maxLength={100}
                        required
                      />
                      <p className="text-xs text-neutral-400 mt-2">{formData.name.length}/100 characters</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Sticky */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 bg-[#472F97] hover:bg-[#3a2578] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : (mode === 'add' ? 'Create Category' : 'Update Category')}
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

export default CategoryForm;
