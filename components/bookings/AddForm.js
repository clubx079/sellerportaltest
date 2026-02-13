'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { X, Save, Calendar, BedDouble, User, Users, CreditCard, CheckCircle, Building2, AlertCircle, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchableSelect from '@/components/ui/SearchableSelect';

const AddForm = ({ isOpen, onClose, onSuccess, userId, currency = '$' }) => {
  const [mounted, setMounted] = useState(false);
  const [guests, setGuests] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [hallTypes, setHallTypes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [halls, setHalls] = useState([]);
  const [paidServices, setPaidServices] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({
    full_name: '',
    phone: '',
    cnic: '',
    is_vip: false
  });
  const [showAddAdditionalGuest, setShowAddAdditionalGuest] = useState(false);
  const [newAdditionalGuest, setNewAdditionalGuest] = useState({
    full_name: '',
    phone: '',
    cnic: '',
    is_vip: false
  });
  const [formData, setFormData] = useState({
    guest_id: '',
    additional_guests: [],
    booking_type: 'room',
    adults: 1,
    kids: 0,
    check_in: '',
    check_out: '',
    room_type_id: '',
    hall_type_id: '',
    room_id: '',
    hall_id: '',
    selected_services: [],
    coupon_code: '',
    coupon_id: null,
    discount_amount: 0,
    total_amount: 0,
    paid_amount: 0,
    payment_status: 'pending',
    booking_status: 'pending'
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 4000);
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchGuests();
      fetchRoomTypes();
      fetchHallTypes();
      fetchRooms();
      fetchHalls();
      fetchPaidServices();
      fetchCoupons();
      resetForm();
    }
  }, [isOpen, userId]);

  const fetchGuests = async () => {
    try {
      const { data, error } = await supabase
        .from('guests')
        .select('id, full_name, phone, cnic, is_vip')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGuests(data || []);
    } catch (error) {
      console.error('Error fetching guests:', error);
    }
  };

  const handleAddGuest = async () => {
    if (!newGuest.full_name || !newGuest.phone) {
      showToast('Please provide guest name and phone number');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('guests')
        .insert([{
          user_id: userId,
          full_name: newGuest.full_name,
          phone: newGuest.phone,
          cnic: newGuest.cnic || null,
          is_vip: newGuest.is_vip
        }])
        .select()
        .single();

      if (error) throw error;

      setGuests(prev => [data, ...prev]);
      setFormData(prev => ({ ...prev, guest_id: data.id }));
      setNewGuest({ full_name: '', phone: '', cnic: '', is_vip: false });
      setShowAddGuest(false);
      showToast('Guest added successfully!', 'success');
    } catch (error) {
      console.error('Error adding guest:', error);
      showToast('Failed to add guest: ' + error.message);
    }
  };

  const handleAddAdditionalGuest = async () => {
    if (!newAdditionalGuest.full_name || !newAdditionalGuest.phone) {
      showToast('Please provide guest name and phone number');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('guests')
        .insert([{
          user_id: userId,
          full_name: newAdditionalGuest.full_name,
          phone: newAdditionalGuest.phone,
          cnic: newAdditionalGuest.cnic || null,
          is_vip: newAdditionalGuest.is_vip
        }])
        .select()
        .single();

      if (error) throw error;

      setGuests(prev => [data, ...prev]);
      setFormData(prev => ({
        ...prev,
        additional_guests: [...prev.additional_guests, data.id]
      }));
      setNewAdditionalGuest({ full_name: '', phone: '', cnic: '', is_vip: false });
      setShowAddAdditionalGuest(false);
      showToast('Additional guest added successfully!', 'success');
    } catch (error) {
      console.error('Error adding additional guest:', error);
      showToast('Failed to add guest: ' + error.message);
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

  const fetchHallTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('hall_types')
        .select('*')
        .eq('user_id', userId)
        .order('title', { ascending: true });

      if (error) throw error;
      setHallTypes(data || []);
    } catch (error) {
      console.error('Error fetching hall types:', error);
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
          is_active,
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

  const fetchHalls = async () => {
    try {
      const { data, error } = await supabase
        .from('halls')
        .select(`
          id,
          hall_number,
          hall_type_id,
          hall_types (id, title)
        `)
        .eq('user_id', userId)
        .order('hall_number', { ascending: true });

      if (error) throw error;
      setHalls(data || []);
    } catch (error) {
      console.error('Error fetching halls:', error);
    }
  };

  const fetchPaidServices = async () => {
    try {
      const { data, error } = await supabase
        .from('paid_services')
        .select('*')
        .eq('user_id', userId)
        .eq('status', true)
        .order('title', { ascending: true });

      if (error) throw error;
      setPaidServices(data || []);
    } catch (error) {
      console.error('Error fetching paid services:', error);
    }
  };

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('user_id', userId)
        .order('offer_title', { ascending: true });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    }
  };

  const calculateTotal = () => {
    let total = 0;

    if (formData.check_in && formData.check_out) {
      if (formData.booking_type === 'room' && formData.room_type_id) {
        const roomType = roomTypes.find(rt => rt.id === parseInt(formData.room_type_id));
        if (roomType) {
          const checkIn = new Date(formData.check_in);
          const checkOut = new Date(formData.check_out);
          const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
          total = (roomType.base_price || 0) * Math.max(nights, 1);
        }
      } else if (formData.booking_type === 'hall' && formData.hall_type_id) {
        const hallType = hallTypes.find(ht => ht.id === parseInt(formData.hall_type_id));
        if (hallType) {
          const checkIn = new Date(formData.check_in);
          const checkOut = new Date(formData.check_out);
          const days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
          total = (hallType.best_price || 0) * Math.max(days, 1);
        }
      }
    }

    formData.selected_services.forEach(serviceId => {
      const service = paidServices.find(s => s.id === serviceId);
      if (service) {
        total += parseFloat(service.price);
      }
    });

    if (formData.coupon_id) {
      const coupon = coupons.find(c => c.id === formData.coupon_id);
      if (coupon) {
        if (coupon.coupon_type === 'percentage') {
          total = total - (total * (coupon.coupon_value / 100));
        } else if (coupon.coupon_type === 'fixed') {
          total = total - coupon.coupon_value;
        }
      }
    }

    return Math.max(0, total);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isRoomBooking = formData.booking_type === 'room';
    const isHallBooking = formData.booking_type === 'hall';

    if (!formData.guest_id) {
      showToast('Please select a guest');
      return;
    }

    if (!formData.check_in) {
      showToast('Please select check-in date');
      return;
    }

    if (!formData.check_out) {
      showToast('Please select check-out date');
      return;
    }

    if (isRoomBooking && !formData.room_type_id) {
      showToast('Please select a room type');
      return;
    }

    if (isRoomBooking && !formData.room_id) {
      showToast('Please select a room number');
      return;
    }

    if (isHallBooking && !formData.hall_type_id) {
      showToast('Please select a hall type');
      return;
    }

    if (isHallBooking && !formData.hall_id) {
      showToast('Please select a hall number');
      return;
    }

    try {
      setSaving(true);

      const total = calculateTotal();

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
            user_id: userId,
            guest_id: parseInt(formData.guest_id),
            booking_type: formData.booking_type,
            adults: formData.adults,
            kids: formData.kids,
            check_in: formData.check_in,
            check_out: formData.check_out,
            coupon_id: formData.coupon_id,
            total_amount: total,
            paid_amount: parseFloat(formData.paid_amount) || 0,
            payment_status: formData.payment_status,
            booking_status: formData.booking_status
          }
        ])
        .select();

      if (bookingError) throw bookingError;

      // Insert head guest into booking_guests table
      const { error: headGuestError } = await supabase
        .from('booking_guests')
        .insert([{
          user_id: userId,
          booking_id: bookingData[0].id,
          guest_id: parseInt(formData.guest_id),
          is_head_guest: true
        }]);

      if (headGuestError) throw headGuestError;

      // Insert additional guests if any
      if (formData.additional_guests.length > 0) {
        const additionalGuestsData = formData.additional_guests.map(guestId => ({
          user_id: userId,
          booking_id: bookingData[0].id,
          guest_id: parseInt(guestId),
          is_head_guest: false
        }));

        const { error: additionalGuestsError } = await supabase
          .from('booking_guests')
          .insert(additionalGuestsData);

        if (additionalGuestsError) throw additionalGuestsError;
      }

      if (formData.booking_type === 'room' && formData.room_id) {
        const { error: bookedRoomError } = await supabase
          .from('booked_rooms')
          .insert([{
            user_id: userId,
            booking_id: bookingData[0].id,
            room_id: parseInt(formData.room_id),
            check_in: formData.check_in,
            check_out: formData.check_out,
            status: 'booked'
          }]);

        if (bookedRoomError) throw bookedRoomError;
      } else if (formData.booking_type === 'hall' && formData.hall_id) {
        const { error: bookedHallError } = await supabase
          .from('booked_halls')
          .insert([{
            user_id: userId,
            booking_id: bookingData[0].id,
            hall_id: parseInt(formData.hall_id),
            booking_basis: 'daily',
            check_in: formData.check_in,
            check_out: formData.check_out,
            status: 'booked'
          }]);

        if (bookedHallError) throw bookedHallError;
      }

      if (formData.selected_services.length > 0) {
        const servicesData = formData.selected_services.map(serviceId => {
          const service = paidServices.find(s => s.id === serviceId);
          return {
            user_id: userId,
            booking_id: bookingData[0].id,
            service_id: serviceId,
            quantity: 1,
            total_price: service?.price || 0
          };
        });

        const { error: servicesError } = await supabase
          .from('booking_services')
          .insert(servicesData);

        if (servicesError) throw servicesError;
      }

      const { data: completeBooking, error: fetchError } = await supabase
        .from('bookings')
        .select(`
          *,
          guests (id, full_name, phone, is_vip),
          coupons (coupon_code, coupon_value),
          booked_rooms (
            id,
            room_id,
            check_in,
            check_out,
            status,
            rooms (id, room_number, room_type_id, room_types (id, title))
          ),
          booked_halls (
            id,
            hall_id,
            booking_basis,
            check_in,
            check_out,
            status,
            halls (id, hall_number, hall_type_id, hall_types (id, title))
          )
        `)
        .eq('id', bookingData[0].id)
        .single();

      if (fetchError) throw fetchError;

      onSuccess(completeBooking);
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating booking:', error);
      showToast('Failed to create booking: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      guest_id: '',
      additional_guests: [],
      booking_type: 'room',
      adults: 1,
      kids: 0,
      check_in: '',
      check_out: '',
      room_type_id: '',
      hall_type_id: '',
      room_id: '',
      hall_id: '',
      selected_services: [],
      coupon_code: '',
      coupon_id: null,
      discount_amount: 0,
      total_amount: 0,
      paid_amount: 0,
      payment_status: 'pending',
      booking_status: 'pending'
    });
    setShowAddGuest(false);
    setShowAddAdditionalGuest(false);
    setNewGuest({ full_name: '', phone: '', cnic: '', is_vip: false });
    setNewAdditionalGuest({ full_name: '', phone: '', cnic: '', is_vip: false });
  };

  const handleServiceToggle = (serviceId) => {
    setFormData(prev => ({
      ...prev,
      selected_services: prev.selected_services.includes(serviceId)
        ? prev.selected_services.filter(id => id !== serviceId)
        : [...prev.selected_services, serviceId]
    }));
  };

  if (!mounted) return null;

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
            className="fixed right-0 top-0 h-screen w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#472F97] px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Add Booking</h2>
                  <p className="text-[10px] sm:text-xs text-white/70">Create new reservation</p>
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
            <form
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                  e.preventDefault();
                }
              }}
              className="flex-1 overflow-y-auto"
            >
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Head Guest Selection */}
                <div className="bg-gradient-to-br from-[#F5F3FF] to-white rounded-xl p-4 border-2 border-[#472F97]/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <User className="w-4 h-4 text-[#472F97]" />
                      Head Guest <span className="text-red-500">*</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddGuest(!showAddGuest)}
                      className="text-xs font-medium text-[#472F97] hover:text-[#3a2578] flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      {showAddGuest ? 'Cancel' : 'Add New'}
                    </button>
                  </div>

                  {showAddGuest ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Name *</label>
                          <input
                            type="text"
                            value={newGuest.full_name}
                            onChange={(e) => setNewGuest(prev => ({ ...prev, full_name: e.target.value }))}
                            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                            placeholder="Full name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Phone *</label>
                          <input
                            type="tel"
                            value={newGuest.phone}
                            onChange={(e) => setNewGuest(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                            placeholder="Phone number"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">CNIC</label>
                          <input
                            type="text"
                            value={newGuest.cnic}
                            onChange={(e) => setNewGuest(prev => ({ ...prev, cnic: e.target.value }))}
                            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                            placeholder="CNIC number"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newGuest.is_vip}
                            onChange={(e) => setNewGuest(prev => ({ ...prev, is_vip: e.target.checked }))}
                            className="w-4 h-4 text-[#472F97] rounded focus:ring-[#472F97] border-neutral-300"
                          />
                          <span className="text-xs text-neutral-700">VIP Guest</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleAddGuest}
                          className="px-4 py-2 bg-[#472F97] hover:bg-[#3a2578] text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Save Guest
                        </button>
                      </div>
                    </div>
                  ) : (
                    <SearchableSelect
                      options={guests.map(guest => ({
                        value: guest.id,
                        label: `${guest.full_name} (${guest.phone})${guest.cnic ? ` - CNIC: ${guest.cnic}` : ''}${guest.is_vip ? ' ⭐' : ''}`
                      }))}
                      value={formData.guest_id}
                      onChange={(value) => setFormData(prev => ({ ...prev, guest_id: value }))}
                      placeholder="-- Select Head Guest --"
                      searchPlaceholder="Search by name, phone, or CNIC..."
                    />
                  )}
                </div>

                {/* Additional Guests */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Additional Guests <span className="text-xs text-neutral-500 font-normal">(Optional)</span>
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-500">{formData.additional_guests.length} selected</span>
                      <button
                        type="button"
                        onClick={() => setShowAddAdditionalGuest(!showAddAdditionalGuest)}
                        className="text-xs font-medium text-[#472F97] hover:text-[#3a2578] flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        {showAddAdditionalGuest ? 'Cancel' : 'Add New'}
                      </button>
                    </div>
                  </div>

                  {showAddAdditionalGuest ? (
                    <div className="space-y-3 mb-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Name *</label>
                          <input
                            type="text"
                            value={newAdditionalGuest.full_name}
                            onChange={(e) => setNewAdditionalGuest(prev => ({ ...prev, full_name: e.target.value }))}
                            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                            placeholder="Full name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Phone *</label>
                          <input
                            type="tel"
                            value={newAdditionalGuest.phone}
                            onChange={(e) => setNewAdditionalGuest(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                            placeholder="Phone number"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">CNIC</label>
                          <input
                            type="text"
                            value={newAdditionalGuest.cnic}
                            onChange={(e) => setNewAdditionalGuest(prev => ({ ...prev, cnic: e.target.value }))}
                            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                            placeholder="CNIC number"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newAdditionalGuest.is_vip}
                            onChange={(e) => setNewAdditionalGuest(prev => ({ ...prev, is_vip: e.target.checked }))}
                            className="w-4 h-4 text-[#472F97] rounded focus:ring-[#472F97] border-neutral-300"
                          />
                          <span className="text-xs text-neutral-700">VIP Guest</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleAddAdditionalGuest}
                          className="px-4 py-2 bg-[#472F97] hover:bg-[#3a2578] text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Save Guest
                        </button>
                      </div>
                    </div>
                  ) : (
                    <SearchableSelect
                      options={guests
                        .filter(guest => guest.id !== parseInt(formData.guest_id))
                        .map(guest => ({
                          value: guest.id,
                          label: `${guest.full_name} (${guest.phone})${guest.cnic ? ` - CNIC: ${guest.cnic}` : ''}${guest.is_vip ? ' ⭐' : ''}`
                        }))}
                      value=""
                      onChange={(value) => {
                        if (value && !formData.additional_guests.includes(value)) {
                          setFormData(prev => ({
                            ...prev,
                            additional_guests: [...prev.additional_guests, value]
                          }));
                        }
                      }}
                      placeholder="-- Add Guest --"
                      searchPlaceholder="Search by name, phone, or CNIC..."
                    />
                  )}

                  {/* Selected Additional Guests */}
                  {formData.additional_guests.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {formData.additional_guests.map(guestId => {
                        const guest = guests.find(g => g.id === parseInt(guestId));
                        if (!guest) return null;
                        return (
                          <div
                            key={guestId}
                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-neutral-200"
                          >
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-neutral-400" />
                              <span className="text-xs text-neutral-700">
                                {guest.full_name} ({guest.phone}){guest.cnic ? ` - CNIC: ${guest.cnic}` : ''}{guest.is_vip ? ' ⭐' : ''}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  additional_guests: prev.additional_guests.filter(id => id !== guestId)
                                }));
                              }}
                              className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Booking Type */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <BedDouble className="w-4 h-4" />
                    Booking Type <span className="text-red-500">*</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, booking_type: 'room', room_type_id: '', hall_type_id: '', room_id: '', hall_id: '' }))}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.booking_type === 'room'
                          ? 'border-[#472F97] bg-[#472F97] text-white'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <BedDouble className="w-4 h-4 mx-auto mb-1" />
                      Room
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, booking_type: 'hall', room_type_id: '', hall_type_id: '', room_id: '', hall_id: '' }))}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.booking_type === 'hall'
                          ? 'border-[#472F97] bg-[#472F97] text-white'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <Building2 className="w-4 h-4 mx-auto mb-1" />
                      Hall
                    </button>
                  </div>
                </div>

                {/* Room/Hall Selection */}
                {formData.booking_type === 'room' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                        <BedDouble className="w-4 h-4" />
                        Room Type <span className="text-red-500">*</span>
                      </h3>
                      <SearchableSelect
                        options={roomTypes.map(rt => ({
                          value: rt.id,
                          label: `${rt.title} - ${currency}${rt.base_price}/night`
                        }))}
                        value={formData.room_type_id}
                        onChange={(value) => setFormData(prev => ({ ...prev, room_type_id: value, room_id: '' }))}
                        placeholder="-- Select Type --"
                        searchPlaceholder="Search room type..."
                      />
                    </div>

                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                        <BedDouble className="w-4 h-4" />
                        Room Number <span className="text-red-500">*</span>
                      </h3>
                      <SearchableSelect
                        options={rooms
                          .filter(room => !formData.room_type_id || room.room_type_id === parseInt(formData.room_type_id))
                          .map(room => ({
                            value: room.id,
                            label: `${room.room_number} - ${room.room_types?.title || 'N/A'}`
                          }))}
                        value={formData.room_id}
                        onChange={(value) => setFormData(prev => ({ ...prev, room_id: value }))}
                        placeholder="-- Select Room --"
                        searchPlaceholder="Search room number..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Hall Type <span className="text-red-500">*</span>
                      </h3>
                      <SearchableSelect
                        options={hallTypes.map(ht => ({
                          value: ht.id,
                          label: `${ht.title} - ${currency}${ht.best_price}/day`
                        }))}
                        value={formData.hall_type_id}
                        onChange={(value) => setFormData(prev => ({ ...prev, hall_type_id: value, hall_id: '' }))}
                        placeholder="-- Select Type --"
                        searchPlaceholder="Search hall type..."
                      />
                    </div>

                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Hall Number <span className="text-red-500">*</span>
                      </h3>
                      <SearchableSelect
                        options={halls
                          .filter(hall => !formData.hall_type_id || hall.hall_type_id === parseInt(formData.hall_type_id))
                          .map(hall => ({
                            value: hall.id,
                            label: `${hall.hall_number} - ${hall.hall_types?.title || 'N/A'}`
                          }))}
                        value={formData.hall_id}
                        onChange={(value) => setFormData(prev => ({ ...prev, hall_id: value }))}
                        placeholder="-- Select Hall --"
                        searchPlaceholder="Search hall number..."
                      />
                    </div>
                  </div>
                )}

                {/* Check In/Out & Guests */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Dates & Guests
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Check In *</label>
                      <input
                        type="datetime-local"
                        value={formData.check_in}
                        onChange={(e) => setFormData(prev => ({ ...prev, check_in: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-2 sm:px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Check Out *</label>
                      <input
                        type="datetime-local"
                        value={formData.check_out}
                        onChange={(e) => setFormData(prev => ({ ...prev, check_out: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-2 sm:px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Adults *</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.adults}
                        onChange={(e) => setFormData(prev => ({ ...prev, adults: parseInt(e.target.value) || 1 }))}
                        className="w-full border border-neutral-200 rounded-lg px-2 sm:px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Kids</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.kids}
                        onChange={(e) => setFormData(prev => ({ ...prev, kids: parseInt(e.target.value) || 0 }))}
                        className="w-full border border-neutral-200 rounded-lg px-2 sm:px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Status & Payment */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Status & Payment
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Booking Status</label>
                      <select
                        value={formData.booking_status}
                        onChange={(e) => setFormData(prev => ({ ...prev, booking_status: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Payment Status</label>
                      <select
                        value={formData.payment_status}
                        onChange={(e) => setFormData(prev => ({ ...prev, payment_status: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                      >
                        <option value="pending">Pending</option>
                        <option value="partial">Partial</option>
                        <option value="paid">Paid</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Paid Amount</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.paid_amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, paid_amount: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#472F97] focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Paid Services */}
                {paidServices.length > 0 && (
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-3">
                      Paid Services ({formData.selected_services.length} selected)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {paidServices.map(service => (
                        <label key={service.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-neutral-200 cursor-pointer hover:border-neutral-300 transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.selected_services.includes(service.id)}
                            onChange={() => handleServiceToggle(service.id)}
                            className="w-4 h-4 text-[#472F97] rounded focus:ring-[#472F97] border-neutral-300"
                          />
                          <span className="text-xs text-neutral-700 flex-1">{service.title}</span>
                          <span className="text-xs font-medium text-neutral-900">{currency}{service.price}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="bg-[#472F97] rounded-xl p-4 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Estimated Total</span>
                    <span className="text-xl font-bold">{currency}{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
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
                  disabled={saving}
                  className="flex-1 px-3 sm:px-4 py-2.5 bg-[#472F97] hover:bg-[#3a2578] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save Booking'}</span>
                  <span className="sm:hidden">{saving ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </form>

            {/* Toast Notification */}
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

export default AddForm;
