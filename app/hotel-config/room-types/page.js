"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, BedDouble, DollarSign, Users, Sparkles, Filter, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import AddForm from '@/components/hotel-config/room-types/AddForm';
import EditForm from '@/components/hotel-config/room-types/EditForm';
import ViewForm from '@/components/hotel-config/room-types/ViewForm';
import DeleteConfirmModal from '@/components/hotel-config/room-types/DeleteConfirmModal';

const RoomTypesManagement = () => {
  const [roomTypes, setRoomTypes] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
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
      fetchRoomTypes();
      fetchAmenities();
    }
  }, [userId]);

  const fetchRoomTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('room_types')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: true });

      if (error) throw error;
      setRoomTypes(data || []);
    } catch (error) {
      console.error('Error fetching room types:', error);
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

  const filteredRoomTypes = roomTypes.filter(roomType =>
    roomType.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    roomType.short_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteClick = (roomType) => {
    setSelectedRoomType(roomType);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('room_types')
        .delete()
        .eq('id', selectedRoomType.id)
        .eq('user_id', userId);

      if (error) throw error;

      setRoomTypes(prev => prev.filter(rt => rt.id !== selectedRoomType.id));
      setShowDeleteModal(false);
      setSelectedRoomType(null);
    } catch (error) {
      console.error('Error deleting room type:', error);
      alert('Failed to delete room type: ' + error.message);
    }
  };

  return (
      <div className="space-y-6 md:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Room Types</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage your accommodation categories</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Add Room Type</span>
          </button>
        </div>

        {/* Compact Stats Cards - Responsive grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-neutral-600">Total Types</p>
                <p className="text-base md:text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{roomTypes.length}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <BedDouble className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-neutral-600">Average Price</p>
                <p className="text-base md:text-base md:text-lg font-semibold text-neutral-900 mt-0.5">
                  {currency}{roomTypes.length > 0 ? (roomTypes.reduce((sum, rt) => sum + (rt.base_price || 0), 0) / roomTypes.length).toFixed(0) : '0'}
                </p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-neutral-600">Max Occupancy</p>
                <p className="text-base md:text-base md:text-lg font-semibold text-neutral-900 mt-0.5">
                  {Math.max(...roomTypes.map(rt => rt.higher_occupancy || 0), 0)}
                </p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-neutral-600">With Amenities</p>
                <p className="text-base md:text-base md:text-lg font-semibold text-neutral-900 mt-0.5">
                  {roomTypes.filter(rt => rt.amenities && rt.amenities.length > 0).length}
                </p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white" />
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

          {/* Table */}
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[700px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Image</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Room Type</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Code</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Occupancy</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Price</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Amenities</th>
                  <th className="px-3 py-2.5 text-right text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 py-2.5"><div className="h-3 md:h-4 w-6 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-10 w-10 bg-neutral-100 rounded-lg"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-12 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-4 w-10 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-3 md:h-4 w-12 md:w-14 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-3 md:h-4 w-6 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 py-2.5"><div className="h-3 md:h-4 w-14 md:w-16 bg-neutral-100 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : filteredRoomTypes.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-3 md:px-5 py-8 md:py-10 text-center">
                      <BedDouble className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-base font-medium">No room types found</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Try adjusting your search or add a new room type</p>
                    </td>
                  </tr>
                ) : (
                  filteredRoomTypes.slice(0, entriesPerPage).map((roomType, index) => (
                    <tr key={roomType.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-medium text-neutral-400">{index + 1}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {roomType.image ? (
                          <img
                            src={roomType.image}
                            alt={roomType.title}
                            className="w-10 h-10 rounded-lg object-cover border border-neutral-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center border border-neutral-200">
                            <ImageIcon className="w-4 h-4 text-neutral-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <p className="text-xs font-medium text-neutral-900">{roomType.title}</p>
                        {roomType.slug && (
                          <p className="text-[10px] text-neutral-400 truncate max-w-[120px]">{roomType.slug}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[10px] font-medium">
                          {roomType.short_code || 'N/A'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-xs">
                          <Users className="w-3 h-3 text-neutral-400" />
                          <span className="font-medium text-neutral-700">
                            {roomType.base_occupancy || 0}-{roomType.higher_occupancy || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-neutral-900">
                          {currency}{roomType.base_price ? roomType.base_price.toFixed(0) : '0'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {roomType.amenities && roomType.amenities.length > 0 ? (
                          <span className="text-xs font-medium text-neutral-700">{roomType.amenities.length}</span>
                        ) : (
                          <span className="text-xs text-neutral-400">None</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => {
                              setSelectedRoomType(roomType);
                              setShowViewModal(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRoomType(roomType);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(roomType)}
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

          {/* Footer - Just showing count, no pagination */}
          <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-200">
            <div className="text-xs text-neutral-500">
              Showing <span className="font-medium text-neutral-700">{Math.min(filteredRoomTypes.length, entriesPerPage)}</span> of{' '}
              <span className="font-medium text-neutral-700">{filteredRoomTypes.length}</span> entries
            </div>
          </div>
        </div>

        {/* Forms */}
        <AddForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newRoomType) => {
            setRoomTypes(prev => [...prev, newRoomType]);
          }}
          amenities={amenities}
          userId={userId}
        />

        <EditForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedRoomType(null);
          }}
          onSuccess={(updatedRoomType) => {
            setRoomTypes(prev => prev.map(rt =>
              rt.id === updatedRoomType.id ? updatedRoomType : rt
            ));
          }}
          roomType={selectedRoomType}
          amenities={amenities}
          userId={userId}
        />

        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedRoomType(null);
          }}
          roomType={selectedRoomType}
          amenities={amenities}
          currency={currency}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedRoomType(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedRoomType?.title || 'this room type'}
        />
      </div>
  );
};

export default RoomTypesManagement;
