"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, Building2, Layers, BedDouble, Home, ShieldCheck, Filter } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AddForm from '@/components/hotel-config/rooms/AddForm';
import EditForm from '@/components/hotel-config/rooms/EditForm';
import ViewForm from '@/components/hotel-config/rooms/ViewForm';
import DeleteConfirmModal from '@/components/hotel-config/rooms/DeleteConfirmModal';
import HousekeepingModal from '@/components/hotel-config/rooms/HousekeepingModal';

// Main Rooms Management Component
const RoomsManagement = () => {
  const [rooms, setRooms] = useState([]);
  const [floors, setFloors] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showHousekeepingModal, setShowHousekeepingModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [userId, setUserId] = useState(null);

  // Prevent body scroll when any modal is open
  useEffect(() => {
    if (showAddModal || showEditModal || showViewModal || showDeleteModal || showHousekeepingModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAddModal, showEditModal, showViewModal, showDeleteModal, showHousekeepingModal]);

  // Get user_id from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('hotel_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
    }
  }, []);

  // Fetch all data when userId is available
  useEffect(() => {
    if (userId) {
      fetchRooms();
      fetchFloors();
      fetchRoomTypes();
      fetchEmployees();
    }
  }, [userId]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(`
          *,
          floors (name, floor_number),
          room_types (title, short_code)
        `)
        .eq('user_id', userId)
        .order('id', { ascending: true });

      if (roomsError) throw roomsError;

      // Fetch employees separately and map them to rooms
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('user_id', userId);

      const employeesMap = {};
      (employeesData || []).forEach(emp => {
        employeesMap[emp.id] = emp;
      });

      // Map employees to rooms
      const roomsWithEmployees = (roomsData || []).map(room => ({
        ...room,
        employees: room.assigned_to ? employeesMap[room.assigned_to] : null
      }));

      setRooms(roomsWithEmployees);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      alert('Failed to fetch rooms.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFloors = async () => {
    try {
      const { data, error } = await supabase
        .from('floors')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('floor_number', { ascending: true });

      if (error) throw error;
      setFloors(data || []);
    } catch (error) {
      console.error('Error fetching floors:', error);
    }
  };

  const fetchRoomTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('room_types')
        .select('*')
        .eq('user_id', userId)
        .order('title', { ascending: true });

      if (error) throw error;
      setRoomTypes(data || []);
    } catch (error) {
      console.error('Error fetching room types:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('user_id', userId)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Filter rooms based on search term
  const filteredRooms = rooms.filter(room =>
    room.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.room_types?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.floors?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredRooms.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredRooms.length / entriesPerPage);

  // Handle delete
  const handleDeleteClick = (room) => {
    setSelectedRoom(room);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', selectedRoom.id)
        .eq('user_id', userId);

      if (error) throw error;

      // Remove the deleted room from state instead of refetching
      setRooms(prev => prev.filter(r => r.id !== selectedRoom.id));
      setShowDeleteModal(false);
      setSelectedRoom(null);
    } catch (error) {
      console.error('Error deleting room:', error);
      alert('Failed to delete room: ' + error.message);
    }
  };

  const getHousekeepingStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'clean':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'dirty':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'inspected':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'out of service':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Rooms</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage hotel rooms</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Add Room</span>
          </button>
        </div>

        {/* Compact Stats Cards - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Total Rooms</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{rooms.length}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <BedDouble className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Floors</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{floors.length}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Room Types</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{roomTypes.length}</p>
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
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">
                  {rooms.filter(r => r.is_active).length}
                </p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Home className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
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
                placeholder="Search by room number, type, or floor..."
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
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Room Number</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Room Type</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Floor</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Assigned To</th>
                  <th className="px-3 md:px-5 py-2.5 md:py-3 text-right text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-3 md:h-4 w-6 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-12 md:w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-20 md:w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-16 md:w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-12 md:w-14 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-16 md:w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-14 md:w-16 bg-neutral-100 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : filteredRooms.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-3 md:px-5 py-6 md:py-10 text-center">
                      <BedDouble className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-base font-medium">No rooms found</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Try adjusting your search or add a new room</p>
                    </td>
                  </tr>
                ) : (
                  filteredRooms.slice(0, entriesPerPage).map((room, index) => (
                    <tr key={room.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-medium text-neutral-400">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-medium text-neutral-900">
                          {room.room_number}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <div>
                          <p className="text-xs md:text-sm font-medium text-neutral-900">{room.room_types?.title || 'N/A'}</p>
                          {room.room_types?.short_code && (
                            <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[10px] md:text-xs font-medium mt-0.5">
                              {room.room_types.short_code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm text-neutral-700">
                          {room.floors?.floor_number ? `${room.floors.floor_number} - ${room.floors.name}` : 'N/A'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium border ${getHousekeepingStatusColor(room.housekeeping_status)}`}>
                          {room.housekeeping_status?.charAt(0).toUpperCase() + room.housekeeping_status?.slice(1) || 'Clean'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm text-neutral-700">
                          {room.employees ? room.employees.full_name : 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5 md:gap-1">
                          <button
                            onClick={() => {
                              setSelectedRoom(room);
                              setShowViewModal(true);
                            }}
                            className="p-1.5 md:p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRoom(room);
                              setShowHousekeepingModal(true);
                            }}
                            className="p-1.5 md:p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Housekeeping"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRoom(room);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 md:p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(room)}
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
              Showing <span className="font-medium text-neutral-700">{Math.min(filteredRooms.length, entriesPerPage)}</span> of{' '}
              <span className="font-medium text-neutral-700">{filteredRooms.length}</span> entries
            </div>
          </div>
        </div>

        {/* Forms */}
        <AddForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newRooms) => {
            setRooms(prev => [...prev, ...newRooms]);
          }}
          floors={floors}
          roomTypes={roomTypes}
          userId={userId}
        />

        <EditForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedRoom(null);
          }}
          onSuccess={(updatedRoom) => {
            setRooms(prev => prev.map(r =>
              r.id === updatedRoom.id ? { ...r, ...updatedRoom } : r
            ));
          }}
          room={selectedRoom}
          floors={floors}
          roomTypes={roomTypes}
          userId={userId}
        />

        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedRoom(null);
          }}
          room={selectedRoom}
        />

        <HousekeepingModal
          isOpen={showHousekeepingModal}
          onClose={() => {
            setShowHousekeepingModal(false);
            setSelectedRoom(null);
          }}
          onSuccess={(updatedRoom) => {
            setRooms(prev => prev.map(r =>
              r.id === updatedRoom.id ? { ...r, ...updatedRoom } : r
            ));
          }}
          room={selectedRoom}
          employees={employees}
          userId={userId}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedRoom(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedRoom?.room_number || 'this room'}
        />
      </div>
  );
};

export default RoomsManagement;
