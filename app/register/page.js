"use client"

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { User, Mail, Lock, Phone, CheckCircle, AlertCircle, Loader2, Building, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function MagicLinkRegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenData, setTokenData] = useState(null)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [formData, setFormData] = useState({
    contact_person_name: '',
    email: '',
    password: '',
    confirm_password: '',
    business_name: '',
    description: ''
  })

  // Validate magic link token directly from Supabase
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setMessage({ type: 'error', text: 'No registration token provided' })
        setLoading(false)
        return
      }

      try {
        // Query magic_link_tokens table directly
        const { data: tokenRecord, error } = await supabase
          .from('magic_link_tokens')
          .select('*')
          .eq('token', token)
          .single()

        if (error || !tokenRecord) {
          setMessage({ type: 'error', text: 'Invalid or expired registration link' })
          setLoading(false)
          return
        }

        // Check if token is already used
        if (tokenRecord.used) {
          setMessage({ type: 'error', text: 'This registration link has already been used' })
          setLoading(false)
          return
        }

        // Check if token is expired
        const now = new Date()
        const expiresAt = new Date(tokenRecord.expires_at)
        if (now > expiresAt) {
          setMessage({ type: 'error', text: 'This registration link has expired' })
          setLoading(false)
          return
        }

        // Token is valid
        setTokenValid(true)
        setTokenData({
          temp_seller_id: tokenRecord.temp_seller_id,
          property_id: tokenRecord.property_id,
          phone_number: tokenRecord.phone_number,
          property_address: tokenRecord.property_address,
          views_count: tokenRecord.views_count
        })
      } catch (error) {
        console.error('Error validating token:', error)
        setMessage({ type: 'error', text: 'Failed to validate registration link' })
      } finally {
        setLoading(false)
      }
    }

    validateToken()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage({ type: '', text: '' })

    // Validation
    if (formData.password !== formData.confirm_password) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      setSubmitting(false)
      return
    }

    if (formData.password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          phone: tokenData.phone_number,
          property_address: tokenData.property_address,
          contact_person_name: formData.contact_person_name,
          email: formData.email,
          password: formData.password,
          business_name: formData.business_name,
          description: formData.description
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Registration successful! Redirecting to login...' })

        // Store user session
        if (typeof window !== 'undefined') {
          localStorage.setItem('seller_user', JSON.stringify(data.user))
        }

        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } else {
        setMessage({ type: 'error', text: data.error || 'Registration failed' })
      }
    } catch (error) {
      console.error('Registration error:', error)
      setMessage({ type: 'error', text: 'An error occurred during registration' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#112F58] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Validating your registration link...</p>
        </div>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-gray-600 mb-6">{message.text || 'This registration link is invalid or has expired.'}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-[#112F58] text-white rounded-lg hover:bg-[#0d243f] transition-colors"
          >
            Go to Login
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#112F58] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Registration</h1>
          <p className="text-gray-600">
            Your property at <span className="font-semibold">{tokenData?.property_address}</span> has received{' '}
            <span className="font-semibold text-[#112F58]">{tokenData?.views_count} views</span>!
          </p>
        </div>

        {/* Alert Message */}
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
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
            <span className="text-sm font-medium">{message.text}</span>
          </motion.div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Contact Person Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={formData.contact_person_name}
                  onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
                  placeholder="John Smith"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            {/* Phone (Pre-filled, Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  readOnly
                  value={tokenData?.phone_number}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">This is the phone number associated with your property</p>
            </div>

            {/* Business Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Business/Company Name
              </label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
                  placeholder="ABC Real Estate"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              About Your Business (Optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#112F58] focus:border-transparent"
                placeholder="Tell us about your real estate business..."
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
              submitting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#112F58] text-white hover:bg-[#0d243f]'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Complete Registration</span>
            )}
          </button>

          {/* Footer */}
          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-[#112F58] hover:underline font-semibold"
            >
              Sign in here
            </button>
          </p>
        </form>
      </motion.div>
    </div>
  )
}
