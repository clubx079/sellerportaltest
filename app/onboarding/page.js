'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Check, Eye, EyeOff, ChevronRight, Loader2 } from 'lucide-react'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

// ─── Design tokens ────────────────────────────────────────────────────────────
const inputCls = 'w-full h-[46px] px-4 border border-[#E8E8E4] rounded text-[14px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816] transition-colors bg-white'
const labelCls = 'block text-[13px] font-semibold text-[#1A1816] mb-1.5'
const errorCls = 'text-[13px] text-[#D03839] mt-1'

// ─── Step indicator ───────────────────────────────────────────────────────────
const STEPS = ['Account', 'Verify Phone', 'Choose Plan', 'Payment']

function StepDots({ current }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all
                ${done ? 'bg-[#1A1816] text-white' : active ? 'bg-[#D03839] text-white' : 'bg-[#F3F3F0] text-[#A8A8A4]'}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`mt-1 text-[10px] font-semibold whitespace-nowrap hidden sm:block
                ${active ? 'text-[#1A1816]' : done ? 'text-[#737370]' : 'text-[#A8A8A4]'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 mb-4 transition-colors ${done ? 'bg-[#1A1816]' : 'bg-[#E8E8E4]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 0: Create Account ───────────────────────────────────────────────────
function StepAccount({ onNext }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register-seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return }
      sessionStorage.setItem('onboarding', JSON.stringify({ seller_id: data.seller_id, email: form.email }))
      onNext()
    } catch { setError('Something went wrong. Please try again.') }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>First name</label>
          <input className={inputCls} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="John" required />
        </div>
        <div>
          <label className={labelCls}>Last name</label>
          <input className={inputCls} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Smith" required />
        </div>
      </div>
      <div>
        <label className={labelCls}>Email</label>
        <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" required />
      </div>
      <div>
        <label className={labelCls}>Password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            className={`${inputCls} pr-11`}
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder="Min. 8 characters"
            minLength={8}
            required
          />
          <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A8A4] hover:text-[#737370]">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {error && <p className={errorCls}>{error}</p>}
      <button type="submit" disabled={loading} className="w-full h-[46px] bg-[#D03839] hover:bg-[#E0493B] text-white text-[14px] font-semibold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ChevronRight className="w-4 h-4" /></>}
      </button>
      <p className="text-center text-[13px] text-[#737370]">
        Already have an account?{' '}
        <a href="/login" className="text-[#D03839] font-medium hover:underline">Log in</a>
      </p>
    </form>
  )
}

// ─── Step 1: Phone Verification ───────────────────────────────────────────────
function StepPhone({ onNext }) {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const session = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('onboarding') || '{}') : {}

  const formatPhone = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 10)
    if (d.length <= 3) return d
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }

  const sendOtp = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email: session.email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to send code'); setLoading(false); return }
      setSent(true)
    } catch { setError('Failed to send code') }
    setLoading(false)
  }

  const verifyOtp = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email, otp, seller_id: session.seller_id, phone }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid code'); setLoading(false); return }
      // Store phone in session
      const updated = { ...session, phone }
      sessionStorage.setItem('onboarding', JSON.stringify(updated))
      onNext()
    } catch { setError('Something went wrong') }
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      {!sent ? (
        <>
          <div>
            <label className={labelCls}>Phone number</label>
            <input
              className={inputCls}
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              placeholder="(555) 000-0000"
              type="tel"
            />
            <p className="text-[12px] text-[#A8A8A4] mt-1.5">US number only. We'll send a 6-digit verification code.</p>
          </div>
          {error && <p className={errorCls}>{error}</p>}
          <button onClick={sendOtp} disabled={loading || phone.replace(/\D/g, '').length < 10}
            className="w-full h-[46px] bg-[#D03839] hover:bg-[#E0493B] text-white text-[14px] font-semibold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send verification code'}
          </button>
        </>
      ) : (
        <>
          <div>
            <label className={labelCls}>Verification code</label>
            <p className="text-[13px] text-[#737370] mb-3">Enter the 6-digit code sent to {phone}</p>
            <input
              className={`${inputCls} text-center text-[20px] font-bold tracking-[0.3em]`}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
            />
          </div>
          {error && <p className={errorCls}>{error}</p>}
          <button onClick={verifyOtp} disabled={loading || otp.length < 6}
            className="w-full h-[46px] bg-[#D03839] hover:bg-[#E0493B] text-white text-[14px] font-semibold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify <ChevronRight className="w-4 h-4" /></>}
          </button>
          <button onClick={() => { setSent(false); setOtp('') }} className="w-full text-center text-[13px] text-[#737370] hover:text-[#1A1816]">
            Change number
          </button>
        </>
      )}
    </div>
  )
}

// ─── Step 2: Plan Selection ───────────────────────────────────────────────────
const PRO_FEATURES = [
  [true,  'Verified seller badge'],
  [true,  'Advanced seller dashboard'],
  [true,  'Advanced analytics'],
  [true,  'Priority search placement'],
  [true,  'Priority support'],
  [true,  '10 listings / month'],
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

function OnboardingPlanCard({ id, selected, annual, onSelect }) {
  const isPro = id === 'pro'
  const isSelected = selected === id
  const price = isPro ? (annual ? '79' : '99') : (annual ? '239' : '299')
  const billingNote = annual
    ? (isPro ? 'Billed annually · $948/yr · 10 listings included' : 'Billed annually · $2,868/yr · unlimited listings')
    : (isPro ? 'Billed monthly · 10 listings included' : 'Billed monthly · unlimited listings')
  const savingsNote = annual
    ? (isPro ? 'Save $240 vs monthly' : 'Save $720 vs monthly')
    : (isPro ? '$19 per additional listing' : '\u00a0')
  const features = isPro ? PRO_FEATURES : ENT_FEATURES

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`w-full text-left rounded p-5 flex flex-col border-2 transition-all ${
        isSelected
          ? (isPro ? 'border-[#D03839]' : 'border-[#1A1816]')
          : 'border-[#E8E8E4] hover:border-[#D4D4CF]'
      } bg-white`}
    >
      {/* Badge row */}
      <div className="min-h-[22px] mb-3">
        {isPro && !isSelected && (
          <span className="inline-block text-[11px] font-semibold bg-[#FEF0EF] text-[#D03839] px-2.5 py-0.5 rounded">
            Most popular
          </span>
        )}
        {isSelected && (
          <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded ${isPro ? 'bg-[#FEF0EF] text-[#D03839]' : 'bg-[#1A1816] text-white'}`}>
            Selected
          </span>
        )}
      </div>

      <p className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[#A8A8A4] mb-1">Subscription</p>
      <h2 className="text-2xl font-bold text-[#1A1816] tracking-tight mb-1">{isPro ? 'Pro Seller' : 'Enterprise'}</h2>
      <p className="text-xs text-[#737370] leading-relaxed mb-4">
        {isPro ? 'For active investors and wholesalers moving deals consistently.' : 'For acquisition teams running high-volume pipelines.'}
      </p>

      <div className="flex items-end gap-1.5 leading-none mb-1">
        <span className="text-[38px] font-bold text-[#1A1816] tracking-tight leading-none">
          <sup className="text-lg font-normal align-super">$</sup>{price}
        </span>
        <span className="text-sm font-normal text-[#737370] mb-1">/ per month</span>
      </div>
      <p className="text-xs text-[#737370] mb-1">{billingNote}</p>
      <p className="text-[11px] text-[#A8A8A4] mb-4">{savingsNote}</p>

      <div className={`w-full py-2 text-center text-xs font-semibold tracking-[0.05em] uppercase rounded mb-4 transition-colors ${
        isSelected
          ? (isPro ? 'bg-[#D03839] text-white' : 'bg-[#1A1816] text-white')
          : 'border border-[#D4D4CF] text-[#1A1816]'
      }`}>
        {isSelected ? 'Selected' : 'Select plan'}
      </div>

      <hr className="border-t border-[#E8E8E4] mb-4" />
      <p className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[#A8A8A4] mb-3">Includes</p>
      <ul className="flex flex-col gap-1.5">
        {features.map(([on, label], i) => (
          <li key={i} className={`flex items-start gap-2 text-xs leading-snug ${on ? 'text-[#1A1816]' : 'text-[#A8A8A4]'}`}>
            <span className={`flex-shrink-0 mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center border ${on ? 'bg-[#1A1816] border-[#1A1816]' : 'border-[#E8E8E4]'}`}>
              {on && (
                <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                  <path d="M1 2.5L2.8 4.2L6 1" stroke="#FAFAF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            {label}
          </li>
        ))}
      </ul>
    </button>
  )
}

function StepPlan({ onNext }) {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const localPlan = typeof window !== 'undefined' ? (localStorage.getItem('deelmap_selected_plan') || '') : ''
  const defaultPlan = searchParams?.get('plan') || (localPlan !== 'pay-per-listing' ? localPlan : '') || 'pro'
  const defaultBilling = searchParams?.get('billing') || 'monthly'

  const [selected, setSelected] = useState(defaultPlan === 'standard' ? 'pro' : defaultPlan)
  const [annual, setAnnual] = useState(defaultBilling === 'annual')

  const handleNext = () => {
    const session = JSON.parse(sessionStorage.getItem('onboarding') || '{}')
    sessionStorage.setItem('onboarding', JSON.stringify({
      ...session,
      plan_type: selected,
      billing_cycle: annual ? 'annual' : 'monthly',
    }))
    onNext()
  }

  return (
    <div className="space-y-5">
      {/* Billing toggle */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <span className={`text-sm transition-colors ${!annual ? 'text-[#1A1816] font-medium' : 'text-[#737370]'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(v => !v)}
            className={`relative w-10 h-[22px] rounded-full flex-shrink-0 transition-colors ${annual ? 'bg-[#D03839]' : 'bg-[#1A1816]'}`}
          >
            <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform ${annual ? 'translate-x-[18px]' : ''}`} />
          </button>
          <span className={`text-sm transition-colors ${annual ? 'text-[#1A1816] font-medium' : 'text-[#737370]'}`}>Annual</span>
        </div>
        <span className="text-[11px] font-semibold bg-[#E4F5EC] text-[#0F6E56] px-2.5 py-0.5 rounded-full">
          Save 20% on annual subscription
        </span>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <OnboardingPlanCard id="pro"        selected={selected} annual={annual} onSelect={setSelected} />
        <OnboardingPlanCard id="enterprise" selected={selected} annual={annual} onSelect={setSelected} />
      </div>

      <button
        onClick={handleNext}
        className="w-full h-[46px] bg-[#D03839] hover:bg-[#E0493B] text-white text-[14px] font-semibold rounded transition-colors flex items-center justify-center gap-2"
      >
        Continue to payment <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Step 3: Payment ──────────────────────────────────────────────────────────
function CheckoutForm({ session, intentType, onSuccess }) {
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
    const result = await confirmFn.call(stripe, {
      elements,
      redirect: 'if_required',
    })

    if (result.error) {
      setError(result.error.message)
    } else {
      const intent = result.setupIntent || result.paymentIntent
      const pmId = typeof intent?.payment_method === 'string' ? intent.payment_method : intent?.payment_method?.id
      onSuccess(pmId || null)
    }
    setProcessing(false)
  }

  const plan    = session.plan_type
  const billing = session.billing_cycle
  const isAnnual = billing === 'annual'
  const isPro    = plan === 'pro'

  // Full charge amounts
  const monthlyPrice = isPro ? 99  : 299
  const annualTotal  = isPro ? 948 : 2868
  const dueToday     = 0  // both Pro and Enterprise have 7-day free trial
  const planName     = isPro ? 'Pro Seller' : 'Enterprise'

  // What to show as the charge line
  const chargeLabel  = isAnnual
    ? `$${annualTotal.toLocaleString()} / year`
    : `$${monthlyPrice} / month`

  // Button label — both plans start with 7-day free trial
  const btnLabel = 'Start 7-Day Free Trial'

  return (
    <form onSubmit={handlePay} className="space-y-5">
      {/* Order Summary */}
      <div className="bg-[#FAFAF8] border border-[#E8E8E4] rounded p-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A8A4]">Order Summary</p>

        <div className="flex justify-between items-start">
          <div>
            <p className="text-[14px] font-semibold text-[#1A1816]">{planName}</p>
            <p className="text-[12px] text-[#737370]">{isAnnual ? 'Billed annually' : 'Billed monthly'}</p>
          </div>
          <p className="text-[14px] font-bold text-[#1A1816]">{chargeLabel}</p>
        </div>

        <div className="border-t border-[#E8E8E4] pt-3 flex justify-between items-center">
          <p className="text-[13px] font-semibold text-[#1A1816]">Due today</p>
          <p className="text-[15px] font-bold text-[#1A1816]">$0</p>
        </div>

        <p className="text-[12px] text-[#0F6E56]">
          7-day free trial · then {chargeLabel}{isAnnual ? ' — billed as one payment' : ''}
        </p>
      </div>

      <PaymentElement />

      {error && (
        <div className="p-3 bg-[#FEF0EF] border border-[#F5C0BF] rounded text-[13px] text-[#D03839]">{error}</div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full h-[46px] bg-[#D03839] hover:bg-[#E0493B] text-white text-[14px] font-semibold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : btnLabel}
      </button>
      <p className="text-center text-[12px] text-[#A8A8A4]">Secured by Stripe · Cancel anytime in settings</p>
    </form>
  )
}

function StepPayment({ onSuccess }) {
  const [clientSecret, setClientSecret] = useState(null)
  const [intentType, setIntentType] = useState('subscription')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [session, setSession] = useState({})

  useEffect(() => {
    const s = JSON.parse(sessionStorage.getItem('onboarding') || '{}')
    setSession(s)

    fetch('/api/seller/plan/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seller_id: s.seller_id,
        plan_type: s.plan_type,
        billing_cycle: s.billing_cycle,
        quantity: s.quantity || 1,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.clientSecret) {
          setClientSecret(d.clientSecret)
          setIntentType(d.type || 'subscription')
          // Store subscription_id so StepSuccess can activate the plan
          if (d.subscription_id) {
            const s2 = JSON.parse(sessionStorage.getItem('onboarding') || '{}')
            sessionStorage.setItem('onboarding', JSON.stringify({ ...s2, subscription_id: d.subscription_id }))
          }
        } else {
          setError(d.error || 'Failed to initialize payment')
        }
      })
      .catch(() => setError('Failed to initialize payment'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-7 h-7 animate-spin text-[#D03839]" />
    </div>
  )

  if (error) return (
    <div className="p-4 bg-[#FEF0EF] border border-[#F5C0BF] rounded text-[13px] text-[#D03839] text-center">{error}</div>
  )

  return stripePromise && clientSecret ? (
    <Elements stripe={stripePromise} options={{ clientSecret, terms: { card: 'never' } }}>
      <CheckoutForm session={session} intentType={intentType} onSuccess={(pmId) => {
        if (pmId) {
          const s2 = JSON.parse(sessionStorage.getItem('onboarding') || '{}')
          sessionStorage.setItem('onboarding', JSON.stringify({ ...s2, pm_id: pmId }))
        }
        onSuccess()
      }} />
    </Elements>
  ) : (
    <div className="p-4 bg-[#FEF3E2] border border-[#F5D9A0] rounded text-[13px] text-[#B5620A] text-center">
      Stripe is not configured. Add <code className="font-mono">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to env.
    </div>
  )
}

// ─── Step 4: Success ──────────────────────────────────────────────────────────
function StepSuccess() {
  const router = useRouter()

  useEffect(() => {
    // Activate the plan immediately — don't wait for the webhook
    const session = JSON.parse(sessionStorage.getItem('onboarding') || '{}')
    if (session.seller_id && session.subscription_id) {
      fetch('/api/seller/plan/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seller_id: session.seller_id,
          subscription_id: session.subscription_id,
          pm_id: session.pm_id || null,
        }),
      }).catch(() => {}) // best-effort; webhook will also fire
    }
  }, [])

  const handleContinue = () => {
    const session = JSON.parse(sessionStorage.getItem('onboarding') || '{}')
    if (session.seller_id) {
      localStorage.setItem('seller_user', JSON.stringify({
        id: session.seller_id,
        email: session.email,
        plan: session.plan_type,
      }))
    }
    sessionStorage.removeItem('onboarding')
    router.push('/dashboard')
  }

  return (
    <div className="flex flex-col items-center text-center py-4 space-y-4">
      <div className="w-16 h-16 bg-[#E4F5EC] rounded-full flex items-center justify-center">
        <Check className="w-8 h-8 text-[#0F6E56]" />
      </div>
      <div>
        <h2 className="text-[20px] font-bold text-[#1A1816] mb-1">You're all set!</h2>
        <p className="text-[14px] text-[#737370]">Your account is active. Start listing your deals on Deelmap.</p>
      </div>
      <button
        onClick={handleContinue}
        className="w-full h-[46px] bg-[#D03839] hover:bg-[#E0493B] text-white text-[14px] font-semibold rounded transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const STEP_TITLES = [
  { title: 'Create your account', sub: 'Start selling on Deelmap' },
  { title: 'Verify your phone', sub: "We'll send a quick code" },
  { title: 'Choose your plan', sub: 'Pick what fits your pipeline' },
  { title: 'Complete payment', sub: 'Secure checkout via Stripe' },
]

function OnboardingContent() {
  const [step, setStep] = useState(0)
  const router = useRouter()

  useEffect(() => {
    // If already logged in, go to dashboard
    if (typeof window !== 'undefined' && localStorage.getItem('seller_user')) {
      router.push('/dashboard')
    }
  }, [router])

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => s - 1)
  const { title, sub } = STEP_TITLES[step] || STEP_TITLES[0]

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-4 py-12" style={{ fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <div className={`w-full transition-all duration-300 ${step === 2 ? 'max-w-3xl' : 'max-w-xl'}`}>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <a href="/">
            <img src="/assets/logo.svg" alt="Deelmap" className="h-14 w-auto object-contain" onError={e => { e.target.style.display = 'none' }} />
          </a>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E8E8E4] rounded p-10 shadow-sm">

          {/* Heading */}
          {step < 4 && (
            <div className="mb-7">
              {step === 3 && (
                <button onClick={back} className="flex items-center gap-1.5 text-[13px] text-[#737370] hover:text-[#1A1816] transition-colors mb-4">
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  Back to plans
                </button>
              )}
              <h1 className="text-[24px] font-bold text-[#1A1816] tracking-tight">{title}</h1>
              <p className="text-[14px] text-[#737370] mt-1">{sub}</p>
            </div>
          )}

          {step === 0 && <StepAccount onNext={next} />}
          {step === 1 && <StepPhone onNext={next} />}
          {step === 2 && <StepPlan onNext={next} />}
          {step === 3 && <StepPayment onSuccess={next} />}
          {step === 4 && <StepSuccess />}
        </div>

        <p className="text-center text-[12px] text-[#A8A8A4] mt-6">
          By continuing you agree to Deelmap's{' '}
          <a href="/terms" className="hover:underline">Terms</a> &amp;{' '}
          <a href="/privacy" className="hover:underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  )
}
