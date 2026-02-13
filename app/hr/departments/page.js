"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, Briefcase, Building2, Users, TrendingUp, ChevronDown } from 'lucide-react';
import AddForm from '@/components/hr/departments/AddForm';
import EditForm from '@/components/hr/departments/EditForm';
import ViewForm from '@/components/hr/departments/ViewForm';
import DeleteConfirmModal from '@/components/hr/departments/DeleteConfirmModal';

// Searchable Select Component
const SearchableSelect = ({ value, onChange, options, placeholder, getOptionLabel, getOptionValue, className }) => {
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
    getOptionLabel(option).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOption = options.find(option => getOptionValue(option) === value);

  return (
    <div ref={dropdownRef} className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer hover:border-neutral-300 transition-colors flex items-center justify-between gap-2 ${className || ''}`}
      >
        <span className={selectedOption ? 'text-neutral-900' : 'text-neutral-400'}>
          {selectedOption ? getOptionLabel(selectedOption) : placeholder}
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
                className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-neutral-500 text-center">No options found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={getOptionValue(option)}
                  onClick={() => {
                    onChange(getOptionValue(option));
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-neutral-100 transition-colors ${
                    getOptionValue(option) === value ? 'bg-neutral-50 font-medium' : ''
                  }`}
                >
                  {getOptionLabel(option)}
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
    <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] md:text-xs text-neutral-500">{title}</p>
          <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{value}</p>
        </div>
        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
        </div>
      </div>
    </div>
  );
};

// Main Department Management Page Component
const DepartmentManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [userId, setUserId] = useState(null);

  // Get userId from localStorage
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

  // Fetch departments when userId is available
  useEffect(() => {
    if (userId) {
      fetchDepartments();
    }
  }, [userId]);

  const fetchDepartments = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter departments based on search term
  const filteredDepartments = departments.filter(dept =>
    dept.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredDepartments.slice(indexOfFirstEntry, indexOfLastEntry);

  // Handle delete
  const handleDeleteClick = (department) => {
    setSelectedDepartment(department);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', selectedDepartment.id)
        .eq('user_id', userId);

      if (error) throw error;

      setDepartments(prev => prev.filter(d => d.id !== selectedDepartment.id));
      setShowDeleteModal(false);
      setSelectedDepartment(null);
    } catch (error) {
      console.error('Error deleting department:', error);
    }
  };

  // Calculate stats
  const totalDepartments = departments.length;

  // Entries per page options
  const entriesOptions = [
    { value: 10, label: '10 rows' },
    { value: 25, label: '25 rows' },
    { value: 50, label: '50 rows' },
    { value: 100, label: '100 rows' }
  ];

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Department Management</h1>
            <p className="text-xs text-neutral-500">Manage organizational departments</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Department
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <StatCard
            title="Total Departments"
            value={totalDepartments}
            icon={Briefcase}
          />
          <StatCard
            title="Active"
            value={totalDepartments}
            icon={TrendingUp}
          />
          <StatCard
            title="Categories"
            value={totalDepartments}
            icon={Building2}
          />
          <StatCard
            title="Teams"
            value={totalDepartments}
            icon={Users}
          />
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Controls */}
          <div className="px-3 md:px-4 py-2.5 border-b border-neutral-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 md:gap-3">
            <div className="flex items-center gap-3">
              <SearchableSelect
                value={entriesPerPage}
                onChange={(value) => {
                  setEntriesPerPage(value);
                  setCurrentPage(1);
                }}
                options={entriesOptions}
                placeholder="Rows per page"
                getOptionLabel={(option) => option.label}
                getOptionValue={(option) => option.value}
                className="text-xs sm:text-sm min-w-[100px] sm:min-w-[120px]"
              />
            </div>

            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-8 sm:pr-10 py-1.5 sm:py-2 text-xs sm:text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-transparent"
                placeholder="Search by department name..."
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider">#</th>
                  <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider">Department Name</th>
                  <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td colSpan="3" className="px-4 py-8 text-center">
                      <div className="flex items-center justify-center gap-2 text-neutral-500">
                        <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs sm:text-sm font-medium">Loading departments...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-4 py-8 text-center">
                      <Briefcase className="w-7 h-7 md:w-8 md:h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 font-medium text-xs sm:text-sm">No departments found</p>
                      <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">Try adjusting your search or add a new department</p>
                    </td>
                  </tr>
                ) : (
                  currentEntries.map((department, index) => (
                    <tr
                      key={department.id}
                      className="hover:bg-neutral-50 transition-colors"
                    >
                      <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3">
                        <span className="text-xs sm:text-sm font-medium text-neutral-500">
                          {indexOfFirstEntry + index + 1}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-neutral-100 flex items-center justify-center">
                            <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-600" />
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-neutral-900">
                            {department.name || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3">
                        <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                          <button
                            onClick={() => {
                              setSelectedDepartment(department);
                              setShowViewModal(true);
                            }}
                            className="p-1 sm:p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDepartment(department);
                              setShowEditModal(true);
                            }}
                            className="p-1 sm:p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(department)}
                            className="p-1 sm:p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors"
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
          <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-neutral-50 border-t border-neutral-200">
            <div className="text-xs text-neutral-500">
              Showing {filteredDepartments.length} of {departments.length} entries
            </div>
          </div>
        </div>

        {/* Modals */}
        <AddForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newDepartment) => {
            setDepartments(prev => [...prev, newDepartment]);
          }}
          userId={userId}
        />

        <EditForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedDepartment(null);
          }}
          onSuccess={(updatedDepartment) => {
            setDepartments(prev => prev.map(d =>
              d.id === updatedDepartment.id ? updatedDepartment : d
            ));
          }}
          department={selectedDepartment}
        />

        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedDepartment(null);
          }}
          department={selectedDepartment}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedDepartment(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedDepartment?.name || 'this department'}
        />
      </div>
  );
};

export default DepartmentManagement;
