"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, DollarSign, Calendar, BedDouble, TrendingUp, Filter } from 'lucide-react';
import AddForm from '@/components/hotel-config/price-manager/AddForm';
import EditForm from '@/components/hotel-config/price-manager/EditForm';
import ViewForm from '@/components/hotel-config/price-manager/ViewForm';
import DeleteConfirmModal from '@/components/hotel-config/price-manager/DeleteConfirmModal';
import { getCurrentCurrencySymbol } from '@/lib/currency';

const PriceManagerManagement = () => {
  const [priceEntries, setPriceEntries] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [userId, setUserId] = useState(null);
  const [currency, setCurrency] = useState('$');

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

  // Get user_id from localStorage and set currency
  useEffect(() => {
    const userStr = localStorage.getItem('hotel_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
    }
    setCurrency(getCurrentCurrencySymbol());
  }, []);

  // Fetch data when userId is available
  useEffect(() => {
    if (userId) {
      fetchPriceEntries();
      fetchRoomTypes();
    }
  }, [userId]);

  const fetchPriceEntries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('price_manager')
        .select(`
          *,
          room_types (
            id,
            title
          )
        `)
        .eq('user_id', userId)
        .order('id', { ascending: true });

      if (error) throw error;
      setPriceEntries(data || []);
    } catch (error) {
      console.error('Error fetching price entries:', error);
      alert('Failed to fetch price entries. Please check your Supabase configuration.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoomTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('room_types')
        .select('id, title')
        .eq('user_id', userId)
        .order('title', { ascending: true });

      if (error) throw error;
      setRoomTypes(data || []);
    } catch (error) {
      console.error('Error fetching room types:', error);
    }
  };

  // Filter price entries based on search term
  const filteredEntries = priceEntries.filter(entry =>
    entry.room_types?.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Display entries (limited to entriesPerPage)
  const currentEntries = filteredEntries.slice(0, entriesPerPage);

  // Handle delete
  const handleDeleteClick = (entry) => {
    setSelectedEntry(entry);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('price_manager')
        .delete()
        .eq('id', selectedEntry.id)
        .eq('user_id', userId);

      if (error) throw error;

      setPriceEntries(prev => prev.filter(e => e.id !== selectedEntry.id));
      setShowDeleteModal(false);
      setSelectedEntry(null);
    } catch (error) {
      console.error('Error deleting price entry:', error);
      alert('Failed to delete price entry: ' + error.message);
    }
  };

  // Calculate stats
  const avgRegularPrice = priceEntries.length > 0
    ? (priceEntries.reduce((sum, e) => sum + (parseFloat(e.regular_price) || 0), 0) / priceEntries.length).toFixed(2)
    : '0.00';

  const avgSpecialPrice = priceEntries.length > 0
    ? (priceEntries.reduce((sum, e) => sum + (parseFloat(e.special_price) || 0), 0) / priceEntries.length).toFixed(2)
    : '0.00';

  const entriesWithSpecialPrice = priceEntries.filter(e => e.special_price && parseFloat(e.special_price) > 0).length;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Price Manager</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage room pricing and schedules</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Add Price Entry</span>
          </button>
        </div>

        {/* Stats Cards - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Total Entries</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{priceEntries.length}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Avg Regular</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{currency}{avgRegularPrice}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Avg Special</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{currency}{avgSpecialPrice}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">With Special</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{entriesWithSpecialPrice}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <BedDouble className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Controls - Responsive */}
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-neutral-400 hidden sm:block" />
              <select
                value={entriesPerPage}
                onChange={(e) => setEntriesPerPage(Number(e.target.value))}
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
                placeholder="Search by room type..."
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

          {/* Table - Scrollable */}
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[800px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">#</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Room Type</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Regular Price</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Special Price</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Start Date</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">End Date</th>
                  <th className="px-3 md:px-5 py-2.5 md:py-3 text-right text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-3 md:h-4 w-6 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-24 md:w-32 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-16 md:w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-16 md:w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-20 md:w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-20 md:w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-14 md:w-20 bg-neutral-100 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-3 md:px-5 py-6 md:py-10 text-center">
                      <DollarSign className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-base font-medium">No price entries found</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Try adjusting your search or add a new price entry</p>
                    </td>
                  </tr>
                ) : (
                  currentEntries.map((entry, index) => (
                    <tr key={entry.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-medium text-neutral-400">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <BedDouble className="w-4 h-4 md:w-5 md:h-5 text-neutral-400" />
                          <span className="text-xs md:text-sm font-medium text-neutral-900">
                            {entry.room_types?.title || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm text-neutral-700">
                          {currency}{entry.regular_price ? parseFloat(entry.regular_price).toFixed(2) : '0.00'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm text-neutral-700">
                          {currency}{entry.special_price ? parseFloat(entry.special_price).toFixed(2) : '0.00'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-neutral-400" />
                          <span className="text-xs md:text-sm text-neutral-700">
                            {formatDate(entry.start_date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-neutral-400" />
                          <span className="text-xs md:text-sm text-neutral-700">
                            {formatDate(entry.end_date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5 md:gap-1">
                          <button
                            onClick={() => {
                              setSelectedEntry(entry);
                              setShowViewModal(true);
                            }}
                            className="p-1.5 md:p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedEntry(entry);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 md:p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(entry)}
                            className="p-1.5 md:p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer - Responsive */}
          <div className="px-3 md:px-4 py-2 bg-neutral-50 border-t border-neutral-200">
            <div className="text-xs md:text-sm text-neutral-600">
              Showing <span className="font-medium text-neutral-700">{Math.min(filteredEntries.length, entriesPerPage)}</span> of{' '}
              <span className="font-medium text-neutral-700">{filteredEntries.length}</span> entries
            </div>
          </div>
        </div>

        {/* Forms */}
        <AddForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newEntry) => {
            setPriceEntries(prev => [...prev, newEntry]);
          }}
          roomTypes={roomTypes}
          userId={userId}
        />

        <EditForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedEntry(null);
          }}
          onSuccess={(updatedEntry) => {
            setPriceEntries(prev => prev.map(e =>
              e.id === updatedEntry.id ? updatedEntry : e
            ));
          }}
          priceEntry={selectedEntry}
          roomTypes={roomTypes}
          userId={userId}
        />

        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedEntry(null);
          }}
          priceEntry={selectedEntry}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedEntry(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedEntry?.room_types?.title || 'this price entry'}
        />
    </div>
  );
};

export default PriceManagerManagement;
