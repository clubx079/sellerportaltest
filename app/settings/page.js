"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentCurrencySymbol } from '@/lib/currency';
import { motion } from 'framer-motion';
import { Eye, EyeOff, User, Building, Globe, Linkedin, Save, CheckCircle, AlertCircle, Building2, ShieldBan } from 'lucide-react';

const businessTypes = [
  { value: 'individual', label: 'Individual Seller' },
  { value: 'real_estate_agent', label: 'Real Estate Agent' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'property_management', label: 'Property Management' },
  { value: 'investment_firm', label: 'Investment Firm' },
  { value: 'other', label: 'Other' }
];

const dealsPerMonth = [
  { value: 'not_specified', label: 'Not Specified' },
  { value: '1-5', label: '1-5 deals per month' },
  { value: '6-10', label: '6-10 deals per month' },
  { value: '11-20', label: '11-20 deals per month' },
  { value: '20+', label: '20+ deals per month' }
];

const propertyTypesList = [
  'Residential', 'Commercial', 'Land', 'Multi-Family', 'Industrial', 'Retail', 'Office', 'Mixed-Use'
];

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl === 'activities' || tabFromUrl === 'security' || tabFromUrl === 'blocked' ? tabFromUrl : 'profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Activities tab state
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [currency, setCurrency] = useState('$');

  // Profile form state (full seller_applications profile)
  const [profileForm, setProfileForm] = useState({
    contact_person_name: '',
    email: '',
    phone: '',
    business_name: '',
    business_type: 'individual',
    deals_per_month: 'not_specified',
    primary_markets: '',
    property_types: [],
    website: '',
    linkedin: '',
    description: ''
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'activities' || t === 'security' || t === 'profile' || t === 'blocked') setActiveTab(t);
  }, [searchParams]);

  useEffect(() => {
    setCurrency(getCurrentCurrencySymbol());
  }, []);

  useEffect(() => {
    if (activeTab === 'activities' && user?.id) fetchActivities();
    if (activeTab === 'blocked' && user?.id) fetchBlockedUsers();
  }, [activeTab, user?.id]);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const userStr = localStorage.getItem('seller_user');
      if (!userStr) {
        window.location.href = '/login';
        return;
      }
      const currentUser = JSON.parse(userStr);
      setUser(currentUser);
      setProfileForm({
        contact_person_name: currentUser.contactPersonName || currentUser.contact_person_name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        business_name: currentUser.businessName || currentUser.business_name || '',
        business_type: currentUser.businessType || currentUser.business_type || 'individual',
        deals_per_month: currentUser.deals_per_month || 'not_specified',
        primary_markets: currentUser.primary_markets || '',
        property_types: Array.isArray(currentUser.property_types) ? currentUser.property_types : [],
        website: currentUser.website || '',
        linkedin: currentUser.linkedin || '',
        description: currentUser.description || ''
      });
      const { data, error } = await supabase
        .from('seller_applications')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (error) {
        console.error('Supabase error:', error);
        setMessage({ type: 'error', text: 'Could not load profile from server.' });
        return;
      }
      if (data) {
        setProfileForm({
          contact_person_name: data.contact_person_name || '',
          email: data.email || '',
          phone: data.phone || '',
          business_name: data.business_name || '',
          business_type: data.business_type || 'individual',
          deals_per_month: data.deals_per_month || 'not_specified',
          primary_markets: data.primary_markets || '',
          property_types: data.property_types || [],
          website: data.website || '',
          linkedin: data.linkedin || '',
          description: data.description || ''
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setMessage({ type: 'error', text: 'Failed to load user data.' });
    } finally {
      setLoading(false);
    }
  };

  const togglePropertyType = (type) => {
    setProfileForm(prev => ({
      ...prev,
      property_types: prev.property_types.includes(type)
        ? prev.property_types.filter(t => t !== type)
        : [...prev.property_types, type]
    }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const { error } = await supabase
        .from('seller_applications')
        .update({
          contact_person_name: profileForm.contact_person_name,
          business_name: profileForm.business_name,
          business_type: profileForm.business_type,
          deals_per_month: profileForm.deals_per_month,
          primary_markets: profileForm.primary_markets,
          property_types: profileForm.property_types,
          website: profileForm.website || null,
          linkedin: profileForm.linkedin || null,
          description: profileForm.description || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      if (error) throw error;
      const updatedUser = {
        ...user,
        contactPersonName: profileForm.contact_person_name,
        email: profileForm.email,
        phone: profileForm.phone,
        businessName: profileForm.business_name,
        businessType: profileForm.business_type,
        deals_per_month: profileForm.deals_per_month,
        primary_markets: profileForm.primary_markets,
        property_types: profileForm.property_types,
        website: profileForm.website,
        linkedin: profileForm.linkedin,
        description: profileForm.description
      };
      localStorage.setItem('seller_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    // Validate passwords
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      setSaving(false);
      return;
    }

    if (passwordForm.new_password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      setSaving(false);
      return;
    }

    try {
      // Verify current password (sellers use seller_applications table; password stored in that table)
      const { data: appData, error: verifyError } = await supabase
        .from('seller_applications')
        .select('id')
        .eq('id', user.id)
        .eq('password', passwordForm.current_password)
        .maybeSingle();

      if (verifyError || !appData) {
        setMessage({ type: 'error', text: 'Current password is incorrect' });
        setSaving(false);
        return;
      }

      // Update password in seller_applications
      const { error } = await supabase
        .from('seller_applications')
        .update({
          password: passwordForm.new_password,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error updating password:', error);
      setMessage({ type: 'error', text: 'Failed to update password' });
    } finally {
      setSaving(false);
    }
  };

  const fetchActivities = async () => {
    if (!user?.id) return;
    try {
      setActivitiesLoading(true);
      const { data: sellerData } = await supabase
        .from('seller_applications')
        .select('temp_seller_id')
        .eq('id', user.id)
        .maybeSingle();
      const tempSellerId = sellerData?.temp_seller_id ?? null;

      const { data: manualList = [] } = await supabase
        .from('properties')
        .select('id, address, slug, price, status, created_at')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      let scrapedList = [];
      if (tempSellerId) {
        const { data: wholesaleList, error } = await supabase
          .from('wholesale_deals')
          .select('id, full_address, address, slug, price, status, created_at')
          .eq('temp_seller_id', tempSellerId)
          .order('created_at', { ascending: false });
        if (!error && wholesaleList) scrapedList = wholesaleList;
      }

      const normalizeStatus = (p) => {
        const s = (p.status || '').toLowerCase();
        if (s === 'archived') return 'archived';
        if (s === 'published' || s === 'active') return 'active';
        return 'draft';
      };

      const combined = [
        ...(manualList || []).map(p => ({ ...p, _source: 'manual', _normalizedStatus: normalizeStatus(p) })),
        ...scrapedList.map(p => ({ ...p, _source: 'scraped', _normalizedStatus: normalizeStatus(p) }))
      ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      const list = combined.map((property) => {
        const createdAt = new Date(property.created_at);
        const now = new Date();
        const diffMs = now - createdAt;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        let timeAgo;
        if (diffDays > 0) timeAgo = `${diffDays}d ago`;
        else if (diffHours > 0) timeAgo = `${diffHours}h ago`;
        else timeAgo = `${diffMins}m ago`;
        const title = property.slug?.replace(/-/g, ' ').replace(/\d+$/, '').trim()
          || property.full_address || property.address || 'Property';
        const address = property.full_address || property.address || 'No address';
        return {
          id: property.id,
          type: property._normalizedStatus === 'active' ? 'published' : 'draft',
          title,
          address,
          price: `${currency}${parseFloat(property.price || 0).toLocaleString()}`,
          time: timeAgo,
          createdAt: property.created_at,
          source: property._source
        };
      });
      setActivities(list);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const fetchBlockedUsers = async () => {
    if (!user?.id) return;
    try {
      setBlockedLoading(true);
      const res = await fetch('/api/seller/chat?action=get_blocked_users', {
        headers: { Authorization: `Bearer ${user.id}` }
      });
      const data = await res.json().catch(() => ({}));
      setBlockedUsers(data?.blocked || []);
    } catch {
      setBlockedUsers([]);
    } finally {
      setBlockedLoading(false);
    }
  };

  const unblockConversation = async (conversationId) => {
    if (!user?.id || !conversationId) return;
    await fetch('/api/seller/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.id}` },
      body: JSON.stringify({ action: 'update_conversation_pref', conversationId, is_blocked: false })
    }).catch(() => {});
    fetchBlockedUsers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Message */}
      {message.text && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => { setActiveTab('profile'); router.replace('/settings'); }}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-primary text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => { setActiveTab('security'); router.replace('/settings?tab=security'); }}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'security'
                ? 'border-primary text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Security
          </button>
          <button
            onClick={() => { setActiveTab('activities'); router.replace('/settings?tab=activities'); }}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'activities'
                ? 'border-primary text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Activities
          </button>
          <button
            onClick={() => { setActiveTab('blocked'); router.replace('/settings?tab=blocked'); }}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'blocked'
                ? 'border-primary text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Blocked users
          </button>
        </div>
      </div>

      {/* Profile Tab — full profile (same as former Profile page) */}
      {activeTab === 'profile' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          <form onSubmit={handleProfileSubmit}>
            {/* Personal Information */}
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
              </div>
            </div>
            <div className="px-5 py-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={profileForm.contact_person_name}
                    onChange={(e) => setProfileForm({ ...profileForm, contact_person_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Email Address</label>
                  <input type="email" readOnly value={profileForm.email} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm" />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Phone Number</label>
                  <input type="tel" readOnly value={profileForm.phone} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm" />
                  <p className="text-xs text-gray-500 mt-1">Phone cannot be changed</p>
                </div>
              </div>
            </div>
            {/* Business Information */}
            <div className="px-5 py-4 border-y border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Business Information</h2>
              </div>
            </div>
            <div className="px-5 py-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Business/Company Name</label>
                  <input
                    type="text"
                    value={profileForm.business_name}
                    onChange={(e) => setProfileForm({ ...profileForm, business_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    placeholder="ABC Real Estate"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Business Type</label>
                  <select
                    value={profileForm.business_type}
                    onChange={(e) => setProfileForm({ ...profileForm, business_type: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  >
                    {businessTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Average Deals Per Month</label>
                  <select
                    value={profileForm.deals_per_month}
                    onChange={(e) => setProfileForm({ ...profileForm, deals_per_month: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  >
                    {dealsPerMonth.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Primary Markets/Locations</label>
                  <input
                    type="text"
                    value={profileForm.primary_markets}
                    onChange={(e) => setProfileForm({ ...profileForm, primary_markets: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    placeholder="Miami, FL; Orlando, FL"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Property Types</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {propertyTypesList.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => togglePropertyType(type)}
                      className={`px-4 py-2.5 rounded-lg border-2 transition-all text-sm font-medium ${
                        profileForm.property_types.includes(type)
                          ? 'border-primary bg-primary text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-primary'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Website</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="url"
                      value={profileForm.website}
                      onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">LinkedIn Profile</label>
                  <div className="relative">
                    <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="url"
                      value={profileForm.linkedin}
                      onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">About Your Business</label>
                <textarea
                  value={profileForm.description}
                  onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="Tell us about your real estate business..."
                />
              </div>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-base font-semibold bg-primary text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <span>Saving...</span> : <><Save className="w-5 h-5" /><span>Save Profile</span></>}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg border border-gray-200 p-6"
        >
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
              
              <div className="space-y-4 max-w-md">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm pr-10"
                      placeholder="Enter current password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm pr-10"
                      placeholder="Enter new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm pr-10"
                      placeholder="Confirm new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-900">Activity timeline</h2>
            <p className="text-xs text-gray-500 mt-0.5">Property updates and new listings</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
            {activitiesLoading ? (
              [...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
                  <div className="w-10 h-10 rounded-lg bg-gray-100" />
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-gray-100 rounded mb-2" />
                    <div className="h-3 w-24 bg-gray-100 rounded" />
                  </div>
                </div>
              ))
            ) : activities.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No activities yet</p>
                <Link href="/properties/new" className="inline-block mt-2 text-sm font-medium text-primary hover:underline">
                  Add your first property
                </Link>
              </div>
            ) : (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 px-4 py-4 hover:bg-gray-50/80 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.type === 'published' ? 'Added a new property' : 'Edited a property'}{' '}
                      <Link href={`/properties/edit/${activity.id}`} className="text-primary hover:underline">
                        {activity.title}
                      </Link>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{activity.address}</p>
                    <p className="text-xs text-gray-400 mt-1">{activity.time} · {activity.price}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'blocked' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-900">Blocked users</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manage users you blocked from chats</p>
          </div>
          <div className="divide-y divide-gray-100">
            {blockedLoading ? (
              <div className="px-4 py-8 text-sm text-gray-500">Loading blocked users...</div>
            ) : blockedUsers.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <ShieldBan className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No blocked users</p>
              </div>
            ) : (
              blockedUsers.map((row) => (
                <div key={row.conversation_id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{row.buyer_name || 'Buyer'}</p>
                    <p className="text-xs text-gray-500 truncate">Blocked {row.blocked_at ? new Date(row.blocked_at).toLocaleString() : ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => unblockConversation(row.conversation_id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
