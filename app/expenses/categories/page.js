"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Search, X, Tags, TrendingUp, Layers, FolderOpen, Filter, ChevronDown } from 'lucide-react';
import CategoryForm from '@/components/expenses/CategoryForm';
import CategoryDeleteConfirmModal from '@/components/expenses/CategoryDeleteConfirmModal';

// Searchable Select Component
const SearchableSelect = ({ value, onChange, options, placeholder, className }) => {
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
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOption = options.find(option => option.value === value);

  return (
    <div ref={dropdownRef} className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer hover:border-neutral-300 transition-colors flex items-center justify-between gap-2 ${className || ''}`}
      >
        <span className={selectedOption ? 'text-neutral-900' : 'text-neutral-400'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-hidden min-w-[150px]">
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
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-neutral-100 transition-colors ${
                    option.value === value ? 'bg-neutral-50 font-medium' : ''
                  }`}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ title, value, icon: Icon }) => {
  return (
    <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] md:text-xs text-neutral-500">{title}</p>
          <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5 truncate">{value}</p>
        </div>
        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
        </div>
      </div>
    </div>
  );
};

// Main Expense Categories Management Component
const ExpenseCategoriesManagement = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [userId, setUserId] = useState(null);

  // Get userId from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('hotel_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
    }
  }, []);

  // Prevent body scroll when any modal is open
  useEffect(() => {
    if (showAddModal || showEditModal || showDeleteModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAddModal, showEditModal, showDeleteModal]);

  // Fetch all categories when userId is available
  useEffect(() => {
    if (userId) {
      fetchCategories();
    }
  }, [userId]);

  const fetchCategories = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter categories based on search term
  const filteredCategories = categories.filter(category =>
    category.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredCategories.slice(indexOfFirstEntry, indexOfLastEntry);

  // Handle delete
  const handleDeleteClick = (category) => {
    setSelectedCategory(category);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', selectedCategory.id)
        .eq('user_id', userId);

      if (error) throw error;

      setCategories(prev => prev.filter(c => c.id !== selectedCategory.id));
      setShowDeleteModal(false);
      setSelectedCategory(null);
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  // Handle edit
  const handleEditClick = (category) => {
    setSelectedCategory(category);
    setShowEditModal(true);
  };

  // Calculate stats
  const totalCategoriesCount = categories.length;

  // Entries per page options
  const entriesOptions = [
    { value: 10, label: '10 rows' },
    { value: 25, label: '25 rows' },
    { value: 50, label: '50 rows' },
    { value: 100, label: '100 rows' }
  ];

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Expense Categories</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage expense categories</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            title="Total Categories"
            value={totalCategoriesCount}
            icon={Tags}
          />
          <StatCard
            title="Active"
            value={totalCategoriesCount}
            icon={TrendingUp}
          />
          <StatCard
            title="Groups"
            value={totalCategoriesCount}
            icon={Layers}
          />
          <StatCard
            title="Types"
            value={totalCategoriesCount}
            icon={FolderOpen}
          />
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Controls */}
          <div className="px-3 sm:px-4 py-3 border-b border-neutral-200 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <Filter className="w-4 h-4 text-neutral-400 hidden sm:block" />
                <SearchableSelect
                  value={entriesPerPage}
                  onChange={(value) => {
                    setEntriesPerPage(value);
                    setCurrentPage(1);
                  }}
                  options={entriesOptions}
                  placeholder="Rows per page"
                  className="flex-1 sm:flex-none sm:min-w-[120px]"
                />
              </div>

              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                  placeholder="Search categories..."
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Category Name</th>
                  <th className="px-3 py-2.5 text-right text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td colSpan="3" className="px-3 sm:px-4 py-8 text-center">
                      <div className="flex items-center justify-center gap-2 text-neutral-500">
                        <div className="w-5 h-5 border-2 border-[#472F97] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs sm:text-sm font-medium">Loading categories...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-3 sm:px-4 py-8 text-center">
                      <Tags className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 font-medium text-xs sm:text-sm">No categories found</p>
                      <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">Try adjusting your search or add a new category</p>
                    </td>
                  </tr>
                ) : (
                  currentEntries.map((category, index) => (
                    <tr
                      key={category.id}
                      className="hover:bg-neutral-50 transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <span className="text-xs sm:text-sm font-medium text-neutral-500">
                          {indexOfFirstEntry + index + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                            <Tags className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-600" />
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-neutral-900 truncate">
                            {category.name || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditClick(category)}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-all duration-200"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(category)}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-all duration-200"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-3 sm:px-4 py-2.5 bg-neutral-50 border-t border-neutral-200">
            <div className="text-xs sm:text-sm text-neutral-500">
              Showing {filteredCategories.length} of {categories.length} entries
            </div>
          </div>
        </div>

        {/* Modals */}
        <CategoryForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newCategory) => {
            setCategories(prev => [...prev, newCategory]);
            setShowAddModal(false);
          }}
          mode="add"
          userId={userId}
        />

        <CategoryForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCategory(null);
          }}
          onSuccess={(updatedCategory) => {
            setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c));
            setShowEditModal(false);
            setSelectedCategory(null);
          }}
          mode="edit"
          category={selectedCategory}
          userId={userId}
        />

        <CategoryDeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedCategory(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedCategory?.name || 'this category'}
        />
    </div>
  );
};

export default ExpenseCategoriesManagement;
