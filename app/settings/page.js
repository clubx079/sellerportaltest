"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentCurrencySymbol } from '@/lib/currency';
import { Eye, EyeOff, User, Building, Globe, Linkedin, Save, Building2, ShieldBan, LogOut, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [currency, setCurrency] = useState('$');

  const [profileForm, setProfileForm] = useState({
    contact_person_name: '', email: '', phone: '', business_name: '',
    business_type: 'individual', deals_per_month: 'not_specified',
    primary_markets: '', property_types: [], website: '', linkedin: '', description: ''
  });

  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  // Email change flow: step 'idle' | 'form' (enter new email + password) | 'otp' (enter code)
  const [emailChange, setEmailChange] = useState({ step: 'idle', newEmail: '', password: '', otp: '', error: '', loading: false });
  const [phoneChange, setPhoneChange] = useState({ step: 'idle', newPhone: '', password: '', otp: '', error: '', loading: false });

  // Subscription management (cancel flow)
  const [planInfo, setPlanInfo] = useState(null);
  const [showCancelSection, setShowCancelSection] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelDone, setCancelDone] = useState(false);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'activities' || t === 'security' || t === 'profile' || t === 'blocked') setActiveTab(t);
  }, [searchParams]);

  useEffect(() => { setCurrency(getCurrentCurrencySymbol()); }, []);
  useEffect(() => {
    if (activeTab === 'activities' && user?.id) fetchActivities();
    if (activeTab === 'blocked' && user?.id) fetchBlockedUsers();
  }, [activeTab, user?.id]);
  useEffect(() => { loadUserData(); }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const userStr = localStorage.getItem('seller_user');
      if (!userStr) { window.location.href = '/login'; return; }
      const currentUser = JSON.parse(userStr);
      setUser(currentUser);
      setProfileForm({
        contact_person_name: currentUser.contactPersonName || currentUser.contact_person_name || '',
        email: currentUser.email || '', phone: currentUser.phone || '',
        business_name: currentUser.businessName || currentUser.business_name || '',
        business_type: currentUser.businessType || currentUser.business_type || 'individual',
        deals_per_month: currentUser.deals_per_month || 'not_specified',
        primary_markets: currentUser.primary_markets || '',
        property_types: Array.isArray(currentUser.property_types) ? currentUser.property_types : [],
        website: currentUser.website || '', linkedin: currentUser.linkedin || '', description: currentUser.description || ''
      });
      const { data, error } = await supabase.from('seller_applications').select('*').eq('id', currentUser.id).maybeSingle();
      if (error) { setMessage({ type: 'error', text: 'Could not load profile from server.' }); return; }
      if (data) {
        setProfileForm({
          contact_person_name: data.contact_person_name || '', email: data.email || '', phone: data.phone || '',
          business_name: data.business_name || '', business_type: data.business_type || 'individual',
          deals_per_month: data.deals_per_month || 'not_specified', primary_markets: data.primary_markets || '',
          property_types: data.property_types || [], website: data.website || '', linkedin: data.linkedin || '', description: data.description || ''
        });
      }

      // Load plan info for subscription management
      const { data: plan } = await supabase
        .from('seller_plans')
        .select('status, plan_type, billing_cycle, current_period_end')
        .eq('seller_id', currentUser.id)
        .maybeSingle();
      if (plan) setPlanInfo(plan);

    } catch (error) { setMessage({ type: 'error', text: 'Failed to load user data.' }); }
    finally { setLoading(false); }
  };

  const togglePropertyType = (type) => {
    setProfileForm(prev => ({ ...prev, property_types: prev.property_types.includes(type) ? prev.property_types.filter(t => t !== type) : [...prev.property_types, type] }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setMessage({ type: '', text: '' });
    try {
      const { error } = await supabase.from('seller_applications').update({
        contact_person_name: profileForm.contact_person_name, business_name: profileForm.business_name,
        business_type: profileForm.business_type, deals_per_month: profileForm.deals_per_month,
        primary_markets: profileForm.primary_markets, property_types: profileForm.property_types,
        website: profileForm.website || null, linkedin: profileForm.linkedin || null,
        description: profileForm.description || null, updated_at: new Date().toISOString()
      }).eq('id', user.id);
      if (error) throw error;
      const updatedUser = { ...user, contactPersonName: profileForm.contact_person_name, email: profileForm.email, phone: profileForm.phone, businessName: profileForm.business_name, businessType: profileForm.business_type, deals_per_month: profileForm.deals_per_month, primary_markets: profileForm.primary_markets, property_types: profileForm.property_types, website: profileForm.website, linkedin: profileForm.linkedin, description: profileForm.description };
      localStorage.setItem('seller_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) { setMessage({ type: 'error', text: error?.message || 'Failed to update profile' }); }
    finally { setSaving(false); }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setMessage({ type: '', text: '' });
    if (passwordForm.new_password !== passwordForm.confirm_password) { setMessage({ type: 'error', text: 'New passwords do not match' }); setSaving(false); return; }
    if (passwordForm.new_password.length < 8) { setMessage({ type: 'error', text: 'Password must be at least 8 characters' }); setSaving(false); return; }
    try {
      const res = await fetch('/api/seller/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: user.id, currentPassword: passwordForm.current_password, newPassword: passwordForm.new_password }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setMessage({ type: 'error', text: json.error || 'Failed to update password' }); setSaving(false); return; }
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) { setMessage({ type: 'error', text: 'Failed to update password' }); }
    finally { setSaving(false); }
  };

  // ── Email change (H10) ──────────────────────────────────────────
  async function requestEmailChange() {
    if (!user?.id) return;
    setEmailChange(s => ({ ...s, loading: true, error: '' }));
    try {
      const res = await fetch('/api/seller/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: user.id, currentPassword: emailChange.password, newEmail: emailChange.newEmail }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setEmailChange(s => ({ ...s, loading: false, error: json.error || 'Failed' })); return; }
      setEmailChange(s => ({ ...s, step: 'otp', loading: false, error: '' }));
    } catch {
      setEmailChange(s => ({ ...s, loading: false, error: 'Something went wrong' }));
    }
  }

  async function verifyEmailChange() {
    if (!user?.id) return;
    setEmailChange(s => ({ ...s, loading: true, error: '' }));
    try {
      const res = await fetch('/api/seller/change-email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: user.id, otp: emailChange.otp }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setEmailChange(s => ({ ...s, loading: false, error: json.error || 'Failed' })); return; }
      // Success — update local state + localStorage
      const updated = { ...user, email: json.newEmail };
      setUser(updated);
      setProfileForm(f => ({ ...f, email: json.newEmail }));
      try { localStorage.setItem('seller_user', JSON.stringify(updated)); } catch {}
      setEmailChange({ step: 'idle', newEmail: '', password: '', otp: '', error: '', loading: false });
      setMessage({ type: 'success', text: 'Email updated successfully.' });
    } catch {
      setEmailChange(s => ({ ...s, loading: false, error: 'Something went wrong' }));
    }
  }

  // ── Phone change (U16) ──────────────────────────────────────────
  async function requestPhoneChange() {
    if (!user?.id) return;
    setPhoneChange(s => ({ ...s, loading: true, error: '' }));
    try {
      const res = await fetch('/api/seller/change-phone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: user.id, currentPassword: phoneChange.password, newPhone: phoneChange.newPhone }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setPhoneChange(s => ({ ...s, loading: false, error: json.error || 'Failed' })); return; }
      setPhoneChange(s => ({ ...s, step: 'otp', loading: false, error: '' }));
    } catch { setPhoneChange(s => ({ ...s, loading: false, error: 'Something went wrong' })); }
  }

  async function verifyPhoneChange() {
    if (!user?.id) return;
    setPhoneChange(s => ({ ...s, loading: true, error: '' }));
    try {
      const res = await fetch('/api/seller/change-phone/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: user.id, otp: phoneChange.otp }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setPhoneChange(s => ({ ...s, loading: false, error: json.error || 'Failed' })); return; }
      const updated = { ...user, phone: json.newPhone };
      setUser(updated);
      setProfileForm(f => ({ ...f, phone: json.newPhone }));
      try { localStorage.setItem('seller_user', JSON.stringify(updated)); } catch {}
      setPhoneChange({ step: 'idle', newPhone: '', password: '', otp: '', error: '', loading: false });
      setMessage({ type: 'success', text: 'Phone updated successfully.' });
    } catch { setPhoneChange(s => ({ ...s, loading: false, error: 'Something went wrong' })); }
  }

  const fetchActivities = async () => {
    if (!user?.id) return;
    try {
      setActivitiesLoading(true);
      const { data: sellerData } = await supabase.from('seller_applications').select('temp_seller_id').eq('id', user.id).maybeSingle();
      const tempSellerId = sellerData?.temp_seller_id ?? null;
      const { data: manualList = [] } = await supabase.from('properties').select('id, address, slug, price, status, created_at').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(50);
      let scrapedList = [];
      if (tempSellerId) { const { data: wl, error } = await supabase.from('wholesale_deals').select('id, full_address, address, slug, price, status, created_at').eq('temp_seller_id', tempSellerId).order('created_at', { ascending: false }).limit(50); if (!error && wl) scrapedList = wl; }
      const normalizeStatus = p => { const s = (p.status || '').toLowerCase(); if (s === 'archived') return 'archived'; if (s === 'published' || s === 'active') return 'active'; return 'draft'; };
      const combined = [...(manualList || []).map(p => ({ ...p, _source: 'manual', _normalizedStatus: normalizeStatus(p) })), ...scrapedList.map(p => ({ ...p, _source: 'scraped', _normalizedStatus: normalizeStatus(p) }))].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      const list = combined.map(property => {
        const diffMs = Date.now() - new Date(property.created_at).getTime();
        const diffMins = Math.floor(diffMs / 60000); const diffHours = Math.floor(diffMins / 60); const diffDays = Math.floor(diffHours / 24);
        const timeAgo = diffDays > 0 ? `${diffDays}d ago` : diffHours > 0 ? `${diffHours}h ago` : `${diffMins}m ago`;
        const title = property.slug?.replace(/-/g, ' ').replace(/\d+$/, '').trim() || property.full_address || property.address || 'Property';
        return { id: property.id, type: property._normalizedStatus === 'active' ? 'published' : 'draft', title, address: property.full_address || property.address || 'No address', price: `${currency}${parseFloat(property.price || 0).toLocaleString()}`, time: timeAgo };
      });
      setActivities(list);
    } catch { setActivities([]); } finally { setActivitiesLoading(false); }
  };

  const fetchBlockedUsers = async () => {
    if (!user?.id) return;
    try { setBlockedLoading(true); const res = await fetch('/api/seller/chat?action=get_blocked_users', { headers: { Authorization: `Bearer ${user.id}` } }); const data = await res.json().catch(() => ({})); setBlockedUsers(data?.blocked || []); }
    catch { setBlockedUsers([]); } finally { setBlockedLoading(false); }
  };

  const unblockConversation = async (conversationId) => {
    if (!user?.id || !conversationId) return;
    await fetch('/api/seller/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.id}` }, body: JSON.stringify({ action: 'update_conversation_pref', conversationId, is_blocked: false }) }).catch(() => {});
    fetchBlockedUsers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-2 border-hairline border-t-ink"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', url: '/settings' },
    { id: 'security', label: 'Security', url: '/settings?tab=security' },
    { id: 'activities', label: 'Activities', url: '/settings?tab=activities' },
    { id: 'blocked', label: 'Blocked users', url: '/settings?tab=blocked' },
  ];

  return (
    <div className="space-y-5 font-sans">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-[22px] tracking-[-0.02em] text-body">Settings</h1>
        <p className="text-[13px] text-muted mt-0.5">Manage your account settings and preferences</p>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-3 rounded-[9px] text-[13px] font-semibold text-ink bg-tint border-[1.5px] ${message.type === 'success' ? 'border-line' : 'border-ink'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-hairline pb-4">
        <div className="flex gap-2 flex-wrap">
          {tabs.map(tab => (
            <button key={tab.id}
              onClick={() => { setActiveTab(tab.id); router.replace(tab.url); }}
              className={`font-mono text-[11px] font-semibold uppercase tracking-[0.06em] border-[1.5px] border-ink rounded-pill px-3.5 py-2 transition-colors duration-120 ${
                activeTab === tab.id ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-tint'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-[12px] border-[1.5px] border-ink shadow-offset-4 overflow-hidden">
          <form onSubmit={handleProfileSubmit}>
            <div className="px-5 py-3 border-b border-hairline bg-tint-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted" />
                <h2 className="font-mono font-semibold text-[11px] uppercase tracking-[0.14em] text-ink">Personal Information</h2>
              </div>
            </div>
            <div className="px-5 py-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[13px] font-semibold text-body mb-1.5">Full Name <span className="text-ink">*</span></label>
                  <input type="text" value={profileForm.contact_person_name} onChange={(e) => setProfileForm({ ...profileForm, contact_person_name: e.target.value })}
                    className="w-full px-4 py-2.5 border-[1.5px] border-line rounded-[9px] text-[14px] text-body placeholder-mist focus:outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-200" placeholder="John Smith" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-body mb-1.5">Email Address</label>
                  <div className="flex items-center gap-2">
                    <input type="email" readOnly value={profileForm.email} className="flex-1 px-4 py-2.5 border-[1.5px] border-line rounded-[9px] bg-tint-3 text-[14px] text-muted" />
                    <button type="button" onClick={() => setEmailChange({ step: 'form', newEmail: '', password: '', otp: '', error: '', loading: false })}
                      className="px-4 py-2.5 text-[13px] font-semibold text-ink bg-white border-[1.5px] border-ink rounded-[9px] shadow-offset-2 hover:bg-tint transition-colors whitespace-nowrap">
                      Change
                    </button>
                  </div>
                  <p className="text-[11px] text-mist mt-1">We'll verify your new email before changing it.</p>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-body mb-1.5">Phone Number</label>
                  <div className="flex items-center gap-2">
                    <input type="tel" readOnly value={profileForm.phone} className="flex-1 px-4 py-2.5 border-[1.5px] border-line rounded-[9px] bg-tint-3 text-[14px] text-muted" />
                    <button type="button" onClick={() => setPhoneChange({ step: 'form', newPhone: '', password: '', otp: '', error: '', loading: false })}
                      className="px-4 py-2.5 text-[13px] font-semibold text-ink bg-white border-[1.5px] border-ink rounded-[9px] shadow-offset-2 hover:bg-tint transition-colors whitespace-nowrap">
                      Change
                    </button>
                  </div>
                  <p className="text-[11px] text-mist mt-1">We'll text a code to your new number to verify it.</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-y border-hairline bg-tint-3">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-muted" />
                <h2 className="font-mono font-semibold text-[11px] uppercase tracking-[0.14em] text-ink">Business Information</h2>
              </div>
            </div>
            <div className="px-5 py-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[13px] font-semibold text-body mb-1.5">Business/Company Name</label>
                  <input type="text" value={profileForm.business_name} onChange={(e) => setProfileForm({ ...profileForm, business_name: e.target.value })}
                    className="w-full px-4 py-2.5 border-[1.5px] border-line rounded-[9px] text-[14px] text-body placeholder-mist focus:outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-200" placeholder="ABC Real Estate" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-body mb-1.5">Business Type</label>
                  <select value={profileForm.business_type} onChange={(e) => setProfileForm({ ...profileForm, business_type: e.target.value })}
                    className="w-full px-4 py-2.5 border-[1.5px] border-line rounded-[9px] text-[14px] text-body focus:outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-200">
                    {businessTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-body mb-1.5">Average Deals Per Month</label>
                  <select value={profileForm.deals_per_month} onChange={(e) => setProfileForm({ ...profileForm, deals_per_month: e.target.value })}
                    className="w-full px-4 py-2.5 border-[1.5px] border-line rounded-[9px] text-[14px] text-body focus:outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-200">
                    {dealsPerMonth.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-body mb-1.5">Primary Markets/Locations</label>
                  <input type="text" value={profileForm.primary_markets} onChange={(e) => setProfileForm({ ...profileForm, primary_markets: e.target.value })}
                    className="w-full px-4 py-2.5 border-[1.5px] border-line rounded-[9px] text-[14px] text-body placeholder-mist focus:outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-200" placeholder="Miami, FL; Orlando, FL" />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-body mb-2">Property Types</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {propertyTypesList.map(type => (
                    <button key={type} type="button" onClick={() => togglePropertyType(type)}
                      className={`font-mono text-[11px] font-semibold tracking-[0.06em] px-3.5 py-2 rounded-pill border-[1.5px] border-ink transition-colors duration-120 ${
                        profileForm.property_types.includes(type) ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-tint'
                      }`}>{type}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[13px] font-semibold text-body mb-1.5">Website</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mist" />
                    <input type="url" value={profileForm.website} onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-[1.5px] border-line rounded-[9px] text-[14px] text-body placeholder-mist focus:outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-200" placeholder="https://example.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-body mb-1.5">LinkedIn Profile</label>
                  <div className="relative">
                    <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mist" />
                    <input type="url" value={profileForm.linkedin} onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-[1.5px] border-line rounded-[9px] text-[14px] text-body placeholder-mist focus:outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-200" placeholder="https://linkedin.com/in/..." />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-body mb-1.5">About Your Business</label>
                <textarea value={profileForm.description} onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })} rows={4}
                  className="w-full px-4 py-3 border-[1.5px] border-line rounded-[9px] text-[14px] text-body placeholder-mist focus:outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-200" placeholder="Tell us about your real estate business..." />
              </div>
            </div>
            <div className="px-5 py-4 bg-tint-3 border-t border-hairline">
              <button type="submit" disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-[10px] text-[14px] font-semibold bg-ink text-white border-[1.5px] border-ink shadow-soft-3 hover:bg-smoke-2 disabled:bg-hairline disabled:border-hairline disabled:text-muted disabled:cursor-not-allowed transition-all duration-120">
                {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Profile</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <>
        <div className="bg-white rounded-[12px] border-[1.5px] border-ink shadow-offset-4 p-6">
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <h2 className="font-display font-semibold text-[16.5px] tracking-[-0.01em] text-body mb-4">Change Password</h2>
            <div className="space-y-4 max-w-md">
              {[{ key: 'current_password', label: 'Current Password', placeholder: 'Enter current password', show: showPasswords.current, toggle: 'current' },
                { key: 'new_password', label: 'New Password', placeholder: 'Enter new password', show: showPasswords.new, toggle: 'new', hint: 'Must be at least 6 characters' },
                { key: 'confirm_password', label: 'Confirm New Password', placeholder: 'Confirm new password', show: showPasswords.confirm, toggle: 'confirm' }
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-[13px] font-semibold text-body mb-1.5">{field.label}</label>
                  <div className="relative">
                    <input type={field.show ? 'text' : 'password'} value={passwordForm[field.key]}
                      onChange={(e) => setPasswordForm({ ...passwordForm, [field.key]: e.target.value })}
                      className="w-full px-4 py-2.5 border-[1.5px] border-line rounded-[9px] text-[14px] text-body placeholder-mist focus:outline-none focus:border-ink focus:shadow-offset-3 pr-10 transition-all duration-200"
                      placeholder={field.placeholder} required />
                    <button type="button" onClick={() => setShowPasswords({ ...showPasswords, [field.toggle]: !field.show })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-mist hover:text-smoke-2">
                      {field.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {field.hint && <p className="text-[11px] text-mist mt-1">{field.hint}</p>}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4 border-t border-hairline">
              <button type="submit" disabled={saving}
                className="px-4 py-2.5 bg-ink text-white border-[1.5px] border-ink rounded-[10px] text-[13px] font-semibold shadow-soft-3 hover:bg-smoke-2 disabled:bg-hairline disabled:border-hairline disabled:text-muted disabled:cursor-not-allowed transition-all duration-120">
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Subscription management — buried at bottom of security tab */}
        {planInfo && ['trialing', 'active', 'canceling'].includes(planInfo.status) && (
          <div className="bg-white rounded-[12px] border-[1.5px] border-ink shadow-offset-4 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCancelSection(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-tint-3 transition-colors"
            >
              <span className="font-display font-semibold text-[15px] tracking-[-0.01em] text-body">Subscription management</span>
              {showCancelSection ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
            </button>

            {showCancelSection && (
              <div className="px-5 pb-5 pt-1 border-t border-hairline space-y-3">
                {planInfo.status === 'canceling' ? (
                  <div className="p-3 bg-tint border-[1.5px] border-line rounded-[9px] text-[13px] text-smoke-3">
                    Cancellation pending — your subscription remains active until{' '}
                    <strong>{planInfo.current_period_end ? new Date(planInfo.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'your next billing date'}</strong>.
                    After that, all your listings will be deactivated.
                  </div>
                ) : (
                  <>
                    <p className="text-[13px] text-muted">
                      Canceling will keep your account active until the end of the current billing period. After that, all listings will be deactivated and you won&apos;t be charged again.
                    </p>
                    {cancelDone ? (
                      <div className="p-3 bg-tint border-[1.5px] border-line rounded-[9px] text-[13px] text-smoke-3">
                        Subscription scheduled for cancellation. Your access continues until{' '}
                        <strong>{planInfo.current_period_end ? new Date(planInfo.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'your next billing date'}</strong>.
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setShowCancelConfirm(true); setCancelError(''); }}
                        className="px-4 py-2 rounded-[9px] bg-white border-[1.5px] border-ink shadow-offset-2 text-[13px] font-semibold text-ink hover:bg-tint transition-colors duration-120"
                      >
                        Cancel subscription
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cancel confirmation modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-[14px] border-[1.5px] border-ink shadow-offset-6 w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-5 h-5 text-smoke-3 flex-shrink-0" />
                <h3 className="font-display font-semibold text-[16.5px] tracking-[-0.01em] text-body">Cancel subscription?</h3>
              </div>
              <p className="text-[13px] text-muted">
                Your subscription will remain active until{' '}
                <strong className="text-body">{planInfo?.current_period_end ? new Date(planInfo.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'the end of your billing period'}</strong>.
                After that date, all your listings will be automatically deactivated and you will not be able to publish new listings without an active subscription.
              </p>
              {cancelError && (
                <p className="text-[12px] text-ink font-semibold">{cancelError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCancelConfirm(false); setCancelError(''); }}
                  className="flex-1 h-[40px] bg-white border-[1.5px] border-ink rounded-[9px] shadow-offset-2 text-[13px] font-semibold text-ink hover:bg-tint transition-colors"
                >
                  Keep subscription
                </button>
                <button
                  type="button"
                  disabled={cancelLoading}
                  onClick={async () => {
                    setCancelLoading(true);
                    setCancelError('');
                    try {
                      const res = await fetch('/api/seller/plan/cancel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ seller_id: user.id }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed to cancel subscription');
                      setPlanInfo(prev => ({ ...prev, status: 'canceling' }));
                      setCancelDone(true);
                      setShowCancelConfirm(false);
                    } catch (err) {
                      setCancelError(err.message);
                    } finally {
                      setCancelLoading(false);
                    }
                  }}
                  className="flex-1 h-[40px] bg-ink text-white border-[1.5px] border-ink rounded-[9px] text-[13px] font-semibold hover:bg-smoke-2 transition-colors disabled:opacity-50"
                >
                  {cancelLoading ? 'Processing…' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      )}

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <div className="bg-white rounded-[12px] border-[1.5px] border-ink shadow-offset-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline bg-tint-3">
            <h2 className="font-mono font-semibold text-[11px] uppercase tracking-[0.14em] text-ink">Activity timeline</h2>
            <p className="text-[11px] text-mist mt-0.5">Property updates and new listings</p>
          </div>
          <div className="divide-y divide-hairline max-h-[60vh] overflow-y-auto">
            {activitiesLoading ? (
              [...Array(5)].map((_, i) => <div key={i} className="flex items-center gap-4 px-4 py-4 motion-safe:animate-pulse"><div className="w-10 h-10 rounded bg-tint-3" /><div className="flex-1"><div className="h-4 w-48 bg-tint-3 rounded mb-2" /><div className="h-3 w-24 bg-tint-3 rounded" /></div></div>)
            ) : activities.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Building2 className="w-10 h-10 text-mist mx-auto mb-3" />
                <p className="text-[13px] text-muted">No activities yet</p>
                <Link href="/properties/new" className="inline-block mt-2 text-[13px] font-medium text-ink hover:text-smoke-2">Add your first property</Link>
              </div>
            ) : (
              activities.map(activity => (
                <div key={activity.id} className="flex items-start gap-3 px-4 py-3 hover:bg-tint-3 transition-colors duration-200">
                  <div className="w-9 h-9 rounded-[9px] bg-tint border border-hairline flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-ink" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-body">
                      {activity.type === 'published' ? 'Added' : 'Edited'}{' '}
                      <Link href={`/properties/edit/${activity.id}`} className="font-medium text-ink hover:text-smoke-2">{activity.title}</Link>
                    </p>
                    <p className="font-mono text-[11px] text-muted truncate">{activity.address}</p>
                    <p className="font-mono text-[11px] text-mist mt-0.5">{activity.time} · {activity.price}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Logout — profile tab only */}
      {activeTab === 'profile' && <div className="bg-white rounded-[12px] border-[1.5px] border-ink shadow-offset-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] font-semibold text-body">Sign out</p>
            <p className="text-[12px] text-muted mt-0.5">You will be returned to the login page</p>
          </div>
          <button
            type="button"
            onClick={() => { localStorage.removeItem('seller_user'); router.push('/login'); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[9px] bg-white border-[1.5px] border-ink shadow-offset-2 text-[13px] font-semibold text-ink hover:bg-tint transition-colors duration-120"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>}

      {/* Blocked Tab */}
      {activeTab === 'blocked' && (
        <div className="bg-white rounded-[12px] border-[1.5px] border-ink shadow-offset-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline bg-tint-3">
            <h2 className="font-mono font-semibold text-[11px] uppercase tracking-[0.14em] text-ink">Blocked users</h2>
            <p className="text-[11px] text-mist mt-0.5">Manage users you blocked from chats</p>
          </div>
          <div className="divide-y divide-hairline">
            {blockedLoading ? (
              <div className="px-4 py-8 text-[13px] text-muted">Loading...</div>
            ) : blockedUsers.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <ShieldBan className="w-10 h-10 text-mist mx-auto mb-2" />
                <p className="text-[13px] text-muted">No blocked users</p>
              </div>
            ) : (
              blockedUsers.map(row => (
                <div key={row.conversation_id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-body truncate">{row.buyer_name || 'Buyer'}</p>
                    <p className="font-mono text-[11px] text-mist truncate">Blocked {row.blocked_at ? new Date(row.blocked_at).toLocaleString() : ''}</p>
                  </div>
                  <button type="button" onClick={() => unblockConversation(row.conversation_id)}
                    className="px-3 py-1.5 text-[12px] font-semibold rounded-[8px] bg-white border-[1.5px] border-ink shadow-offset-2 text-ink hover:bg-tint transition-colors duration-120">
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {emailChange.step !== 'idle' && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-body/40" onClick={() => emailChange.loading ? null : setEmailChange({ step: 'idle', newEmail: '', password: '', otp: '', error: '', loading: false })} aria-hidden="true" />
          <div className="relative bg-white rounded-[14px] border-[1.5px] border-ink shadow-offset-6 max-w-md w-full p-6 z-10">
            {emailChange.step === 'form' ? (
              <>
                <h3 className="font-display font-semibold text-[16.5px] tracking-[-0.01em] text-body mb-1">Change email address</h3>
                <p className="text-[13px] text-muted mb-4">Enter your new email and current password. We'll send a verification code to the new address.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-body mb-1.5">New email address</label>
                    <input type="email" value={emailChange.newEmail} onChange={e => setEmailChange(s => ({ ...s, newEmail: e.target.value, error: '' }))}
                      placeholder="you@example.com"
                      className="w-full px-4 py-2.5 border-[1.5px] border-line rounded-[9px] text-[14px] text-body focus:outline-none focus:border-ink focus:shadow-offset-3" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-body mb-1.5">Current password</label>
                    <input type="password" value={emailChange.password} onChange={e => setEmailChange(s => ({ ...s, password: e.target.value, error: '' }))}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 border-[1.5px] border-line rounded-[9px] text-[14px] text-body focus:outline-none focus:border-ink focus:shadow-offset-3" />
                  </div>
                </div>
                {emailChange.error && <p className="text-[12px] text-ink font-semibold mt-2">{emailChange.error}</p>}
                <div className="flex items-center gap-3 mt-5">
                  <button type="button" onClick={() => setEmailChange({ step: 'idle', newEmail: '', password: '', otp: '', error: '', loading: false })}
                    className="flex-1 h-10 px-4 text-[13px] font-semibold text-ink bg-white border-[1.5px] border-ink rounded-[9px] shadow-offset-2 hover:bg-tint transition-colors">Cancel</button>
                  <button type="button" onClick={requestEmailChange} disabled={emailChange.loading || !emailChange.newEmail || !emailChange.password}
                    className="flex-1 h-10 px-4 text-[13px] font-semibold text-white bg-ink border-[1.5px] border-ink hover:bg-smoke-2 rounded-[10px] shadow-soft-3 transition-colors disabled:opacity-50">
                    {emailChange.loading ? 'Sending…' : 'Send code'}</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-display font-semibold text-[16.5px] tracking-[-0.01em] text-body mb-1">Enter verification code</h3>
                <p className="text-[13px] text-muted mb-4">We sent a 6-digit code to <strong className="text-body">{emailChange.newEmail}</strong>. Enter it below to confirm.</p>
                <input type="text" inputMode="numeric" maxLength={6} value={emailChange.otp} onChange={e => setEmailChange(s => ({ ...s, otp: e.target.value.replace(/\D/g, ''), error: '' }))}
                  placeholder="000000"
                  className="w-full px-4 py-2.5 border-[1.5px] border-line rounded-[9px] font-mono text-[18px] tracking-[8px] text-center text-body focus:outline-none focus:border-ink focus:shadow-offset-3" />
                {emailChange.error && <p className="text-[12px] text-ink font-semibold mt-2">{emailChange.error}</p>}
                <div className="flex items-center gap-3 mt-5">
                  <button type="button" onClick={() => setEmailChange(s => ({ ...s, step: 'form', otp: '', error: '' }))}
                    className="flex-1 h-10 px-4 text-[13px] font-semibold text-ink bg-white border-[1.5px] border-ink rounded-[9px] shadow-offset-2 hover:bg-tint transition-colors">Back</button>
                  <button type="button" onClick={verifyEmailChange} disabled={emailChange.loading || emailChange.otp.length !== 6}
                    className="flex-1 h-10 px-4 text-[13px] font-semibold text-white bg-ink border-[1.5px] border-ink hover:bg-smoke-2 rounded-[10px] shadow-soft-3 transition-colors disabled:opacity-50">
                    {emailChange.loading ? 'Verifying…' : 'Confirm email'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {phoneChange.step !== 'idle' && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-body/40" onClick={() => phoneChange.loading ? null : setPhoneChange({ step: 'idle', newPhone: '', password: '', otp: '', error: '', loading: false })} aria-hidden="true" />
          <div className="relative bg-white rounded-[14px] border-[1.5px] border-ink shadow-offset-6 max-w-md w-full p-6 z-10">
            {phoneChange.step === 'form' ? (
              <>
                <h3 className="font-display font-semibold text-[16.5px] tracking-[-0.01em] text-body mb-1">Change phone number</h3>
                <p className="text-[13px] text-muted mb-4">Enter your new number and current password. We'll text a verification code to the new number.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-body mb-1.5">New phone number</label>
                    <input type="tel" value={phoneChange.newPhone} onChange={e => setPhoneChange(s => ({ ...s, newPhone: e.target.value, error: '' }))}
                      placeholder="(555) 123-4567"
                      className="w-full px-4 py-2.5 border-[1.5px] border-line rounded-[9px] text-[14px] text-body focus:outline-none focus:border-ink focus:shadow-offset-3" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-body mb-1.5">Current password</label>
                    <input type="password" value={phoneChange.password} onChange={e => setPhoneChange(s => ({ ...s, password: e.target.value, error: '' }))}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 border-[1.5px] border-line rounded-[9px] text-[14px] text-body focus:outline-none focus:border-ink focus:shadow-offset-3" />
                  </div>
                </div>
                {phoneChange.error && <p className="text-[12px] text-ink font-semibold mt-2">{phoneChange.error}</p>}
                <div className="flex items-center gap-3 mt-5">
                  <button type="button" onClick={() => setPhoneChange({ step: 'idle', newPhone: '', password: '', otp: '', error: '', loading: false })}
                    className="flex-1 h-10 px-4 text-[13px] font-semibold text-ink bg-white border-[1.5px] border-ink rounded-[9px] shadow-offset-2 hover:bg-tint transition-colors">Cancel</button>
                  <button type="button" onClick={requestPhoneChange} disabled={phoneChange.loading || !phoneChange.newPhone || !phoneChange.password}
                    className="flex-1 h-10 px-4 text-[13px] font-semibold text-white bg-ink border-[1.5px] border-ink hover:bg-smoke-2 rounded-[10px] shadow-soft-3 transition-colors disabled:opacity-50">
                    {phoneChange.loading ? 'Sending…' : 'Send code'}</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-display font-semibold text-[16.5px] tracking-[-0.01em] text-body mb-1">Enter verification code</h3>
                <p className="text-[13px] text-muted mb-4">We texted a 6-digit code to <strong className="text-body">{phoneChange.newPhone}</strong>. Enter it below to confirm.</p>
                <input type="text" inputMode="numeric" maxLength={6} value={phoneChange.otp} onChange={e => setPhoneChange(s => ({ ...s, otp: e.target.value.replace(/\D/g, ''), error: '' }))}
                  placeholder="000000"
                  className="w-full px-4 py-2.5 border-[1.5px] border-line rounded-[9px] font-mono text-[18px] tracking-[8px] text-center text-body focus:outline-none focus:border-ink focus:shadow-offset-3" />
                {phoneChange.error && <p className="text-[12px] text-ink font-semibold mt-2">{phoneChange.error}</p>}
                <div className="flex items-center gap-3 mt-5">
                  <button type="button" onClick={() => setPhoneChange(s => ({ ...s, step: 'form', otp: '', error: '' }))}
                    className="flex-1 h-10 px-4 text-[13px] font-semibold text-ink bg-white border-[1.5px] border-ink rounded-[9px] shadow-offset-2 hover:bg-tint transition-colors">Back</button>
                  <button type="button" onClick={verifyPhoneChange} disabled={phoneChange.loading || phoneChange.otp.length !== 6}
                    className="flex-1 h-10 px-4 text-[13px] font-semibold text-white bg-ink border-[1.5px] border-ink hover:bg-smoke-2 rounded-[10px] shadow-soft-3 transition-colors disabled:opacity-50">
                    {phoneChange.loading ? 'Verifying…' : 'Confirm phone'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
