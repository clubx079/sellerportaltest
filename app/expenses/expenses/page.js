"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, Receipt, DollarSign, Calendar, TrendingUp, Filter, ChevronDown } from 'lucide-react';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import ExpenseView from '@/components/expenses/ExpenseView';
import ExpenseDeleteConfirmModal from '@/components/expenses/ExpenseDeleteConfirmModal';
import { getCurrentCurrencySymbol } from '@/lib/currency';

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

// Main Expenses Management Component
const ExpensesManagement = () => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [userId, setUserId] = useState(null);
  const [currency, setCurrency] = useState('$');

  // Get userId from localStorage and set currency
  useEffect(() => {
    const userStr = localStorage.getItem('hotel_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
    }
    setCurrency(getCurrentCurrencySymbol());
  }, []);

  // Prevent body scroll when any modal is open
  useEffect(() => {
    if (showAddModal || showEditModal || showViewModal || showDeleteModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAddModal, showEditModal, showViewModal, showDeleteModal]);

  // Fetch all expenses and categories when userId is available
  useEffect(() => {
    if (userId) {
      fetchExpenses();
      fetchCategories();
    }
  }, [userId]);

  const fetchExpenses = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          expense_categories (id, name)
        `)
        .eq('user_id', userId)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('id, name')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Filter expenses based on search term and category
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch =
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.expense_categories?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !filterCategory || expense.category_id === parseInt(filterCategory);

    return matchesSearch && matchesCategory;
  });

  // Pagination
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredExpenses.slice(indexOfFirstEntry, indexOfLastEntry);

  // Handle delete
  const handleDeleteClick = (expense) => {
    setSelectedExpense(expense);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', selectedExpense.id)
        .eq('user_id', userId);

      if (error) throw error;

      setExpenses(prev => prev.filter(e => e.id !== selectedExpense.id));
      setShowDeleteModal(false);
      setSelectedExpense(null);
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  // Handle edit
  const handleEditClick = (expense) => {
    setSelectedExpense(expense);
    setShowEditModal(true);
  };

  // Handle view
  const handleViewClick = (expense) => {
    setSelectedExpense(expense);
    setShowViewModal(true);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Truncate text
  const truncateText = (text, maxLength = 40) => {
    if (!text) return 'N/A';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Calculate stats
  const totalExpensesCount = expenses.length;
  const totalAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const thisMonthExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.expense_date);
    const now = new Date();
    return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  // Entries per page options
  const entriesOptions = [
    { value: 10, label: '10 rows' },
    { value: 25, label: '25 rows' },
    { value: 50, label: '50 rows' },
    { value: 100, label: '100 rows' }
  ];

  // Category filter options
  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...categories.map(cat => ({ value: cat.id.toString(), label: cat.name }))
  ];

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Expenses</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage hotel expenses</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            title="Total Expenses"
            value={totalExpensesCount}
            icon={Receipt}
          />
          <StatCard
            title="Total Amount"
            value={`${currency}${totalAmount.toFixed(2)}`}
            icon={DollarSign}
          />
          <StatCard
            title="This Month"
            value={`${currency}${thisMonthTotal.toFixed(2)}`}
            icon={Calendar}
          />
          <StatCard
            title="Categories"
            value={categories.length}
            icon={TrendingUp}
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
                <SearchableSelect
                  value={filterCategory}
                  onChange={(value) => {
                    setFilterCategory(value);
                    setCurrentPage(1);
                  }}
                  options={categoryOptions}
                  placeholder="All Categories"
                  className="flex-1 sm:flex-none sm:min-w-[150px]"
                />
              </div>

              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                  placeholder="Search expenses..."
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
            <table className="w-full min-w-[800px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Category</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Description</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Amount</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5 text-right text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-3 sm:px-4 py-8 text-center">
                      <div className="flex items-center justify-center gap-2 text-neutral-500">
                        <div className="w-5 h-5 border-2 border-[#472F97] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs sm:text-sm font-medium">Loading expenses...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-3 sm:px-4 py-8 text-center">
                      <Receipt className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 font-medium text-xs sm:text-sm">No expenses found</p>
                      <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">Try adjusting your search or add a new expense</p>
                    </td>
                  </tr>
                ) : (
                  currentEntries.map((expense, index) => (
                    <tr
                      key={expense.id}
                      className="hover:bg-neutral-50 transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <span className="text-xs sm:text-sm font-medium text-neutral-500">
                          {indexOfFirstEntry + index + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium bg-neutral-100 text-neutral-700">
                          {expense.expense_categories?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs sm:text-sm text-neutral-900">
                          {truncateText(expense.description)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs sm:text-sm font-semibold text-neutral-900">
                          {currency}{parseFloat(expense.amount || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs sm:text-sm text-neutral-500">
                          {formatDate(expense.expense_date)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleViewClick(expense)}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-all duration-200"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleEditClick(expense)}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-all duration-200"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(expense)}
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
              Showing {filteredExpenses.length} of {expenses.length} entries
            </div>
          </div>
        </div>

        {/* Modals */}
        <ExpenseForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchExpenses();
            setShowAddModal(false);
          }}
          mode="add"
          categories={categories}
          userId={userId}
        />

        <ExpenseForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedExpense(null);
          }}
          onSuccess={() => {
            fetchExpenses();
            setShowEditModal(false);
            setSelectedExpense(null);
          }}
          mode="edit"
          expense={selectedExpense}
          categories={categories}
          userId={userId}
        />

        <ExpenseView
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedExpense(null);
          }}
          expense={selectedExpense}
        />

        <ExpenseDeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedExpense(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedExpense?.description || 'this expense'}
        />
    </div>
  );
};

export default ExpensesManagement;
