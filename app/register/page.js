"use client"

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { User, Mail, Lock, Phone, AlertCircle, Loader2, Building, FileText, Eye, EyeOff, MapPin, TrendingUp, Check, ChevronRight, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { pushEvent } from '@/lib/gtm'
import { Logo } from '@/components/ui/Logo'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

// ─── Brand tokens ────────────────────────────────────────────────────────────
const T = {
  primary:        '#111111',
  primaryHover:   '#444444',
  primarySurface: '#f2f2f2',
  primaryBorder:  '#111111',
  textPrimary:    '#171717',
  textBody:       '#444444',
  textSecondary:  '#757575',
  textMuted:      '#a3a3a3',
  bgWhite:        '#FFFFFF',
  bgSurface:      '#fafafa',
  borderLight:    '#cccccc',
  success:        '#111111',
  successSurface: '#f2f2f2',
  successBorder:  '#111111',
}
const MONO = "var(--font-plex-mono), 'IBM Plex Mono', monospace"
const DISPLAY = "var(--font-archivo), Archivo, sans-serif"
const CARD_STYLE = {
  background: '#ffffff', border: '1.5px solid #111111', borderRadius: '16px',
  boxShadow: '6px 6px 0 #111111',
}

const inputStyle = {
  width: '100%', height: '48px', paddingLeft: '40px', paddingRight: '16px',
  border: `1.5px solid ${T.borderLight}`, borderRadius: '9px', background: T.bgWhite,
  color: T.textPrimary, fontSize: '14px', outline: 'none',
  transition: 'border-color 0.12s ease, box-shadow 0.12s ease',
}

const readonlyInputStyle = {
  ...inputStyle, background: T.bgSurface, color: T.textSecondary, cursor: 'default',
}

// ─── Step indicator ───────────────────────────────────────────────────────────
const STEPS = ['Account', 'Choose Plan', 'Payment']

function StepDots({ current }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
          Step {current + 1} of {STEPS.length}
        </span>
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink">
          {STEPS[current]}
        </span>
      </div>
      {/* Segmented ink progress bars */}
      <div className="flex gap-1.5">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={`flex-1 h-1.5 rounded-pill border-[1.5px] border-ink transition-colors duration-120 ${i <= current ? 'bg-ink' : 'bg-white'}`}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Plan cards ───────────────────────────────────────────────────────────────
const PRO_FEATURES = [
  [true,  'Verified seller badge'],
  [true,  'Advanced seller dashboard'],
  [true,  'Advanced analytics'],
  [true,  'Priority search placement'],
  [true,  'Priority support'],
  [true,  '5 listings / month'],
  [false, 'CRM features'],
  [false, 'Team accounts'],
]

const ENT_FEATURES = [
  [true, 'Everything in Pro'],
  [true, 'Unlimited listings'],
  [true, 'Basic CRM features'],
  [true, 'Lead management tools'],
  [true, 'Team accounts'],
  [true, 'Custom branding'],
  [true, 'Dedicated account support'],
  [true, 'API access · soon'],
]

function PlanCard({ id, selected, annual, onSelect }) {
  const isPro = id === 'pro'
  const isSelected = selected === id
  const price = isPro ? (annual ? '79' : '99') : (annual ? '239' : '299')
  const billingNote = annual
    ? (isPro ? 'Billed annually · $948/yr · 5 listings included' : 'Billed annually · $2,868/yr · unlimited listings')
    : (isPro ? 'Billed monthly · 5 listings included' : 'Billed monthly · unlimited listings')
  const savingsNote = annual
    ? (isPro ? 'Save $240 vs monthly' : 'Save $720 vs monthly')
    : (isPro ? '$19 per additional listing' : '\u00a0')
  const features = isPro ? PRO_FEATURES : ENT_FEATURES

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`w-full text-left rounded-[14px] p-5 flex flex-col border-[1.5px] transition-all duration-120 bg-white ${
        isSelected ? 'border-ink shadow-offset-4' : 'border-line hover:border-ink'
      }`}
    >
      <div className="min-h-[24px] mb-3">
        {isPro && !isSelected && <span className="inline-block font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] bg-tint text-ink border-[1.5px] border-ink px-2.5 py-0.5 rounded-pill">Most popular</span>}
        {isSelected && <span className="inline-block font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] bg-ink text-white border-[1.5px] border-ink px-2.5 py-0.5 rounded-pill">Selected</span>}
      </div>
      <p className="font-mono text-[10.5px] font-semibold tracking-[0.09em] uppercase text-muted mb-1">Subscription</p>
      <h2 className="font-display text-2xl font-bold text-body tracking-[-0.025em] mb-1">{isPro ? 'Pro Seller' : 'Enterprise'}</h2>
      <p className="text-xs text-smoke-4 leading-relaxed mb-4">
        {isPro ? 'For active investors and wholesalers moving deals consistently.' : 'For acquisition teams running high-volume pipelines.'}
      </p>
      {annual ? (
        <>
          <div className="flex items-end gap-1.5 leading-none mb-1">
            <span className="font-display text-[38px] font-bold text-body tracking-[-0.025em] leading-none">
              <sup className="text-lg font-normal align-super">$</sup>{isPro ? '948' : '2,868'}
            </span>
            <span className="text-sm font-normal text-smoke-4 mb-1">/ year</span>
          </div>
          <p className="font-mono text-[11px] text-muted mb-1">{isPro ? '$79/mo · billed as $948 upfront' : '$239/mo · billed as $2,868 upfront'}</p>
          <p className="font-mono text-[11px] font-semibold text-ink mb-4">{isPro ? 'Save $240 vs monthly' : 'Save $720 vs monthly'}</p>
        </>
      ) : (
        <>
          <div className="flex items-end gap-1.5 leading-none mb-1">
            <span className="font-display text-[38px] font-bold text-body tracking-[-0.025em] leading-none">
              <sup className="text-lg font-normal align-super">$</sup>{price}
            </span>
            <span className="text-sm font-normal text-smoke-4 mb-1">/ per month</span>
          </div>
          <p className="font-mono text-[11px] text-muted mb-1">{billingNote}</p>
          <p className="font-mono text-[11px] text-mist mb-4">{savingsNote}</p>
        </>
      )}
      <div className={`w-full py-2 text-center font-mono text-[11px] font-semibold tracking-[0.05em] uppercase rounded-[10px] border-[1.5px] mb-4 transition-colors duration-120 ${
        isSelected ? 'bg-ink text-white border-ink' : 'border-ink text-ink bg-white'
      }`}>
        {isSelected ? 'Selected' : 'Select plan'}
      </div>
      <hr className="border-t border-hairline mb-4" />
      <p className="font-mono text-[10.5px] font-semibold tracking-[0.09em] uppercase text-muted mb-3">Includes</p>
      <ul className="flex flex-col gap-1.5">
        {features.map(([on, label], i) => (
          <li key={i} className={`flex items-start gap-2 text-xs leading-snug ${on ? 'text-body' : 'text-mist'}`}>
            <span className={`flex-shrink-0 mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center border-[1.5px] ${on ? 'bg-ink border-ink' : 'border-line'}`}>
              {on && <svg width="7" height="5" viewBox="0 0 7 5" fill="none"><path d="M1 2.5L2.8 4.2L6 1" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
            {label}
          </li>
        ))}
      </ul>
    </button>
  )
}

// ─── Checkout form (no trial) ─────────────────────────────────────────────────
function CheckoutForm({ planType, billingCycle, intentType, discount, onSuccess }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  const handlePay = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    setError(null)
    const { error: submitErr } = await elements.submit()
    if (submitErr) { setError(submitErr.message); setProcessing(false); return }
    const confirmFn = intentType === 'setup' ? stripe.confirmSetup : stripe.confirmPayment
    const result = await confirmFn.call(stripe, { elements, redirect: 'if_required' })
    if (result.error) {
      setError(result.error.message)
    } else {
      const intent = result.setupIntent || result.paymentIntent
      const pmId = typeof intent?.payment_method === 'string' ? intent.payment_method : intent?.payment_method?.id
      onSuccess(pmId || null, finalAmount)
    }
    setProcessing(false)
  }

  const isAnnual = billingCycle === 'annual'
  const isPro = planType === 'pro'
  const monthlyPrice = isPro ? 99 : 299
  const annualTotal = isPro ? 948 : 2868
  const planName = isPro ? 'Pro Seller' : 'Enterprise'
  const baseAmount = isAnnual ? annualTotal : monthlyPrice

  const discountAmount = discount
    ? discount.type === 'percent'
      ? (baseAmount * discount.value / 100)
      : Math.min(discount.value, baseAmount)
    : 0
  const finalAmount = baseAmount - discountAmount
  const chargeLabel = isAnnual ? `$${finalAmount.toLocaleString()} / year` : `$${finalAmount} / month`

  return (
    <form onSubmit={handlePay} className="space-y-4">
      {/* Order Summary */}
      <div className="rounded-[10px] border-[1.5px] border-line overflow-hidden">
        <div className="bg-tint-2 px-4 py-2.5 border-b-[1.5px] border-line">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Order Summary</p>
        </div>
        <div className="bg-white px-4 py-4 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[13px] font-semibold text-body">{planName}</p>
              <p className="font-mono text-[10.5px] text-muted mt-0.5">{isAnnual ? 'Annual billing · billed as one payment' : 'Monthly billing · cancel anytime'}</p>
            </div>
            <p className="font-mono text-[13px] font-semibold text-body">{isAnnual ? `$${annualTotal.toLocaleString()}` : `$${monthlyPrice}`}</p>
          </div>
          {discount && (
            <div className="flex justify-between items-center">
              <p className="text-[12px] text-ink">
                Promo: {discount.name} ({discount.type === 'percent' ? `${discount.value}% off` : `$${discount.value} off`})
              </p>
              <p className="font-mono text-[12px] font-semibold text-ink">−${discountAmount % 1 === 0 ? discountAmount : discountAmount.toFixed(2)}</p>
            </div>
          )}
          <div className="border-t border-hairline pt-3 flex justify-between items-center">
            <p className="text-[13px] font-bold text-body">Due today</p>
            <p className="font-display text-[22px] font-bold text-ink">{chargeLabel}</p>
          </div>
        </div>
      </div>

      <PaymentElement />

      {error && <div className="p-3 bg-tint border-[1.5px] border-ink rounded-[9px] text-[13px] font-semibold text-ink">{error}</div>}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-ink text-white border-[1.5px] border-ink rounded-[10px] px-[22px] py-3 text-[15px] font-semibold shadow-soft-3 hover:bg-smoke-2 transition-all duration-120 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : 'Start Subscription'}
      </button>

      <div className="flex items-center justify-center gap-1.5">
        <svg className="w-3 h-3 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted">Secured by Stripe · Cancel anytime</p>
      </div>
    </form>
  )
}

