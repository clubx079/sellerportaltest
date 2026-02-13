"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, Building2, TrendingUp, CheckCircle, Hash, Filter } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AddForm from '@/components/hotel-config/floors/AddForm';
import EditForm from '@/components/hotel-config/floors/EditForm';
import ViewForm from '@/components/hotel-config/floors/ViewForm';
import DeleteConfirmModal from '@/components/hotel-config/floors/DeleteConfirmModal';

// Main Floor Management Page Component
const FloorManagement = () => {
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState(null);
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

  // Fetch floors from Supabase
  useEffect(() => {
    if (userId) {
      fetchFloors();
    }
  }, [userId]);

  const fetchFloors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('floors')
        .select('*')
        .eq('user_id', userId)
        .order('floor_number', { ascending: true });

      if (error) throw error;
      setFloors(data || []);
    } catch (error) {
      console.error('Error fetching floors:', error);
      alert('Failed to fetch floors. Please check your Supabase configuration.');
    } finally {
      setLoading(false);
    }
  };

  // Filter floors based on search term
  const filteredFloors = floors.filter(floor =>
    floor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    floor.floor_number.toString().includes(searchTerm)
  );

  // Get current entries (no pagination, just limit)
  const currentFloors = filteredFloors.slice(0, entriesPerPage);

  // Handle delete
  const handleDeleteClick = (floor) => {
    setSelectedFloor(floor);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('floors')
        .delete()
        .eq('id', selectedFloor.id)
        .eq('user_id', userId);

      if (error) throw error;

      // Remove the deleted floor from state instead of refetching
      setFloors(prev => prev.filter(f => f.id !== selectedFloor.id));
      setShowDeleteModal(false);
      setSelectedFloor(null);
    } catch (error) {
      console.error('Error deleting floor:', error);
      alert('Failed to delete floor: ' + error.message);
    }
  };

  // Calculate stats
  const totalFloors = floors.length;
  const activeFloors = floors.filter(f => f.is_active).length;
  const inactiveFloors = floors.filter(f => !f.is_active).length;
  const avgFloorNumber = floors.length > 0
    ? (floors.reduce((sum, f) => sum + (f.floor_number || 0), 0) / floors.length).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Floors</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage hotel floors and levels</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Add Floor</span>
          </button>
        </div>

        {/* Stats Cards - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Total Floors</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{totalFloors}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Active</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{activeFloors}</p>
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
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{inactiveFloors}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Hash className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Avg Floor</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{avgFloorNumber}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
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
                placeholder="Search by name or floor number..."
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
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Floor Number</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Description</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-3 md:px-5 py-2.5 md:py-3 text-right text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-3 md:h-4 w-6 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-24 md:w-32 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-12 md:w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-32 md:w-48 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-12 md:w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-14 md:w-20 bg-neutral-100 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : currentFloors.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-3 md:px-5 py-6 md:py-8 text-center">
                      <Building2 className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-base font-medium">No floors found</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Try adjusting your search or add a new floor</p>
                    </td>
                  </tr>
                ) : (
                  currentFloors.map((floor, index) => (
                    <tr key={floor.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-medium text-neutral-400">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-medium text-neutral-900">
                          {floor.name}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-medium text-neutral-900">
                          {floor.floor_number}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm text-neutral-600">
                          {floor.description || 'No description'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs font-medium ${
                          floor.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {floor.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5 md:gap-1">
                          <button
                            onClick={() => {
                              setSelectedFloor(floor);
                              setShowViewModal(true);
                            }}
                            className="p-1.5 md:p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 md:w-5 md:h-5 text-neutral-600" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedFloor(floor);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 md:p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 md:w-5 md:h-5 text-neutral-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(floor)}
                            className="p-1.5 md:p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 md:w-5 md:h-5 text-neutral-900" />
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
              Showing <span className="font-medium text-neutral-700">{Math.min(currentFloors.length, entriesPerPage)}</span> of{' '}
              <span className="font-medium text-neutral-700">{filteredFloors.length}</span> entries
            </div>
          </div>
        </div>

        {/* Forms */}
        <AddForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newFloor) => {
            // Add the new floor to the state instead of refetching
            setFloors(prev => [...prev, newFloor]);
          }}
          userId={userId}
        />

        <EditForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedFloor(null);
          }}
          onSuccess={(updatedFloor) => {
            // Update the floor in state instead of refetching
            setFloors(prev => prev.map(f =>
              f.id === updatedFloor.id ? updatedFloor : f
            ));
          }}
          floor={selectedFloor}
          userId={userId}
        />

        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedFloor(null);
          }}
          floor={selectedFloor}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedFloor(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedFloor?.name || 'this floor'}
        />
      </div>
  );
};

export default FloorManagement;
