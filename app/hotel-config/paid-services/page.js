"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, Briefcase, DollarSign, BedDouble, CheckCircle, Filter } from 'lucide-react';
import AddForm from '@/components/hotel-config/paid-services/AddForm';
import EditForm from '@/components/hotel-config/paid-services/EditForm';
import ViewForm from '@/components/hotel-config/paid-services/ViewForm';
import DeleteConfirmModal from '@/components/hotel-config/paid-services/DeleteConfirmModal';
import { getCurrentCurrencySymbol } from '@/lib/currency';

// Main Paid Services Component
const PaidServicesManagement = () => {
  const [services, setServices] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [userId, setUserId] = useState(null);
  const [currency, setCurrency] = useState('$');

  // Get user ID from localStorage and set currency
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

  // Fetch services and room types from Supabase
  useEffect(() => {
    if (userId) {
      fetchServices();
      fetchRoomTypes();
    }
  }, [userId]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('paid_services')
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
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching paid services:', error);
      alert('Failed to fetch paid services. Please check your Supabase configuration.');
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

  // Filter services based on search term
  const filteredServices = services.filter(service =>
    service.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Display entries (limited to entriesPerPage)
  const currentEntries = filteredServices.slice(0, entriesPerPage);

  // Handle delete
  const handleDeleteClick = (service) => {
    setSelectedService(service);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('paid_services')
        .delete()
        .eq('id', selectedService.id)
        .eq('user_id', userId);

      if (error) throw error;

      // Remove the deleted service from state instead of refetching
      setServices(prev => prev.filter(s => s.id !== selectedService.id));
      setShowDeleteModal(false);
      setSelectedService(null);
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Failed to delete paid service: ' + error.message);
    }
  };

  // Calculate stats
  const totalServices = services.length;
  const activeServices = services.filter(s => s.status).length;
  const servicesWithRoomType = services.filter(s => s.room_type_id).length;
  const avgPrice = services.length > 0
    ? (services.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0) / services.length).toFixed(2)
    : '0.00';

  const getPriceTypeLabel = (priceType) => {
    const types = {
      'per_day': 'Per Day',
      'flat': 'Flat',
      'per_hour': 'Per Hour'
    };
    return types[priceType] || 'N/A';
  };

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Paid Services</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage additional hotel services</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Add Service</span>
          </button>
        </div>

        {/* Stats Cards - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Total Services</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{totalServices}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Avg Price</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{currency}{avgPrice}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Active</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{activeServices}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">With Room Type</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{servicesWithRoomType}</p>
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
                placeholder="Search by service title..."
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
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Title</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Room Type</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Price Type</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Price</th>
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
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-20 md:w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-16 md:w-20 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-12 md:w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-12 md:w-16 bg-neutral-100 rounded"></div></td>
                      <td className="px-3 md:px-5 py-2.5 md:py-3"><div className="h-4 w-14 md:w-16 bg-neutral-100 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-3 md:px-5 py-6 md:py-10 text-center">
                      <Briefcase className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-base font-medium">No services found</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Try adjusting your search or add a new service</p>
                    </td>
                  </tr>
                ) : (
                  currentEntries.map((service, index) => (
                    <tr key={service.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-medium text-neutral-400">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-medium text-neutral-900">
                          {service.title}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        {service.room_types ? (
                          <span className="text-xs md:text-sm text-neutral-700">
                            {service.room_types.title}
                          </span>
                        ) : (
                          <span className="text-xs md:text-sm text-neutral-400">N/A</span>
                        )}
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[10px] md:text-xs font-medium">
                          {getPriceTypeLabel(service.price_type)}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs md:text-sm font-semibold text-neutral-900">
                          {currency}{service.price ? parseFloat(service.price).toFixed(2) : '0.00'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium border ${
                          service.status
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-red-100 text-red-700 border-red-200'
                        }`}>
                          {service.status ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5 md:gap-1">
                          <button
                            onClick={() => {
                              setSelectedService(service);
                              setShowViewModal(true);
                            }}
                            className="p-1.5 md:p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedService(service);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 md:p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(service)}
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
              Showing <span className="font-medium text-neutral-700">{Math.min(filteredServices.length, entriesPerPage)}</span> of{' '}
              <span className="font-medium text-neutral-700">{filteredServices.length}</span> entries
            </div>
          </div>
        </div>

        {/* Forms */}
        <AddForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newService) => {
            // Add the new service to the state instead of refetching
            setServices(prev => [...prev, newService]);
          }}
          roomTypes={roomTypes}
          userId={userId}
        />

        <EditForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedService(null);
          }}
          onSuccess={(updatedService) => {
            // Update the service in state instead of refetching
            setServices(prev => prev.map(s =>
              s.id === updatedService.id ? updatedService : s
            ));
          }}
          service={selectedService}
          roomTypes={roomTypes}
          userId={userId}
        />

        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedService(null);
          }}
          service={selectedService}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedService(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedService?.title || 'this service'}
        />
    </div>
  );
};

export default PaidServicesManagement;
