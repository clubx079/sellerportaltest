'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, Mail, Phone, MapPin, CreditCard, FileText, Briefcase, Calendar } from 'lucide-react';
// Removed framer-motion for better performance

const ViewForm = ({ isOpen, onClose, employee }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && employee && (
        <>
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Side Panel */}
          <div
            className="fixed right-0 top-0 h-screen w-full sm:w-[90%] md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/10 flex items-center justify-center">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Employee Details</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">View employee information</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Personal Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Full Name</label>
                      <p className="text-base font-semibold text-neutral-900">{employee.full_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Username</label>
                      <p className="text-sm text-neutral-700">{employee.username || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Email</label>
                      <p className="text-sm text-neutral-700">{employee.email || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Contact Information
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
                    <p className="text-sm text-neutral-700">{employee.phone || 'N/A'}</p>
                  </div>
                </div>

                {/* Employment Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Employment Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Department</label>
                      <p className="text-sm text-neutral-700">
                        {employee.departments?.name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Designation</label>
                      <p className="text-sm text-neutral-700">
                        {employee.designations?.name || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Address Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Country</label>
                      <p className="text-sm text-neutral-700">{employee.country || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Region</label>
                      <p className="text-sm text-neutral-700">{employee.region || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">City</label>
                      <p className="text-sm text-neutral-700">{employee.city || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Address</label>
                      <p className="text-sm text-neutral-700">{employee.address || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* ID Information */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    ID Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">CNIC Number</label>
                      <p className="text-sm text-neutral-700">{employee.cnic_number || 'N/A'}</p>
                    </div>
                    {employee.id_upload && (
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">ID Upload</label>
                        <a
                          href={employee.id_upload}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-neutral-900 hover:text-neutral-700 underline"
                        >
                          View Document
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Information */}
                {employee.remark && (
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Additional Information
                    </h3>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Remark</label>
                      <p className="text-sm text-neutral-700">{employee.remark}</p>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Record Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Created At</label>
                      <p className="text-sm text-neutral-700">{formatDate(employee.created_at)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Updated At</label>
                      <p className="text-sm text-neutral-700">{formatDate(employee.updated_at)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button - Sticky */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-3 sm:py-4">
                <button
                  onClick={onClose}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base bg-[#472F97] hover:bg-[#3a2578] text-white font-medium rounded-lg sm:rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  );
};

export default ViewForm;
