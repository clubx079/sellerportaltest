"use client"

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  User, Mail, Phone, Building, FileText, Globe, Linkedin, Save,
  CheckCircle, AlertCircle, Loader2, TrendingUp, Home, DollarSign
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [userData, setUserData] = useState(null)

  const [formData, setFormData] = useState({
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
  })

  const businessTypes = [
    { value: 'individual', label: 'Individual Seller' },
    { value: 'real_estate_agent', label: 'Real Estate Agent' },
    { value: 'brokerage', label: 'Brokerage' },
    { value: 'property_management', label: 'Property Management' },
    { value: 'investment_firm', label: 'Investment Firm' },
    { value: 'other', label: 'Other' }
  ]

  const dealsPerMonth = [
    { value: 'not_specified', label: 'Not Specified' },
    { value: '1-5', label: '1-5 deals per month' },
    { value: '6-10', label: '6-10 deals per month' },
    { value: '11-20', label: '11-20 deals per month' },
    { value: '20+', label: '20+ deals per month' }
  ]

  const propertyTypesList = [
    'Residential',
    'Commercial',
    'Land',
    'Multi-Family',
    'Industrial',
    'Retail',
    'Office',
    'Mixed-Use'
  ]

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)

      // Get current user from localStorage
      const userStr = localStorage.getItem('seller_user')
      if (!userStr) {
        window.location.href = '/login'
        return
      }

      const user = JSON.parse(userStr)
      setUserData(user)

      // Fetch full profile from database
      const { data, error } = await supabase
        .from('seller_applications')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (data) {
        setFormData({
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
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      setMessage({ type: 'error', text: 'Failed to load profile' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage({ type: '', text: '' })

      if (!userData) {
        setMessage({ type: 'error', text: 'User not found' })
        return
      }

      // Update profile in database
      const { error } = await supabase
        .from('seller_applications')
        .update({
          contact_person_name: formData.contact_person_name,
          business_name: formData.business_name,
          business_type: formData.business_type,
          deals_per_month: formData.deals_per_month,
          primary_markets: formData.primary_markets,
          property_types: formData.property_types,
          website: formData.website,
          linkedin: formData.linkedin,
          description: formData.description,
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Profile updated successfully!' })

      // Update localStorage
      const updatedUser = { ...userData, ...formData }
      localStorage.setItem('seller_user', JSON.stringify(updatedUser))

    } catch (error) {
      console.error('Error saving profile:', error)
      setMessage({ type: 'error', text: 'Failed to save profile' })
    } finally {
      setSaving(false)
    }
  }

  const togglePropertyType = (type) => {
    setFormData(prev => ({
      ...prev,
      property_types: prev.property_types.includes(type)
        ? prev.property_types.filter(t => t !== type)
        : [...prev.property_types, type]
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 text-[#112F58] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 font-['Inter',system-ui,-apple-system,sans-serif]">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-600 mt-1.5">Manage your seller profile and business information</p>
      </div>

      {/* Alert Message */}
      {message.text && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-base font-medium">{message.text}</span>
        </motion.div>
      )}

      {/* Profile Form */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

        {/* Personal Information */}
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
          </div>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Contact Person Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.contact_person_name}
                onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
                placeholder="John Smith"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Email Address
              </label>
              <input
                type="email"
                readOnly
                value={formData.email}
                className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            {/* Phone (Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                readOnly
                value={formData.phone}
                className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Phone number cannot be changed</p>
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
            {/* Business Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Business/Company Name
              </label>
              <input
                type="text"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
                placeholder="ABC Real Estate"
              />
            </div>

            {/* Business Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Business Type
              </label>
              <select
                value={formData.business_type}
                onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
              >
                {businessTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Deals Per Month */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Average Deals Per Month
              </label>
              <select
                value={formData.deals_per_month}
                onChange={(e) => setFormData({ ...formData, deals_per_month: e.target.value })}
                className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
              >
                {dealsPerMonth.map(deal => (
                  <option key={deal.value} value={deal.value}>{deal.label}</option>
                ))}
              </select>
            </div>

            {/* Primary Markets */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Primary Markets/Locations
              </label>
              <input
                type="text"
                value={formData.primary_markets}
                onChange={(e) => setFormData({ ...formData, primary_markets: e.target.value })}
                className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
                placeholder="Miami, FL; Orlando, FL"
              />
            </div>
          </div>

          {/* Property Types */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Property Types
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {propertyTypesList.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => togglePropertyType(type)}
                  className={`px-4 py-2.5 rounded-lg border-2 transition-all text-sm font-medium ${
                    formData.property_types.includes(type)
                      ? 'border-[#112F58] bg-[#112F58] text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-[#112F58]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Website & LinkedIn */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Website
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                LinkedIn Profile
              </label>
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="url"
                  value={formData.linkedin}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              About Your Business
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
              placeholder="Tell us about your real estate business, expertise, and what makes you unique..."
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-base font-semibold transition-colors ${
              saving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#112F58] text-white hover:bg-[#0d243f]'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Profile</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
