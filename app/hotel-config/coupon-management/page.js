"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, Tag, Calendar, Percent, TrendingUp, Filter, ChevronDown } from 'lucide-react';
import AddForm from '@/components/hotel-config/coupon-management/AddForm';
import EditForm from '@/components/hotel-config/coupon-management/EditForm';
import ViewForm from '@/components/hotel-config/coupon-management/ViewForm';
import DeleteConfirmModal from '@/components/hotel-config/coupon-management/DeleteConfirmModal';
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
                className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
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
const StatCard = ({ title, value, icon: Icon, bgColor, iconColor }) => {
  return (
    <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] md:text-xs text-neutral-500">{title}</p>
          <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5 truncate">{value}</p>
        </div>
        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
          <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
};

// Main Coupon Management Page Component
const CouponManagement = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [userId, setUserId] = useState(null);
  const [roomTypes, setRoomTypes] = useState([]);
  const [paidServices, setPaidServices] = useState([]);
  const [currency, setCurrency] = useState('$');

  // Get user ID from localStorage
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

  // Fetch coupons from Supabase
  useEffect(() => {
    if (userId) {
      fetchCoupons();
      fetchRoomTypes();
      fetchPaidServices();
    }
  }, [userId]);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: true });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      alert('Failed to fetch coupons. Please check your Supabase configuration.');
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

  const fetchPaidServices = async () => {
    try {
      const { data, error } = await supabase
        .from('paid_services')
        .select('id, title')
        .eq('user_id', userId)
        .order('title', { ascending: true });

      if (error) throw error;
      setPaidServices(data || []);
    } catch (error) {
      console.error('Error fetching paid services:', error);
    }
  };

  // Filter coupons based on search term
  const filteredCoupons = coupons.filter(coupon =>
    coupon.offer_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coupon.coupon_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Display entries (limited to entriesPerPage)
  const currentEntries = filteredCoupons.slice(0, entriesPerPage);

  // Entries per page options
  const entriesOptions = [
    { value: 10, label: '10 rows' },
    { value: 25, label: '25 rows' },
    { value: 50, label: '50 rows' },
    { value: 100, label: '100 rows' }
  ];

  // Handle delete
  const handleDeleteClick = (coupon) => {
    setSelectedCoupon(coupon);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', selectedCoupon.id)
        .eq('user_id', userId);

      if (error) throw error;

      // Remove the deleted coupon from state instead of refetching
      setCoupons(prev => prev.filter(c => c.id !== selectedCoupon.id));
      setShowDeleteModal(false);
      setSelectedCoupon(null);
    } catch (error) {
      console.error('Error deleting coupon:', error);
      alert('Failed to delete coupon: ' + error.message);
    }
  };

  // Calculate stats
  const avgCouponValue = coupons.length > 0
    ? (coupons.reduce((sum, c) => sum + (parseFloat(c.coupon_value) || 0), 0) / coupons.length).toFixed(2)
    : '0.00';

  const activeCoupons = coupons.filter(c => {
    if (!c.coupon_period) return true;
    // Parse date range format [start,end]
    const matches = c.coupon_period.match(/\[(.+?),(.+?)\]/);
    if (!matches) return true;
    const now = new Date();
    const start = new Date(matches[1]);
    const end = new Date(matches[2]);
    return now >= start && now <= end;
  }).length;

  const percentageCoupons = coupons.filter(c => c.coupon_type === 'percentage').length;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    // Clean the date string - remove quotes and trim
    const cleanedDate = dateString.replace(/"/g, '').trim();
    const date = new Date(cleanedDate);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const parseCouponPeriod = (dateRange) => {
    if (!dateRange) return { start: 'N/A', end: 'N/A' };

    // PostgreSQL DATERANGE format: ["2024-01-01","2024-12-31") or [2024-01-01,2024-12-31)
    // Can also be: ["2024-01-01 00:00:00","2024-12-31 00:00:00"]
    // Match various formats: [start,end], ["start","end"], with ) or ] at end
    const matches = dateRange.match(/[\[\(]["']?([^"',\[\]()]+)["']?\s*,\s*["']?([^"',\[\]()]+)["']?[\]\)]/);

    if (matches) {
      return {
        start: formatDate(matches[1]),
        end: formatDate(matches[2])
      };
    }
    return { start: 'N/A', end: 'N/A' };
  };

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Coupon Management</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage discount coupons and offers</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Coupon
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            title="Total Coupons"
            value={coupons.length}
            icon={Tag}
            bgColor="bg-[#472F97]"
            iconColor="text-white"
          />
          <StatCard
            title="Average Value"
            value={avgCouponValue}
            icon={TrendingUp}
            bgColor="bg-[#472F97]"
            iconColor="text-white"
          />
          <StatCard
            title="Active Coupons"
            value={activeCoupons}
            icon={Calendar}
            bgColor="bg-[#472F97]"
            iconColor="text-white"
          />
          <StatCard
            title="Percentage Type"
            value={percentageCoupons}
            icon={Percent}
            bgColor="bg-[#472F97]"
            iconColor="text-white"
          />
        </div>

        {/* Table Card */}
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
                  className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  placeholder="Search by title or code..."
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
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Offer Title</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Coupon Code</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Type</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Value</th>
                  <th className="px-3 py-2.5 text-left text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Period</th>
                  <th className="px-3 py-2.5 text-right text-[10px] md:text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-3 sm:px-4 py-8 text-center">
                      <div className="flex items-center justify-center gap-2 text-neutral-500">
                        <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs sm:text-sm font-medium">Loading coupons...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-3 sm:px-4 py-8 text-center">
                      <Tag className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 font-medium text-xs sm:text-sm">No coupons found</p>
                      <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">Try adjusting your search or add a new coupon</p>
                    </td>
                  </tr>
                ) : (
                  currentEntries.map((coupon, index) => {
                    const period = parseCouponPeriod(coupon.coupon_period);
                    return (
                      <tr key={coupon.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-3 py-2.5">
                          <span className="text-xs sm:text-sm font-medium text-neutral-500">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-neutral-400" />
                            <span className="text-xs sm:text-sm font-medium text-neutral-900">
                              {coupon.offer_title || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium bg-neutral-100 text-neutral-700">
                            {coupon.coupon_code || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs sm:text-sm text-neutral-900 capitalize">
                            {coupon.coupon_type || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            {coupon.coupon_type === 'percentage' ? (
                              <Percent className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-600" />
                            ) : (
                              <span className="text-xs sm:text-sm text-green-600">{currency}</span>
                            )}
                            <span className="text-xs sm:text-sm font-semibold text-green-700">
                              {coupon.coupon_value || '0'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-[10px] sm:text-xs">
                            <div className="flex items-center gap-1 text-neutral-600">
                              <Calendar className="w-3 h-3" />
                              <span>{period.start}</span>
                            </div>
                            <div className="flex items-center gap-1 text-neutral-500 mt-0.5">
                              <span>to {period.end}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setSelectedCoupon(coupon);
                                setShowViewModal(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-all duration-200"
                              title="View"
                            >
                              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCoupon(coupon);
                                setShowEditModal(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-all duration-200"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(coupon)}
                              className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-all duration-200"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-3 sm:px-4 py-2.5 bg-neutral-50 border-t border-neutral-200">
            <div className="text-xs sm:text-sm text-neutral-500">
              Showing {filteredCoupons.length} of {coupons.length} entries
            </div>
          </div>
        </div>

        {/* Forms */}
        <AddForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newCoupon) => {
            // Add the new coupon to the state instead of refetching
            setCoupons(prev => [...prev, newCoupon]);
          }}
          roomTypes={roomTypes}
          paidServices={paidServices}
          userId={userId}
        />

        <EditForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCoupon(null);
          }}
          onSuccess={(updatedCoupon) => {
            // Update the coupon in state instead of refetching
            setCoupons(prev => prev.map(c =>
              c.id === updatedCoupon.id ? updatedCoupon : c
            ));
          }}
          coupon={selectedCoupon}
          roomTypes={roomTypes}
          paidServices={paidServices}
          userId={userId}
        />

        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedCoupon(null);
          }}
          coupon={selectedCoupon}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedCoupon(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedCoupon?.offer_title || 'this coupon'}
        />
      </div>
  );
};

export default CouponManagement;
