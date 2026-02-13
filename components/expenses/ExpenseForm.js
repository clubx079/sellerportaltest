'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Receipt, DollarSign, Calendar, FileText, Tags, Search, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { getCurrentCurrencySymbol } from '@/lib/currency';

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
                className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
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

const ExpenseForm = ({ isOpen, onClose, onSuccess, mode = 'add', expense = null, categories = [], userId }) => {
  const [mounted, setMounted] = useState(false);
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    setMounted(true);
    setCurrency(getCurrentCurrencySymbol());
    return () => setMounted(false);
  }, []);

  const [formData, setFormData] = useState({
    category_id: '',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);

  // Populate form when editing or reset when adding
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && expense) {
        setFormData({
          category_id: expense.category_id || '',
          description: expense.description || '',
          amount: expense.amount?.toString() || '',
          expense_date: expense.expense_date || new Date().toISOString().split('T')[0]
        });
      } else {
        setFormData({
          category_id: '',
          description: '',
          amount: '',
          expense_date: new Date().toISOString().split('T')[0]
        });
      }
    }
  }, [mode, expense, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.category_id) {
      alert('Please select a category');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert('Please enter a valid amount');
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
          .from('expenses')
          .insert([{
            category_id: parseInt(formData.category_id),
            description: formData.description.trim(),
            amount: parseFloat(formData.amount),
            expense_date: formData.expense_date,
            user_id: userId
          }])
          .select()
          .single();

        if (error) throw error;

        onSuccess(data);
        onClose();
      } else {
        const { data, error } = await supabase
          .from('expenses')
          .update({
            category_id: parseInt(formData.category_id),
            description: formData.description.trim(),
            amount: parseFloat(formData.amount),
            expense_date: formData.expense_date
          })
          .eq('id', expense.id)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;

        onSuccess(data);
        onClose();
      }
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Failed to save expense: ' + error.message);
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
            className="fixed right-0 top-0 h-screen w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">
                    {mode === 'add' ? 'Add Expense' : 'Edit Expense'}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-white/70">
                    {mode === 'add' ? 'Record a new expense' : 'Update expense details'}
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
                    <Receipt className="w-4 h-4 text-neutral-600" />
                    <h3 className="text-sm font-semibold text-neutral-900">Expense Information</h3>
                  </div>

                  <div className="space-y-4">
                    {/* Category Field */}
                    <SearchableSelect
                      label="Category"
                      value={formData.category_id}
                      onChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
                      options={categories}
                      placeholder="Select Category"
                      required
                      getOptionLabel={(cat) => cat.name}
                      getOptionValue={(cat) => cat.id}
                    />

                    {/* Amount Field */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                        Amount <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">{currency}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.amount}
                          onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                          className="w-full border border-neutral-200 rounded-lg pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>

                    {/* Expense Date Field */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                        Expense Date
                      </label>
                      <input
                        type="date"
                        value={formData.expense_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                      />
                    </div>

                    {/* Description Field */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent resize-none"
                        placeholder="Enter expense description"
                        rows={4}
                      />
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
                  {saving ? 'Saving...' : (mode === 'add' ? 'Add Expense' : 'Update Expense')}
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

export default ExpenseForm;
