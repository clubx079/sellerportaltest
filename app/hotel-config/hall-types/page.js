"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, Building2, DollarSign, Users, Sparkles, Filter, Image as ImageIcon } from 'lucide-react';
import AddForm from '@/components/hotel-config/hall-types/AddForm';
import EditForm from '@/components/hotel-config/hall-types/EditForm';
import ViewForm from '@/components/hotel-config/hall-types/ViewForm';
import DeleteConfirmModal from '@/components/hotel-config/hall-types/DeleteConfirmModal';
import { getCurrentCurrencySymbol } from '@/lib/currency';

// Main Hall Types Page Component
const RoomTypesManagement = () => {
  const [hallTypes, setHallTypes] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedHallType, setSelectedHallType] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
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

  // Fetch hall types and amenities when userId is available
  useEffect(() => {
    if (userId) {
      fetchHallTypes();
      fetchAmenities();
    }
  }, [userId]);

  const fetchHallTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('hall_types')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: true });

      if (error) throw error;
      setHallTypes(data || []);
    } catch (error) {
      console.error('Error fetching hall types:', error);
      alert('Failed to fetch hall types. Please check your Supabase configuration.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAmenities = async () => {
    try {
      const { data, error } = await supabase
        .from('amenities')
        .select('id, name')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setAmenities(data || []);
    } catch (error) {
      console.error('Error fetching amenities:', error);
    }
  };

  // Filter hall types based on search term
  const filteredHallTypes = hallTypes.filter(hallType =>
    hallType.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hallType.short_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredHallTypes.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredHallTypes.length / entriesPerPage);

  // Handle delete
  const handleDeleteClick = (hallType) => {
    setSelectedHallType(hallType);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('hall_types')
        .delete()
        .eq('id', selectedHallType.id)
        .eq('user_id', userId);

      if (error) throw error;

      // Remove the deleted hall type from state instead of refetching
      setHallTypes(prev => prev.filter(rt => rt.id !== selectedHallType.id));
      setShowDeleteModal(false);
      setSelectedHallType(null);
    } catch (error) {
      console.error('Error deleting hall type:', error);
      alert('Failed to delete hall type: ' + error.message);
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Hall Types</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage hall categories</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Add Hall Type</span>
          </button>
        </div>

        {/* Compact Stats Cards - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Total Types</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{hallTypes.length}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Avg Price</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">
                  {currency}{hallTypes.length > 0 ? (hallTypes.reduce((sum, rt) => sum + (rt.best_price || 0), 0) / hallTypes.length).toFixed(0) : '0'}
                </p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Max Occupancy</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">
                  {Math.max(...hallTypes.map(rt => rt.higher_occupancy || 0), 0)}
                </p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">With Amenities</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">
                  {hallTypes.filter(rt => rt.amenities && rt.amenities.length > 0).length}
                </p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
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
                placeholder="Search by title or code..."
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
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Image</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Hall Type</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Code</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Occupancy</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Best Price</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Amenities</th>
                  <th className="px-3 md:px-5 py-2.5 md:py-3 text-right text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-3 md:h-4 w-6 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-10 w-10 md:h-12 md:w-12 bg-neutral-100 rounded-lg"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-20 md:w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-10 md:w-12 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-12 md:w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-12 md:w-14 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-3 md:h-4 w-6 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-14 md:w-16 bg-neutral-100 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : filteredHallTypes.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-3 md:px-5 py-6 md:py-10 text-center">
                      <Building2 className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-base font-medium">No hall types found</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Try adjusting your search or add a new hall type</p>
                    </td>
                  </tr>
                ) : (
                  filteredHallTypes.slice(0, entriesPerPage).map((hallType, index) => (
                    <tr key={hallType.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-medium text-neutral-400">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        {hallType.image ? (
                          <img
                            src={hallType.image}
                            alt={hallType.title}
                            className="w-7 h-7 md:w-8 md:h-8 rounded-lg object-cover border border-neutral-200"
                          />
                        ) : (
                          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-neutral-100 flex items-center justify-center border border-neutral-200">
                            <ImageIcon className="w-4 h-4 md:w-5 md:h-5 text-neutral-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <p className="text-xs md:text-sm font-medium text-neutral-900">{hallType.title}</p>
                        {hallType.description && (
                          <p className="text-[10px] md:text-xs text-neutral-400 line-clamp-1">{hallType.description}</p>
                        )}
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[10px] md:text-xs font-medium">
                          {hallType.short_code || 'N/A'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs md:text-sm">
                          <Users className="w-3 h-3 md:w-3.5 md:h-3.5 text-neutral-400" />
                          <span className="font-medium text-neutral-700">
                            {hallType.best_occupancy || 0}-{hallType.higher_occupancy || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-semibold text-neutral-900">
                          {currency}{hallType.best_price ? hallType.best_price.toFixed(2) : '0.00'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        {hallType.amenities && hallType.amenities.length > 0 ? (
                          <span className="text-xs md:text-sm font-medium text-neutral-700">{hallType.amenities.length}</span>
                        ) : (
                          <span className="text-xs md:text-sm text-neutral-400">None</span>
                        )}
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5 md:gap-1">
                          <button
                            onClick={() => {
                              setSelectedHallType(hallType);
                              setShowViewModal(true);
                            }}
                            className="p-1.5 md:p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedHallType(hallType);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 md:p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(hallType)}
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
              Showing <span className="font-medium text-neutral-700">{Math.min(filteredHallTypes.length, entriesPerPage)}</span> of{' '}
              <span className="font-medium text-neutral-700">{filteredHallTypes.length}</span> entries
            </div>
          </div>
        </div>

        {/* Forms */}
        <AddForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newHallType) => {
            // Add the new hall type to the state instead of refetching
            setHallTypes(prev => [...prev, newHallType]);
          }}
          amenities={amenities}
          userId={userId}
        />

        <EditForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedHallType(null);
          }}
          onSuccess={(updatedHallType) => {
            // Update the hall type in state instead of refetching
            setHallTypes(prev => prev.map(rt =>
              rt.id === updatedHallType.id ? updatedHallType : rt
            ));
          }}
          hallType={selectedHallType}
          amenities={amenities}
          userId={userId}
        />

        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedHallType(null);
          }}
          hallType={selectedHallType}
          amenities={amenities}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedHallType(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedHallType?.title || 'this hall type'}
        />
    </div>
  );
};

export default RoomTypesManagement;
