"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, UtensilsCrossed, Filter, DollarSign, CheckCircle, XCircle, Image as ImageIcon } from 'lucide-react';
import MenuForm from '@/components/menu/MenuForm';
import MenuView from '@/components/menu/MenuView';
import DeleteConfirmModal from '@/components/menu/DeleteConfirmModal';

const MenuManagement = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [userId, setUserId] = useState(null);
  const [currency, setCurrency] = useState('$');

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

  useEffect(() => {
    const userStr = localStorage.getItem('hotel_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
    }

    const currencyCode = localStorage.getItem('hotel_currency') || 'USD';
    const currencySymbols = {
      'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'AED': 'د.إ',
      'SAR': '﷼', 'PKR': 'Rs', 'BDT': '৳', 'JPY': '¥', 'CNY': '¥',
      'AUD': 'A$', 'CAD': 'C$'
    };
    setCurrency(currencySymbols[currencyCode] || '$');
  }, []);

  useEffect(() => {
    if (userId) {
      fetchMenuItems();
    }
  }, [userId]);

  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('menu')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: false });

      if (error) throw error;
      setMenuItems(data || []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter menu items based on search term and filters
  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch =
      item.id?.toString().includes(searchTerm) ||
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !filterCategory || item.category === filterCategory;
    const matchesStatus = filterStatus === '' || (filterStatus === 'active' ? item.is_active : !item.is_active);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Pagination
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredMenuItems.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredMenuItems.length / entriesPerPage);

  // Handle delete
  const handleDeleteClick = (item) => {
    setSelectedMenuItem(item);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('menu')
        .delete()
        .eq('id', selectedMenuItem.id)
        .eq('user_id', userId);

      if (error) throw error;

      setMenuItems(prev => prev.filter(item => item.id !== selectedMenuItem.id));
      setShowDeleteModal(false);
      setSelectedMenuItem(null);
    } catch (error) {
      console.error('Error deleting menu item:', error);
      alert('Failed to delete menu item: ' + error.message);
    }
  };

  // Handle edit
  const handleEditClick = (item) => {
    setSelectedMenuItem(item);
    setShowEditModal(true);
  };

  // Handle view
  const handleViewClick = (item) => {
    setSelectedMenuItem(item);
    setShowViewModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Get unique categories
  const categories = [...new Set(menuItems.map(item => item.category).filter(Boolean))];

  // Calculate stats
  const totalItems = menuItems.length;
  const activeItems = menuItems.filter(item => item.is_active).length;
  const inactiveItems = menuItems.filter(item => !item.is_active).length;
  const totalRevenue = menuItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Menu</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage your restaurant menu items</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Add Menu Item</span>
          </button>
        </div>

        {/* Compact Stats Cards - Responsive grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Total Items</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{totalItems}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <UtensilsCrossed className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Active Items</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{activeItems}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Inactive Items</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{inactiveItems}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Avg Price</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">
                  {currency}{totalItems > 0 ? (totalRevenue / totalItems).toFixed(0) : '0'}
                </p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Controls - Responsive */}
          <div className="px-3 md:px-4 py-2.5 border-b border-neutral-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-neutral-400 hidden sm:block" />
                <select
                  value={entriesPerPage}
                  onChange={(e) => {
                    setEntriesPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                >
                  <option value={10}>10 rows</option>
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </select>
              </div>

              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                  placeholder="Search by name or category..."
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filters Row - Responsive */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[800px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Image</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Category</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Price</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Created At</th>
                  <th className="px-3 py-2.5 text-right text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 py-2.5"><div className="h-4 w-6 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-8 w-8 bg-neutral-100 rounded-lg"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-12 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-14 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-16 bg-neutral-100 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-3 md:px-5 py-8 md:py-10 text-center">
                      <UtensilsCrossed className="w-8 h-8 md:w-10 md:h-10 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-xs md:text-sm font-medium">No menu items found</p>
                      <p className="text-[10px] md:text-xs text-neutral-400 mt-1">Try adjusting your search or add a new menu item</p>
                    </td>
                  </tr>
                ) : (
                  currentEntries.map((item, index) => (
                    <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-medium text-neutral-400">{indexOfFirstEntry + index + 1}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover border border-neutral-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center border border-neutral-200">
                            <ImageIcon className="w-4 h-4 text-neutral-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <p className="text-xs font-medium text-neutral-900">{item.name || 'N/A'}</p>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[10px] font-medium">
                          {item.category || 'N/A'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-neutral-900">
                          {currency}{parseFloat(item.price).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {item.is_active ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-green-50 text-green-700 border-green-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-red-50 text-red-700 border-red-200">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-neutral-600">{formatDate(item.created_at)}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => handleViewClick(item)}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEditClick(item)}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(item)}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer - Just showing count, no pagination needed for simple view */}
          <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-200">
            <div className="text-xs text-neutral-500">
              Showing <span className="font-medium text-neutral-700">{filteredMenuItems.length > 0 ? indexOfFirstEntry + 1 : 0}</span> to{' '}
              <span className="font-medium text-neutral-700">{Math.min(indexOfLastEntry, filteredMenuItems.length)}</span> of{' '}
              <span className="font-medium text-neutral-700">{filteredMenuItems.length}</span> entries
            </div>
          </div>
        </div>

        {/* Modals */}
        <MenuForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newItem) => {
            setMenuItems(prev => [newItem, ...prev]);
          }}
          mode="add"
          userId={userId}
          currency={currency}
        />

        <MenuForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedMenuItem(null);
          }}
          onSuccess={(updatedItem) => {
            setMenuItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
            setShowEditModal(false);
            setSelectedMenuItem(null);
          }}
          mode="edit"
          menuItem={selectedMenuItem}
          userId={userId}
          currency={currency}
        />

        <MenuView
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedMenuItem(null);
          }}
          menuItem={selectedMenuItem}
          currency={currency}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedMenuItem(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedMenuItem?.name || 'this menu item'}
        />
    </div>
  );
};

export default MenuManagement;
