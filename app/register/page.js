"use client"

import React, { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Mail, Lock, Phone, CheckCircle, AlertCircle, Loader2, Building, FileText, Eye, EyeOff, MapPin, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Brand tokens ───────────────────────────────────────────────
const T = {
  primary:        '#D03839',
  primaryHover:   '#E0493B',
  primarySurface: '#FEF0EF',
  primaryBorder:  '#F5C4C0',
  textPrimary:    '#1A1816',
  textBody:       '#444441',
  textSecondary:  '#737370',
  textMuted:      '#A8A8A4',
  bgWhite:        '#FFFFFF',
  bgSurface:      '#FAFAF8',
  borderLight:    '#E8E8E4',
  success:        '#0F6E56',
  successSurface: '#E4F5EC',
  successBorder:  '#B3DFC5',
}

const inputStyle = {
  width: '100%',
  height: '48px',
  paddingLeft: '40px',
  paddingRight: '16px',
  border: `1px solid ${T.borderLight}`,
  borderRadius: '4px',
  background: T.bgWhite,
  color: T.textPrimary,
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
}

const readonlyInputStyle = {
  ...inputStyle,
  background: T.bgSurface,
  color: T.textSecondary,
  cursor: 'default',
}

function InputField({ icon: Icon, label, required, hint, children, textarea }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: T.textBody, marginBottom: '6px' }}>
        {label}{required && <span style={{ color: T.primary, marginLeft: '3px' }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <Icon style={{ position: 'absolute', left: '12px', top: textarea ? '14px' : '50%', transform: textarea ? 'none' : 'translateY(-50%)', width: '16px', height: '16px', color: T.textMuted, pointerEvents: 'none' }} />
        {children}
      </div>
      {hint && <p style={{ marginTop: '4px', fontSize: '11px', color: T.textSecondary }}>{hint}</p>}
    </div>
  )
}

function MagicLinkRegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenData, setTokenData] = useState(null)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [logoError, setLogoError] = useState(false)

  const [formData, setFormData] = useState({
    contact_person_name: '',
    email: '',
    password: '',
    confirm_password: '',
    business_name: '',
    description: ''
  })

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setMessage({ type: 'error', text: 'No registration token provided' })
        setLoading(false)
        return
      }

      try {
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

        if (tokenRecord.used) {
          setMessage({ type: 'error', text: 'This registration link has already been used' })
          setLoading(false)
          return
        }

        const now = new Date()
        const expiresAt = new Date(tokenRecord.expires_at)
        if (now > expiresAt) {
          setMessage({ type: 'error', text: 'This registration link has expired' })
          setLoading(false)
          return
        }

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

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    if (message.type === 'error') setMessage({ type: '', text: '' })
  }

  const handleFocus = (e) => {
    e.target.style.borderColor = T.primary
    e.target.style.boxShadow = `0 0 0 3px rgba(208, 56, 57, 0.12)`
  }
  const handleBlur = (e) => {
    e.target.style.borderColor = T.borderLight
    e.target.style.boxShadow = 'none'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage({ type: '', text: '' })

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
        setMessage({ type: 'success', text: 'Account created! Taking you to your dashboard...' })
        if (typeof window !== 'undefined') {
          localStorage.setItem('seller_user', JSON.stringify(data.user))
        }
        setTimeout(() => router.push('/dashboard'), 2000)
      } else {
        setMessage({ type: 'error', text: data.error || 'Registration failed. Please try again.' })
      }
    } catch (error) {
      console.error('Registration error:', error)
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Logo component ─────────────────────────────────────────────
  const Logo = () => (
    <div className="login-logo-enter absolute top-4 left-4 sm:left-8 z-20 flex items-center gap-2">
      <div style={{ height: '56px', width: '160px', display: 'flex', alignItems: 'center' }}>
        {!logoError ? (
          <Image src="/logo.svg" alt="DeelMap" width={160} height={56} style={{ height: '56px', width: 'auto', objectFit: 'contain' }} priority onError={() => setLogoError(true)} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '36px', height: '36px', background: T.textPrimary, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin style={{ width: '18px', height: '18px', color: '#fff' }} />
            </div>
            <span style={{ fontWeight: 600, fontSize: '16px', color: T.textPrimary }}>DeelMap</span>
          </div>
        )}
      </div>
    </div>
  )

  // ── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bgWhite, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Logo />
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: '40px', height: '40px', color: T.primary, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '14px', color: T.textSecondary }}>Validating your registration link...</p>
        </div>
      </div>
    )
  }

  // ── Invalid token state ────────────────────────────────────────
  if (!tokenValid) {
    return (
      <div style={{ minHeight: '100vh', background: T.bgWhite, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <Logo />
        <div style={{ background: T.bgWhite, border: `1px solid ${T.borderLight}`, borderRadius: '4px', padding: '40px 32px', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '52px', height: '52px', background: T.primarySurface, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <AlertCircle style={{ width: '24px', height: '24px', color: T.primary }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: T.textPrimary, marginBottom: '8px' }}>Link Invalid</h2>
          <p style={{ fontSize: '14px', color: T.textBody, marginBottom: '24px', lineHeight: '1.5' }}>
            {message.text || 'This registration link is invalid or has expired.'}
          </p>
          <button
            onClick={() => router.push('/login')}
            style={{ width: '100%', height: '44px', background: T.primary, color: '#fff', border: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = T.primaryHover}
            onMouseLeave={e => e.currentTarget.style.background = T.primary}
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  // ── Main registration form ─────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.bgWhite, paddingTop: '80px', paddingBottom: '40px' }}>
      <Logo />

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '48px', height: '48px', background: T.primarySurface, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle style={{ width: '22px', height: '22px', color: T.primary }} />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: T.textPrimary, marginBottom: '6px' }}>
            Complete Your Registration
          </h1>
          <p style={{ fontSize: '14px', color: T.textBody }}>
            Create your DeelMap seller account to manage your listings
          </p>
        </div>

        {/* Property info banner */}
        <div style={{ background: T.bgSurface, border: `1px solid ${T.borderLight}`, borderRadius: '4px', padding: '14px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', background: T.primarySurface, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MapPin style={{ width: '16px', height: '16px', color: T.primary }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.textSecondary, marginBottom: '2px' }}>Your Property</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tokenData?.property_address}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, background: T.primarySurface, border: `1px solid ${T.primaryBorder}`, borderRadius: '100px', padding: '4px 10px' }}>
            <TrendingUp style={{ width: '12px', height: '12px', color: T.primary }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: T.primary }}>{tokenData?.views_count} views</span>
          </div>
        </div>

        {/* Alert message */}
        {message.text && (
          <div style={{
            marginBottom: '16px', padding: '12px 14px', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', gap: '10px',
            background: message.type === 'success' ? T.successSurface : T.primarySurface,
            border: `1px solid ${message.type === 'success' ? T.successBorder : T.primaryBorder}`,
          }}>
            {message.type === 'success'
              ? <CheckCircle style={{ width: '16px', height: '16px', color: T.success, flexShrink: 0, marginTop: '1px' }} />
              : <AlertCircle style={{ width: '16px', height: '16px', color: T.primary, flexShrink: 0, marginTop: '1px' }} />}
            <span style={{ fontSize: '13px', fontWeight: 500, color: message.type === 'success' ? T.success : T.primary, lineHeight: '1.4' }}>
              {message.text}
            </span>
          </div>
        )}

        {/* Form card */}
        <div style={{
          background: T.bgWhite, border: `1px solid ${T.borderLight}`, borderRadius: '4px', padding: '28px',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.02), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Red top accent bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${T.primary} 0%, ${T.primaryHover} 50%, ${T.primary} 100%)` }} />

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '18px' }}>

              {/* Name */}
              <InputField icon={User} label="Your Name" required>
                <input
                  type="text"
                  required
                  value={formData.contact_person_name}
                  onChange={handleChange('contact_person_name')}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="John Smith"
                  style={inputStyle}
                />
              </InputField>

              {/* Email */}
              <InputField icon={Mail} label="Email Address" required>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange('email')}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="john@example.com"
                  style={inputStyle}
                />
              </InputField>

              {/* Phone (read-only) */}
              <InputField icon={Phone} label="Phone Number" hint="Associated with your property">
                <input
                  type="tel"
                  readOnly
                  value={tokenData?.phone_number}
                  style={readonlyInputStyle}
                />
              </InputField>

              {/* Business name */}
              <InputField icon={Building} label="Business / Company Name">
                <input
                  type="text"
                  value={formData.business_name}
                  onChange={handleChange('business_name')}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="ABC Real Estate"
                  style={inputStyle}
                />
              </InputField>

              {/* Password */}
              <InputField icon={Lock} label="Password" required hint="Minimum 6 characters">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={handleChange('password')}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: '40px' }}
                />
                <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 0, display: 'flex' }}>
                  {showPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                </button>
              </InputField>

              {/* Confirm Password */}
              <InputField icon={Lock} label="Confirm Password" required>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={formData.confirm_password}
                  onChange={handleChange('confirm_password')}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: '40px' }}
                />
                <button type="button" onClick={() => setShowConfirm(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 0, display: 'flex' }}>
                  {showConfirm ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                </button>
              </InputField>
            </div>

            {/* Description – full width */}
            <div style={{ marginTop: '18px' }}>
              <InputField icon={FileText} label="About Your Business (Optional)" textarea>
                <textarea
                  value={formData.description}
                  onChange={handleChange('description')}
                  rows={3}
                  placeholder="Tell us about your real estate business..."
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  style={{
                    ...inputStyle,
                    height: 'auto',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    resize: 'vertical',
                    minHeight: '88px',
                  }}
                />
              </InputField>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: '22px', width: '100%', height: '48px',
                background: submitting ? T.borderLight : T.primary,
                color: submitting ? T.textSecondary : '#FFFFFF',
                border: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = T.primaryHover }}
              onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = T.primary }}
            >
              {submitting ? (
                <>
                  <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Complete Registration</span>
              )}
            </button>

            {/* Footer */}
            <p style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: T.textSecondary }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/login')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.primary, fontWeight: 600, fontSize: '13px', padding: 0 }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
              >
                Sign in here
              </button>
            </p>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '11px', color: T.textMuted, marginTop: '20px' }}>
          © {new Date().getFullYear()} DeelMap. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default function MagicLinkRegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ width: '40px', height: '40px', color: '#D03839', animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <MagicLinkRegisterContent />
    </Suspense>
  )
}