// ─── Payment step (loads Stripe intent) ──────────────────────────────────────
function PaymentStep({ sellerId, planType, billingCycle, onSuccess, onBack }) {
  const [clientSecret, setClientSecret] = useState(null)
  const [intentType, setIntentType] = useState('subscription')
  const [subscriptionId, setSubscriptionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoValidating, setPromoValidating] = useState(false)
  const [promoError, setPromoError] = useState(null)
  const [appliedPromo, setAppliedPromo] = useState(null)

  const validatePromo = async () => {
    if (!promoCode.trim()) return
    setPromoValidating(true)
    setPromoError(null)
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(promoCode.trim())}`)
      const data = await res.json()
      if (data.valid) {
        setAppliedPromo(data)
        setPromoCode('')
      } else {
        setPromoError(data.error || 'Invalid promo code')
      }
    } catch {
      setPromoError('Failed to validate code')
    }
    setPromoValidating(false)
  }

  const createIntent = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seller/plan/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seller_id: sellerId,
          plan_type: planType,
          billing_cycle: billingCycle,
          no_trial: true,
          promo_code_id: appliedPromo?.promo_code_id || null,
        }),
      })
      const d = await res.json()
      if (d.clientSecret) {
        setClientSecret(d.clientSecret)
        setIntentType(d.type || 'subscription')
        if (d.subscription_id) setSubscriptionId(d.subscription_id)
      } else {
        setError(d.error || 'Failed to initialize payment')
      }
    } catch {
      setError('Failed to initialize payment')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-semibold text-smoke-4 underline hover:text-body transition-colors duration-120">
        <ArrowLeft className="w-4 h-4" /> Back to plans
      </button>

      {!clientSecret ? (
        <div className="space-y-4">
          {/* Promo code input */}
          <div className="rounded-[10px] border-[1.5px] border-line overflow-hidden">
            <div className="bg-tint-2 px-4 py-2.5 border-b-[1.5px] border-line">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Promo Code</p>
            </div>
            <div className="bg-white px-4 py-4">
              {appliedPromo ? (
                <div className="flex items-center justify-between p-3 rounded-[9px] bg-tint border-[1.5px] border-ink">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{appliedPromo.name}</p>
                    <p className="font-mono text-[10.5px] text-ink mt-0.5">
                      {appliedPromo.discount.type === 'percent' ? `${appliedPromo.discount.value}% off` : `$${appliedPromo.discount.value} off`}
                      {appliedPromo.duration === 'once' ? ' · first payment' : appliedPromo.duration === 'repeating' ? ` · ${appliedPromo.duration_in_months} months` : ' · forever'}
                    </p>
                  </div>
                  <button onClick={() => setAppliedPromo(null)} className="text-[12px] text-ink font-semibold underline hover:text-muted">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(null) }}
                    onKeyDown={e => e.key === 'Enter' && validatePromo()}
                    placeholder="Enter promo code"
                    className="flex-1 border-[1.5px] border-line rounded-[9px] px-3 py-2.5 font-mono text-[13px] text-body bg-white outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-120"
                  />
                  <button
                    type="button"
                    onClick={validatePromo}
                    disabled={promoValidating || !promoCode.trim()}
                    className="px-4 rounded-[9px] text-[13px] font-semibold border-[1.5px] border-ink text-ink bg-white hover:bg-tint disabled:opacity-50 transition-colors duration-120 flex items-center gap-1.5"
                  >
                    {promoValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Apply
                  </button>
                </div>
              )}
              {promoError && <p className="text-[12px] font-semibold text-ink mt-2">{promoError}</p>}
            </div>
          </div>

          {error && <div className="p-3 bg-tint border-[1.5px] border-ink rounded-[9px] text-[13px] font-semibold text-ink">{error}</div>}

          <button
            type="button"
            onClick={createIntent}
            disabled={loading}
            className="w-full bg-ink text-white border-[1.5px] border-ink rounded-[10px] px-[22px] py-3 text-[15px] font-semibold shadow-soft-3 hover:bg-smoke-2 transition-all duration-120 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</> : 'Continue to Payment'}
          </button>
        </div>
      ) : stripePromise ? (
        <Elements stripe={stripePromise} options={{ clientSecret, terms: { card: 'never' } }}>
          <CheckoutForm
            planType={planType}
            billingCycle={billingCycle}
            intentType={intentType}
            discount={appliedPromo?.discount ? { ...appliedPromo.discount, name: appliedPromo.name } : null}
            onSuccess={(pmId, finalAmount) => onSuccess(subscriptionId, pmId, finalAmount)}
          />
        </Elements>
      ) : (
        <div className="p-4 bg-tint border-[1.5px] border-ink rounded-[9px] text-[13px] font-semibold text-ink text-center">
          Stripe is not configured. Add <code className="font-mono">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to env.
        </div>
      )}
    </div>
  )
}

// ─── Input field wrapper ──────────────────────────────────────────────────────
function InputField({ icon: Icon, label, required, hint, children, textarea }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.textPrimary, marginBottom: '6px' }}>
        {label}{required && <span style={{ color: T.textSecondary, marginLeft: '3px' }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <Icon style={{ position: 'absolute', left: '12px', top: textarea ? '14px' : '50%', transform: textarea ? 'none' : 'translateY(-50%)', width: '16px', height: '16px', color: T.textMuted, pointerEvents: 'none' }} />
        {children}
      </div>
      {hint && <p style={{ marginTop: '4px', fontSize: '11px', color: T.textSecondary }}>{hint}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
function MagicLinkRegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  // Token validation state
  const [loading, setLoading] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenData, setTokenData] = useState(null)
  const [tokenError, setTokenError] = useState('')

  // Multi-step state: 0=form, 1=plan, 2=payment, 3=success
  const [step, setStep] = useState(0)
  const [sellerId, setSellerId] = useState(null)
  const [sellerEmail, setSellerEmail] = useState(null)
  const [planType, setPlanType] = useState('pro')
  const [billingCycle, setBillingCycle] = useState('monthly')

  // Form state — restore from sessionStorage on mount to survive browser back
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formData, setFormData] = useState(() => {
    if (typeof window === 'undefined') return { contact_person_name: '', email: '', password: '', confirm_password: '', business_name: '', description: '' }
    try {
      const saved = sessionStorage.getItem('register_form_data')
      return saved ? JSON.parse(saved) : { contact_person_name: '', email: '', password: '', confirm_password: '', business_name: '', description: '' }
    } catch { return { contact_person_name: '', email: '', password: '', confirm_password: '', business_name: '', description: '' } }
  })

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) { setTokenError('No registration token provided'); setLoading(false); return }
      try {
        const { data: tokenRecord, error } = await supabase
          .from('magic_link_tokens').select('*').eq('token', token).single()
        if (error || !tokenRecord) { setTokenError('Invalid or expired registration link'); setLoading(false); return }
        if (tokenRecord.used) { setTokenError('This registration link has already been used'); setLoading(false); return }
        if (new Date() > new Date(tokenRecord.expires_at)) { setTokenError('This registration link has expired'); setLoading(false); return }
        setTokenValid(true)
        setTokenData({
          temp_seller_id: tokenRecord.temp_seller_id,
          property_id: tokenRecord.property_id,
          phone_number: tokenRecord.phone_number,
          property_address: tokenRecord.property_address,
          views_count: tokenRecord.views_count,
        })
      } catch { setTokenError('Failed to validate registration link') }
      finally { setLoading(false) }
    }
    validateToken()
  }, [token])

  const handleChange = (field) => (e) => {
    setFormData(prev => {
      const next = { ...prev, [field]: e.target.value }
      try { sessionStorage.setItem('register_form_data', JSON.stringify(next)) } catch {}
      return next
    })
    if (formError) setFormError('')
  }
  const handleFocus = (e) => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = '3px 3px 0 #111111' }
  const handleBlur = (e) => { e.target.style.borderColor = T.borderLight; e.target.style.boxShadow = 'none' }

  // Step 0: Create account → move to plan selection
  const handleFormSubmit = async (e) => {
    e.preventDefault()
    if (formData.password !== formData.confirm_password) { setFormError('Passwords do not match'); return }
    if (formData.password.length < 6) { setFormError('Password must be at least 6 characters'); return }
    setSubmitting(true)
    setFormError('')
    try {
      const res = await fetch('/api/register', {
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
          description: formData.description,
        })
      })
      const data = await res.json()
      if (data.success) {
        pushEvent('seller_signup_complete', { signup_flow: 'magic_link' })
        setSellerId(data.user.id)
        setSellerEmail(data.user.email)
        setStep(1)
      } else {
        setFormError(data.error || 'Registration failed. Please try again.')
      }
    } catch { setFormError('An error occurred. Please try again.') }
    finally { setSubmitting(false) }
  }

  // Step 2→3: Activate plan + mark token used
  const handlePaymentSuccess = async (subscriptionId, pmId, finalAmount) => {
    try {
      const activateRes = await fetch('/api/seller/plan/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: sellerId, subscription_id: subscriptionId, pm_id: pmId }),
      })
      if (activateRes.ok) {
        // This flow always charges (no trial) — push once per subscription.
        const key = 'dl_purchase_' + subscriptionId
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          pushEvent('seller_purchase', {
            transaction_id: subscriptionId,
            value: finalAmount,
            currency: 'USD',
            plan_name: planType === 'pro' ? 'Pro Seller' : 'Enterprise',
            signup_flow: 'magic_link',
          })
        }
      }
      // Mark token as used now that payment is complete
      await supabase
        .from('magic_link_tokens')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('token', token)
      // Save user to localStorage and clear form cache
      if (typeof window !== 'undefined') {
        localStorage.setItem('seller_user', JSON.stringify({ id: sellerId, email: sellerEmail, plan: planType }))
        sessionStorage.removeItem('register_form_data')
      }
    } catch {
      // best-effort — webhook will also fire activate
    }
    setStep(3)
  }

  // ── Loading ──
  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bgWhite, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 style={{ width: '40px', height: '40px', color: T.primary, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: '14px', color: T.textSecondary }}>Validating your registration link...</p>
      </div>
    </div>
  )

  // ── Invalid token ──
  if (!tokenValid) return (
    <div className="bg-stripes-backdrop" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ ...CARD_STYLE, padding: '40px 32px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{ width: '52px', height: '52px', background: T.primarySurface, border: '1.5px solid #111111', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <AlertCircle style={{ width: '24px', height: '24px', color: T.primary }} />
        </div>
        <h2 style={{ fontFamily: DISPLAY, fontSize: '20px', fontWeight: 700, letterSpacing: '-0.025em', color: T.textPrimary, marginBottom: '8px' }}>Link Invalid</h2>
        <p style={{ fontSize: '14px', fontWeight: 600, color: T.primary, marginBottom: '24px', lineHeight: '1.5' }}>{tokenError || 'This registration link is invalid or has expired.'}</p>
        <button onClick={() => router.push('/login')} style={{ width: '100%', height: '46px', background: T.primary, color: '#fff', border: '1.5px solid #111111', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', boxShadow: '3px 3px 0 rgba(17,17,17,.3)' }}>Go to Login</button>
      </div>
    </div>
  )

  const maxWidth = step === 1 ? '840px' : '680px'

  return (
    <div className="bg-stripes-backdrop" style={{ minHeight: '100vh', paddingTop: '48px', paddingBottom: '40px' }}>
      <div style={{ maxWidth, margin: '0 auto', padding: '0 16px', transition: 'max-width 0.12s ease' }}>

        {/* Logo + heading */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <Logo size="header" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Seller Portal</span>
          </div>
          {step < 3 && (
            <>
              <h1 style={{ fontFamily: DISPLAY, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.025em', color: T.textPrimary, marginBottom: '6px' }}>
                {step === 0 ? 'Complete Your Registration' : step === 1 ? 'Choose Your Plan' : 'Payment Details'}
              </h1>
              <p style={{ fontSize: '14px', color: T.textBody }}>
                {step === 0
                  ? 'Create your DeelMap seller account to manage your listings'
                  : step === 1
                  ? 'Select a plan to start managing your listings'
                  : 'Your subscription starts immediately after payment'}
              </p>
            </>
          )}
        </div>

        {/* Step dots */}
        {step < 3 && <StepDots current={step} />}

        {/* Property banner (step 0 only) */}
        {step === 0 && (
          <div style={{ background: '#f7f7f7', border: '1.5px solid #111111', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '3px 3px 0 #111111' }}>
            <div style={{ width: '36px', height: '36px', background: '#111111', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin style={{ width: '16px', height: '16px', color: '#ffffff' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.textSecondary, marginBottom: '2px' }}>Your Property</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tokenData?.property_address}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, background: T.primarySurface, border: '1.5px solid #111111', borderRadius: '999px', padding: '4px 10px' }}>
              <TrendingUp style={{ width: '12px', height: '12px', color: T.primary }} />
              <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: T.primary }}>{tokenData?.views_count} views</span>
            </div>
          </div>
        )}

        {/* ── Step 0: Registration form ── */}
        {step === 0 && (
          <div style={{ ...CARD_STYLE, padding: '28px', position: 'relative', overflow: 'hidden' }}>
            {formError && (
              <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '9px', display: 'flex', alignItems: 'flex-start', gap: '10px', background: T.primarySurface, border: '1.5px solid #111111' }}>
                <AlertCircle style={{ width: '16px', height: '16px', color: T.primary, flexShrink: 0, marginTop: '1px' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: T.primary, lineHeight: '1.4' }}>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '18px' }}>
                <InputField icon={User} label="Your Name" required>
                  <input type="text" required value={formData.contact_person_name} onChange={handleChange('contact_person_name')} onFocus={handleFocus} onBlur={handleBlur} placeholder="John Smith" style={inputStyle} />
                </InputField>
                <InputField icon={Mail} label="Email Address" required>
                  <input type="email" required value={formData.email} onChange={handleChange('email')} onFocus={handleFocus} onBlur={handleBlur} placeholder="john@example.com" style={inputStyle} />
                </InputField>
                <InputField icon={Phone} label="Phone Number" hint="Associated with your property">
                  <input type="tel" readOnly value={tokenData?.phone_number} style={readonlyInputStyle} />
                </InputField>
                <InputField icon={Building} label="Business / Company Name">
                  <input type="text" value={formData.business_name} onChange={handleChange('business_name')} onFocus={handleFocus} onBlur={handleBlur} placeholder="ABC Real Estate" style={inputStyle} />
                </InputField>
                <InputField icon={Lock} label="Password" required hint="Minimum 6 characters">
                  <input type={showPassword ? 'text' : 'password'} required minLength={6} value={formData.password} onChange={handleChange('password')} onFocus={handleFocus} onBlur={handleBlur} placeholder="••••••••" style={{ ...inputStyle, paddingRight: '40px' }} />
                  <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 0, display: 'flex' }}>
                    {showPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                  </button>
                </InputField>
                <InputField icon={Lock} label="Confirm Password" required>
                  <input type={showConfirm ? 'text' : 'password'} required value={formData.confirm_password} onChange={handleChange('confirm_password')} onFocus={handleFocus} onBlur={handleBlur} placeholder="••••••••" style={{ ...inputStyle, paddingRight: '40px' }} />
                  <button type="button" onClick={() => setShowConfirm(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 0, display: 'flex' }}>
                    {showConfirm ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                  </button>
                </InputField>
              </div>
              <div style={{ marginTop: '18px' }}>
                <InputField icon={FileText} label="About Your Business (Optional)" textarea>
                  <textarea value={formData.description} onChange={handleChange('description')} rows={3} placeholder="Tell us about your real estate business..." onFocus={handleFocus} onBlur={handleBlur} style={{ ...inputStyle, height: 'auto', paddingTop: '12px', paddingBottom: '12px', resize: 'vertical', minHeight: '88px' }} />
                </InputField>
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{ marginTop: '22px', width: '100%', height: '48px', background: submitting ? T.borderLight : T.primary, color: submitting ? T.textSecondary : '#FFFFFF', border: '1.5px solid #111111', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.12s ease', boxShadow: '3px 3px 0 rgba(17,17,17,.3)' }}
                onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = T.primaryHover }}
                onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = T.primary }}
              >
                {submitting
                  ? <><Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /><span>Creating Account...</span></>
                  : <span>Continue to Plan Selection →</span>}
              </button>
              <p style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: T.textSecondary }}>
                Already have an account?{' '}
                <button type="button" onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.primary, fontWeight: 600, fontSize: '13px', padding: 0, textDecoration: 'underline' }}>Sign in here</button>
              </p>
            </form>
          </div>
        )}

        {/* ── Step 1: Plan selection ── */}
        {step === 1 && (
          <div className="space-y-5">
            <button type="button" onClick={() => setStep(0)} className="flex items-center gap-1.5 text-[13px] font-semibold text-smoke-4 underline hover:text-body transition-colors duration-120">
              <ArrowLeft className="w-4 h-4" /> Back to account
            </button>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <span className={`text-sm transition-colors duration-120 ${billingCycle === 'monthly' ? 'text-body font-semibold' : 'text-smoke-4'}`}>Monthly</span>
                <button
                  onClick={() => setBillingCycle(v => v === 'monthly' ? 'annual' : 'monthly')}
                  className="relative w-10 h-[22px] rounded-pill flex-shrink-0 bg-ink border-[1.5px] border-ink transition-colors duration-120"
                >
                  <span className={`absolute top-[2px] left-[2px] w-[15px] h-[15px] rounded-pill bg-white transition-transform duration-120 ${billingCycle === 'annual' ? 'translate-x-[18px]' : ''}`} />
                </button>
                <span className={`text-sm transition-colors duration-120 ${billingCycle === 'annual' ? 'text-body font-semibold' : 'text-smoke-4'}`}>Annual</span>
              </div>
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] bg-tint text-ink border-[1.5px] border-ink px-2.5 py-0.5 rounded-pill">Save 20% on annual subscription</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <PlanCard id="pro" selected={planType} annual={billingCycle === 'annual'} onSelect={setPlanType} />
              <PlanCard id="enterprise" selected={planType} annual={billingCycle === 'annual'} onSelect={setPlanType} />
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full bg-ink text-white border-[1.5px] border-ink rounded-[10px] px-[22px] py-3 text-[15px] font-semibold shadow-soft-3 hover:bg-smoke-2 transition-all duration-120 flex items-center justify-center gap-2"
            >
              Continue to payment <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Step 2: Payment ── */}
        {step === 2 && (
          <div style={{ ...CARD_STYLE, padding: '28px' }}>
            <PaymentStep
              sellerId={sellerId}
              planType={planType}
              billingCycle={billingCycle}
              onSuccess={handlePaymentSuccess}
              onBack={() => setStep(1)}
            />
          </div>
        )}

        {/* ── Step 3: Success ── */}
        {step === 3 && (
          <div style={{ ...CARD_STYLE, padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', background: '#111111', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Check style={{ width: '32px', height: '32px', color: '#ffffff' }} />
            </div>
            <h2 style={{ fontFamily: DISPLAY, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.025em', color: T.textPrimary, marginBottom: '8px' }}>You're all set!</h2>
            <p style={{ fontSize: '15px', color: T.textBody, marginBottom: '8px' }}>Your account is active and your plan is live.</p>
            <p style={{ fontSize: '13px', color: T.textSecondary, marginBottom: '32px' }}>Your existing listings are already published and linked to your account.</p>
            <button
              onClick={() => router.push('/dashboard')}
              style={{ height: '48px', padding: '0 32px', background: T.primary, color: '#fff', border: '1.5px solid #111111', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '3px 3px 0 rgba(17,17,17,.3)' }}
              onMouseEnter={e => e.currentTarget.style.background = T.primaryHover}
              onMouseLeave={e => e.currentTarget.style.background = T.primary}
            >
              Go to Dashboard →
            </button>
          </div>
        )}

        <p style={{ textAlign: 'center', fontFamily: MONO, fontSize: '10.5px', fontWeight: 500, letterSpacing: '0.05em', color: T.textSecondary, marginTop: '20px' }}>
          © {new Date().getFullYear()} DEELMAP. ALL RIGHTS RESERVED.
        </p>
      </div>
    </div>
  )
}

export default function MagicLinkRegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ width: '40px', height: '40px', color: '#111111', animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <MagicLinkRegisterContent />
    </Suspense>
  )
}
