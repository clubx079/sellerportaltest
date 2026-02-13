'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, BedDouble, CheckCircle, AlertCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RoomAssignmentModal = ({ isOpen, onClose, booking, onSuccess, userId }) => {
  const [mounted, setMounted] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && booking && userId) {
      fetchAvailableRooms();
      setSelectedRoom('');
    }
  }, [isOpen, booking, userId]);

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 4000);
  };

  const fetchAvailableRooms = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('rooms')
        .select(`
          id,
          room_number,
          floor_id,
          room_type_id,
          is_active,
          floors (floor_number, name),
          room_types (title)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('room_number', { ascending: true });

      if (error) throw error;

      const { data: bookedRooms, error: bookedError } = await supabase
        .from('booked_rooms')
        .select('room_id')
        .eq('user_id', userId)
        .or(`and(check_in.lte.${booking.check_out},check_out.gte.${booking.check_in})`)
        .neq('status', 'cancelled');

      if (bookedError) throw bookedError;

      const bookedRoomIds = new Set(bookedRooms.map(br => br.room_id));
      const availableRooms = data.filter(room => !bookedRoomIds.has(room.id));

      setRooms(availableRooms || []);
    } catch (error) {
      console.error('Error fetching available rooms:', error);
      showToast('Failed to fetch available rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedRoom) {
      showToast('Please select a room');
      return;
    }

    try {
      setSaving(true);

      const { error: bookedRoomError } = await supabase
        .from('booked_rooms')
        .insert([{
          user_id: userId,
          booking_id: booking.id,
          room_id: parseInt(selectedRoom),
          check_in: booking.check_in,
          check_out: booking.check_out,
          status: 'booked'
        }]);

      if (bookedRoomError) throw bookedRoomError;

      showToast('Room assigned successfully!', 'success');
      onSuccess?.();
      setTimeout(() => {
        onClose();
        setSelectedRoom('');
      }, 1500);
    } catch (error) {
      console.error('Error assigning room:', error);
      showToast('Failed to assign room: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!mounted || !booking) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0 }}
            className="fixed right-0 top-0 h-screen w-full md:w-[500px] lg:w-[550px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-neutral-900 px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <BedDouble className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Assign Room</h2>
                  <p className="text-[10px] sm:text-xs text-neutral-400">Booking #{booking.id}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Booking Info */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3">Booking Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-neutral-500">Guest Name</p>
                      <p className="text-sm font-medium text-neutral-900">{booking.guests?.full_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Booking Number</p>
                      <p className="text-sm font-medium text-neutral-900">#{booking.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Check In</p>
                      <p className="text-sm font-medium text-neutral-900">{formatDate(booking.check_in)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Check Out</p>
                      <p className="text-sm font-medium text-neutral-900">{formatDate(booking.check_out)}</p>
                    </div>
                  </div>
                </div>

                {/* Room Selection */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <BedDouble className="w-4 h-4" />
                    Select Room <span className="text-red-500">*</span>
                  </h3>

                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
                      <span className="ml-2 text-sm text-neutral-600">Loading available rooms...</span>
                    </div>
                  ) : rooms.length === 0 ? (
                    <div className="text-center py-8">
                      <BedDouble className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                      <p className="text-sm text-neutral-600 font-medium">No available rooms</p>
                      <p className="text-xs text-neutral-500 mt-1">All rooms are booked for this date range</p>
                    </div>
                  ) : (
                    <select
                      value={selectedRoom}
                      onChange={(e) => setSelectedRoom(e.target.value)}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                      required
                    >
                      <option value="">-- Select Room --</option>
                      {rooms.map(room => (
                        <option key={room.id} value={room.id}>
                          {room.room_number} - {room.room_types?.title || 'N/A'}
                          {room.floors?.floor_number && ` (Floor ${room.floors.floor_number})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Available Rooms List */}
                {rooms.length > 0 && (
                  <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                    <div className="bg-neutral-50 px-4 py-2.5 border-b border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-700">Available Rooms ({rooms.length})</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {rooms.map(room => (
                        <div
                          key={room.id}
                          onClick={() => setSelectedRoom(room.id.toString())}
                          className={`px-4 py-3 border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer transition-all ${
                            selectedRoom === room.id.toString() ? 'bg-neutral-100 border-l-4 border-l-neutral-900' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-neutral-900">{room.room_number}</p>
                              <p className="text-xs text-neutral-500">
                                {room.room_types?.title || 'N/A'} - Floor {room.floors?.floor_number || 'N/A'}
                              </p>
                            </div>
                            {selectedRoom === room.id.toString() && (
                              <div className="w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-3 sm:px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedRoom || rooms.length === 0}
                  className="flex-1 px-3 sm:px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">{saving ? 'Assigning...' : 'Assign Room'}</span>
                  <span className="sm:hidden">{saving ? 'Assigning...' : 'Assign'}</span>
                </button>
              </div>
            </form>

            {/* Toast */}
            <AnimatePresence>
              {toast.show && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
                    toast.type === 'error'
                      ? 'bg-red-50 border border-red-200 text-red-700'
                      : 'bg-green-50 border border-green-200 text-green-700'
                  }`}
                >
                  {toast.type === 'error' ? (
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium">{toast.message}</span>
                  <button
                    type="button"
                    onClick={() => setToast({ show: false, message: '', type: 'error' })}
                    className="ml-2 p-1 hover:bg-black/5 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default RoomAssignmentModal;
