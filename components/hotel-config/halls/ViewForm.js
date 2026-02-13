'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Building2, Layers, Users, CheckCircle2 } from 'lucide-react';

const ViewForm = ({ isOpen, onClose, hall }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && hall && (
        <>
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          <div
            className="fixed right-0 top-0 h-screen w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Hall Details</h2>
                  <p className="text-xs text-white/70">View hall information</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Basic Info Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Basic Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Hall Number</label>
                      <p className="text-sm font-semibold text-neutral-900">{hall.hall_number}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Floor</label>
                        <p className="text-sm text-neutral-700">
                          {hall.floors ? `${hall.floors.floor_number} - ${hall.floors.name}` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Hall Type</label>
                        <p className="text-sm text-neutral-700">
                          {hall.hall_types ? hall.hall_types.title : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Section */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Hall Status
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Housekeeping Status</label>
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${getHousekeepingStatusColor(hall.housekeeping_status)}`}
                      >
                        {hall.housekeeping_status ? hall.housekeeping_status.charAt(0).toUpperCase() + hall.housekeeping_status.slice(1) : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Assigned To</label>
                      <p className="text-sm text-neutral-700">
                        {hall.employees ? hall.employees.full_name : 'Not Assigned'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Active Status */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-[#472F97] mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Availability
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Status</label>
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${
                      hall.is_active
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-red-100 text-red-700 border-red-200'
                    }`}>
                      {hall.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2.5 bg-[#472F97] hover:bg-[#3a2578] text-white font-medium rounded-xl transition-colors"
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
