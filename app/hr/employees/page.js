"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Eye, Search, X, Users, UserCheck, UserCog, Briefcase, Filter } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AddForm from '@/components/hr/employees/AddForm';
import EditForm from '@/components/hr/employees/EditForm';
import ViewForm from '@/components/hr/employees/ViewForm';
import DeleteConfirmModal from '@/components/hr/employees/DeleteConfirmModal';

// Main Employee Management Page Component
const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
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

  // Fetch data when userId is available
  useEffect(() => {
    if (userId) {
      fetchEmployees();
      fetchDepartments();
      fetchDesignations();
    }
  }, [userId]);

  const fetchEmployees = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          departments (id, name),
          designations (id, name)
        `)
        .eq('user_id', userId)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchDesignations = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('designations')
        .select('id, name')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;
      setDesignations(data || []);
    } catch (error) {
      console.error('Error fetching designations:', error);
    }
  };

  // Filter employees based on search term and department
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch =
      employee.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.departments?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.designations?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDepartment = !departmentFilter || employee.department_id?.toString() === departmentFilter;

    return matchesSearch && matchesDepartment;
  });

  // Get current entries (no pagination, just limit)
  const currentEntries = filteredEmployees.slice(0, entriesPerPage);

  // Handle delete
  const handleDeleteClick = (employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', selectedEmployee.id)
        .eq('user_id', userId);

      if (error) throw error;

      setEmployees(prev => prev.filter(e => e.id !== selectedEmployee.id));
      setShowDeleteModal(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Error deleting employee:', error);
    }
  };

  // Calculate stats
  const totalEmployees = employees.length;
  const uniqueDepartments = new Set(employees.map(e => e.department_id).filter(Boolean)).size;
  const uniqueDesignations = new Set(employees.map(e => e.designation_id).filter(Boolean)).size;
  const activeEmployees = employees.length;

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-neutral-900">Employee Management</h1>
            <p className="text-xs text-neutral-500">Manage employee records and information</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#472F97] hover:bg-[#3a2578] text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Total Employees</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{totalEmployees}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Active Employees</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{activeEmployees}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <UserCheck className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Departments</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{uniqueDepartments}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-[#F5F3FF] rounded-xl border border-neutral-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-neutral-500">Designations</p>
                <p className="text-base md:text-lg font-semibold text-neutral-900 mt-0.5">{uniqueDesignations}</p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#472F97] flex items-center justify-center">
                <UserCog className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Controls */}
          <div className="px-3 md:px-4 py-2.5 border-b border-neutral-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 md:gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <Filter className="w-4 h-4 text-neutral-400 hidden sm:block" />
              <select
                value={entriesPerPage}
                onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                className="text-xs sm:text-sm border border-neutral-200 rounded-lg px-2 sm:px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
              >
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
              </select>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="text-xs sm:text-sm border border-neutral-200 rounded-lg px-2 sm:px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white w-full sm:w-auto sm:min-w-[150px]"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id.toString()}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-9 pr-8 sm:pr-9 py-1.5 text-xs sm:text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                placeholder="Search by name, email..."
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
                  <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider">Name</th>
                  <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Email</th>
                  <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Phone</th>
                  <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden sm:table-cell">Department</th>
                  <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden xl:table-cell">Designation</th>
                  <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-3"><div className="h-4 w-6 bg-neutral-100 rounded"></div></td>
                      <td className="px-4 py-3"><div className="h-4 w-28 bg-neutral-100 rounded"></div></td>
                      <td className="px-4 py-3"><div className="h-4 w-36 bg-neutral-100 rounded"></div></td>
                      <td className="px-4 py-3"><div className="h-4 w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-4 py-3"><div className="h-4 w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-4 py-3"><div className="h-4 w-24 bg-neutral-100 rounded"></div></td>
                      <td className="px-4 py-3"><div className="h-4 w-16 bg-neutral-100 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center">
                      <Users className="w-7 h-7 md:w-8 md:h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-sm font-medium">No employees found</p>
                      <p className="text-xs text-neutral-400 mt-1">Try adjusting your search or add a new employee</p>
                    </td>
                  </tr>
                ) : (
                  currentEntries.map((employee, index) => (
                    <tr key={employee.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3">
                        <span className="text-xs sm:text-sm text-neutral-400">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-neutral-400" />
                          <span className="text-xs sm:text-sm font-medium text-neutral-900">
                            {employee.full_name || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 hidden md:table-cell">
                        <span className="text-xs sm:text-sm text-neutral-600">
                          {employee.email || 'N/A'}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 hidden lg:table-cell">
                        <span className="text-xs sm:text-sm text-neutral-600">
                          {employee.phone || 'N/A'}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 hidden sm:table-cell">
                        <span className="text-xs sm:text-sm text-neutral-600">
                          {employee.departments?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 hidden xl:table-cell">
                        <span className="text-xs sm:text-sm text-neutral-600">
                          {employee.designations?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3">
                        <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                          <button
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setShowViewModal(true);
                            }}
                            className="p-1 sm:p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setShowEditModal(true);
                            }}
                            className="p-1 sm:p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(employee)}
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
              Showing <span className="font-medium text-neutral-700">{Math.min(currentEntries.length, entriesPerPage)}</span> of{' '}
              <span className="font-medium text-neutral-700">{filteredEmployees.length}</span> entries
            </div>
          </div>
        </div>

        {/* Modals */}
        <AddForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newEmployee) => {
            setEmployees(prev => [...prev, newEmployee]);
          }}
          departments={departments}
          designations={designations}
          userId={userId}
        />

        <EditForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedEmployee(null);
          }}
          onSuccess={(updatedEmployee) => {
            setEmployees(prev => prev.map(e =>
              e.id === updatedEmployee.id ? updatedEmployee : e
            ));
          }}
          employee={selectedEmployee}
          departments={departments}
          designations={designations}
          userId={userId}
        />

        <ViewForm
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedEmployee(null);
          }}
          employee={selectedEmployee}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedEmployee(null);
          }}
          onConfirm={handleDeleteConfirm}
          itemName={selectedEmployee?.full_name || 'this employee'}
        />
      </div>
  );
};

export default EmployeeManagement;
