"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, Sparkles, CheckCircle, XCircle, Filter, Image as ImageIcon } from 'lucide-react';
import AddForm from '@/components/hotel-config/amenities/AddForm';
import EditForm from '@/components/hotel-config/amenities/EditForm';
import ViewForm from '@/components/hotel-config/amenities/ViewForm';
import DeleteConfirmModal from '@/components/hotel-config/amenities/DeleteConfirmModal';

// Main Amenities Management Page Component
const AmenitiesManagement = () => {
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [userId, setUserId] = useState(null);

  // Get user ID from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('hotel_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
    }
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

  // Fetch amenities from Supabase
  useEffect(() => {
    if (userId) {
      fetchAmenities();
    }
  }, [userId]);

  const fetchAmenities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('amenities')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: true });

      if (error) throw error;
      setAmenities(data || []);
    } catch (error) {
      console.error('Error fetching amenities:', error);
      alert('Failed to fetch amenities. Please check your Supabase configuration.');
    } finally {
      setLoading(false);
    }
  };

  // Filter amenities based on search term
  const filteredAmenities = amenities.filter(amenity =>
    amenity.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get current entries (no pagination, just limit)
  const currentAmenities = filteredAmenities.slice(0, entriesPerPage);

  // Handle delete
  const handleDeleteClick = (amenity) => {
    setSelectedAmenity(amenity);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('amenities')
        .delete()
        .eq('id', selectedAmenity.id)
        .eq('user_id', userId);

      if (error) throw error;

      // Remove the deleted amenity from state instead of refetching
      setAmenities(prev => prev.filter(a => a.id !== selectedAmenity.id));
      setShowDeleteModal(false);
      setSelectedAmenity(null);
    } catch (error) {
      console.error('Error deleting amenity:', error);
      alert('Failed to delete amenity: ' + error.message);
    }
  };

  // Calculate stats
  const totalAmenities = amenities.length;
  const activeAmenities = amenities.filter(a => a.is_active).length;
  const inactiveAmenities = amenities.filter(a => !a.is_active).length;
  const withImages = amenities.filter(a => a.image).length;

  return (
      <div className="space-y-3 md:space-y-4">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Amenities</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage hotel amenities and services</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full sm:w-auto"
          >
            <Plus size={20} />
            <span>Add Amenity</span>
          </button>
        </div>

        {/* Stats Cards - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Total Amenities</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{totalAmenities}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Active</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{activeAmenities}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Inactive</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{inactiveAmenities}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">With Images</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{withImages}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <ImageIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
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
                placeholder="Search by amenity name..."
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-4 h-4" />
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
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Description</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-right text-xs md:text-sm font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 md:px-4 py-2.5"><div className="h-3 md:h-4 w-6 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-4 py-2.5"><div className="h-12 w-12 bg-neutral-100 rounded-lg"></div></td>
                      <td className="px-3 md:px-4 py-2.5"><div className="h-3 md:h-4 w-20 md:w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-4 py-2.5"><div className="h-3 md:h-4 w-32 md:w-40 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-4 py-2.5"><div className="h-3 md:h-4 w-12 md:w-14 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-4 py-2.5"><div className="h-3 md:h-4 w-14 md:w-16 bg-neutral-100 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : currentAmenities.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 md:px-6 py-8 md:py-10 text-center">
                      <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-xs md:text-sm font-medium">No amenities found</p>
                      <p className="text-xs md:text-xs md:text-sm text-neutral-400 mt-1">Try adjusting your search or add a new amenity</p>
                    </td>
                  </tr>
                ) : (
                  currentAmenities.map((amenity, index) => (
                    <tr key={amenity.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-medium text-neutral-400">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        {amenity.image ? (
                          <img
                            src={amenity.image}
                            alt={amenity.name}
                            className="w-10 h-10 md:w-12 md:h-12 object-cover rounded-lg border border-neutral-200"
                          />
                        ) : (
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-neutral-100 flex items-center justify-center border border-neutral-200">
                            <ImageIcon className="w-4 h-4 md:w-5 md:h-5 text-neutral-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-medium text-neutral-900">
                          {amenity.name}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm text-neutral-600 line-clamp-1 max-w-xs">
                          {amenity.description || 'No description'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          amenity.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {amenity.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedAmenity(amenity);
                              setShowViewModal(true);
                            }}
                            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedAmenity(amenity);
                              setShowEditModal(true);
                            }}
                            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(amenity)}
                            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
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
            <div className="text-xs md:text-[10px] md:text-xs text-neutral-500">
              Showing <span className="font-medium text-neutral-700">{Math.min(currentAmenities.length, entriesPerPage)}</span> of{' '}
              <span className="font-medium text-neutral-700">{filteredAmenities.length}</span> entries
            </div>
          </div>
        </div>

        {/* Forms */}
        <AddForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newAmenity) => {
            // Add the new amenity to the state instead of refetching
            setAmenities(prev => [...prev, newAmenity]);
          }}
          userId={userId}
        />

        <EditForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedAmenity(null);
          }}
          onSuccess={(updatedAmenity) => {
            // Update the amenity in state instead of refetching
            setAmenities(prev => prev.map(a =>
              a.id === updatedAmenity.id ? updatedAmenity : a
            ));
          }}
          amenity={selectedAmenity}
          userId={userId}
        />

        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedAmenity(null);
          }}
          amenity={selectedAmenity}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedAmenity(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedAmenity?.name || 'this amenity'}
        />
      </div>
  );
};

export default AmenitiesManagement;
