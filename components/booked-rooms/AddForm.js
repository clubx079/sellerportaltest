'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, Users, Calendar, BedDouble } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchableSelect from '@/components/ui/SearchableSelect';

const AddForm = ({ isOpen, onClose, onSuccess, userId, currency = '$' }) => {
  const [mounted, setMounted] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [formData, setFormData] = useState({
    booking_id: '',
    room_id: '',
    check_in: '',
    check_out: '',
    status: 'booked'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && userId) {
      fetchBookings();
      fetchRooms();
    }
  }, [isOpen, userId]);

  if (!mounted) return null;

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          check_in,
          check_out,
          booking_type,
          guests (id, full_name, phone, is_vip)
        `)
        .eq('user_id', userId)
        .eq('booking_type', 'room')
        .order('id', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          id,
          room_number,
          room_type_id,
          room_types (id, title)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('room_number', { ascending: true });

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.booking_id || !formData.room_id || !formData.check_in || !formData.check_out) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const { data: bookedRoomData, error: bookedRoomError } = await supabase
        .from('booked_rooms')
        .insert([
          {
            user_id: userId,
            booking_id: formData.booking_id,
            room_id: formData.room_id,
            check_in: formData.check_in,
            check_out: formData.check_out,
            status: formData.status
          }
        ])
        .select(`
          *,
          bookings (
            id,
            booking_type,
            adults,
            kids,
            total_amount,
            paid_amount,
            payment_status,
            booking_status,
            created_at,
            guests (id, full_name, phone, is_vip)
          ),
          rooms (
            id,
            room_number,
            room_type_id,
            room_types (id, title, base_price)
          )
        `)
        .single();

      if (bookedRoomError) throw bookedRoomError;

      onSuccess(bookedRoomData);
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating booked room:', error);
      alert('Failed to create booked room: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      booking_id: '',
      room_id: '',
      check_in: '',
      check_out: '',
      status: 'booked'
    });
  };

  const handleBookingChange = (bookingId) => {
    setFormData(prev => ({ ...prev, booking_id: bookingId }));
    const selectedBooking = bookings.find(b => b.id === parseInt(bookingId));
    if (selectedBooking) {
      setFormData(prev => ({
        ...prev,
        booking_id: bookingId,
        check_in: selectedBooking.check_in ? selectedBooking.check_in.slice(0, 16) : '',
        check_out: selectedBooking.check_out ? selectedBooking.check_out.slice(0, 16) : ''
      }));
    }
  };

  // Prepare options for SearchableSelect
  const bookingOptions = bookings.map(booking => ({
    value: booking.id,
    label: `Booking #${booking.id} - ${booking.guests?.full_name || 'Walk-in Guest'}`
  }));

  const roomOptions = rooms.map(room => ({
    value: room.id,
    label: `${room.room_number} - ${room.room_types?.title || 'N/A'}`
  }));

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0 }}
            className="fixed right-0 top-0 h-screen w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <BedDouble className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Book Room</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">Assign room to booking</p>
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
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Booking Selection */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Select Booking <span className="text-red-500">*</span>
                  </h3>
                  <SearchableSelect
                    options={bookingOptions}
                    value={formData.booking_id}
                    onChange={handleBookingChange}
                    placeholder="-- Select Booking --"
                    searchPlaceholder="Search bookings..."
                    labelKey="label"
                    valueKey="value"
                  />
                </div>

                {/* Room Selection */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2 flex items-center gap-2">
                    <BedDouble className="w-4 h-4" />
                    Select Room <span className="text-red-500">*</span>
                  </h3>
                  <SearchableSelect
                    options={roomOptions}
                    value={formData.room_id}
                    onChange={(value) => setFormData(prev => ({ ...prev, room_id: value }))}
                    placeholder="-- Select Room --"
                    searchPlaceholder="Search rooms..."
                    labelKey="label"
                    valueKey="value"
                  />
                </div>

                {/* Check In & Check Out */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Check In <span className="text-red-500">*</span>
                    </h3>
                    <input
                      type="datetime-local"
                      value={formData.check_in}
                      onChange={(e) => setFormData(prev => ({ ...prev, check_in: e.target.value }))}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                      required
                    />
                  </div>
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Check Out <span className="text-red-500">*</span>
                    </h3>
                    <input
                      type="datetime-local"
                      value={formData.check_out}
                      onChange={(e) => setFormData(prev => ({ ...prev, check_out: e.target.value }))}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                      required
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Status <span className="text-red-500">*</span>
                  </h3>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                  >
                    <option value="booked">Booked</option>
                    <option value="checked_in">Checked In</option>
                    <option value="checked_out">Checked Out</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-neutral-200 p-4 sm:p-6 bg-white flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 bg-[#472F97] hover:bg-[#3a2578] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Book Room'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default AddForm;
