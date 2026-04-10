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
const inputCls = 'w-full h-[46px] px-4 border border-[#E8E8E4] rounded-lg text-[14px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816] transition-colors bg-white'
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
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }
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
      <button type="submit" disabled={loading} className="w-full h-[46px] bg-[#D03839] hover:bg-[#C73022] text-white text-[14px] font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
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
        body: JSON.stringify({ email: session.email, otp }),
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
            className="w-full h-[46px] bg-[#D03839] hover:bg-[#C73022] text-white text-[14px] font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
            className="w-full h-[46px] bg-[#D03839] hover:bg-[#C73022] text-white text-[14px] font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
const PRESET_QTY = [1, 3, 5, 10]

function PlanCard({ plan, selected, annual, onSelect }) {
  const isStandard = plan.id === 'standard'
  const isPro = plan.id === 'pro'
  const price = isStandard ? 29 : isPro ? (annual ? 948 : 99) : (annual ? 2868 : 299)
  const period = isStandard ? 'per listing · stays live' : annual ? 'per year · billed annually' : 'per month'
  const sub = isStandard ? null : (annual ? `Save 20% · $${isPro ? 79 : 239}/mo` : isPro ? '$19 per additional listing' : null)

  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      className={`w-full text-left rounded-xl border-2 p-5 transition-all ${
        selected === plan.id ? 'border-[#D03839] bg-[#FEF0EF]' : 'border-[#E8E8E4] bg-white hover:border-[#1A1816]'
      }`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <p className="text-[15px] font-bold text-[#1A1816]">{plan.name}</p>
        {isPro && <span className="text-[10px] font-bold bg-[#D03839] text-white px-2 py-0.5 rounded">Popular</span>}
      </div>
      <p className="text-[12px] text-[#737370] mb-3">{plan.desc}</p>
      <div className="flex items-end gap-1">
        <span className="text-[26px] font-bold text-[#1A1816] leading-none">${price.toLocaleString()}</span>
        <span className="text-[12px] text-[#737370] mb-0.5">{period}</span>
      </div>
      {sub && <p className="text-[11px] text-[#737370] mt-0.5">{sub}</p>}
    </button>
  )
}

const PLANS = [
  { id: 'standard', name: 'Standard', desc: 'List a property. No subscription required.' },
  { id: 'pro',      name: 'Pro Seller', desc: '10 listings/month. Verified badge & advanced analytics.' },
  { id: 'enterprise', name: 'Enterprise', desc: 'Unlimited listings. For high-volume acquisition teams.' },
]

function StepPlan({ onNext }) {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const defaultPlan = searchParams?.get('plan') || 'standard'
  const defaultBilling = searchParams?.get('billing') || 'monthly'

  const [selected, setSelected] = useState(defaultPlan)
  const [annual, setAnnual] = useState(defaultBilling === 'annual')
  const [qty, setQty] = useState(1)
  const [customQty, setCustomQty] = useState(false)
  const [customVal, setCustomVal] = useState('')

  const effectiveQty = customQty ? (parseInt(customVal) || 1) : qty
  const total = selected === 'standard' ? 29 * effectiveQty : null

  const handleNext = () => {
    const session = JSON.parse(sessionStorage.getItem('onboarding') || '{}')
    sessionStorage.setItem('onboarding', JSON.stringify({
      ...session,
      plan_type: selected,
      billing_cycle: selected === 'standard' ? 'one_time' : annual ? 'annual' : 'monthly',
      quantity: effectiveQty,
    }))
    onNext()
  }

  return (
    <div className="space-y-4">
      {/* Annual toggle */}
      <div className="flex items-center justify-between bg-[#FAFAF8] border border-[#E8E8E4] rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`text-[13px] font-medium transition-colors ${!annual ? 'text-[#1A1816]' : 'text-[#A8A8A4]'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(v => !v)}
            className={`relative w-10 h-[22px] rounded-full flex-shrink-0 transition-colors ${annual ? 'bg-[#D03839]' : 'bg-[#1A1816]'}`}
          >
            <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform ${annual ? 'translate-x-[18px]' : ''}`} />
          </button>
          <span className={`text-[13px] font-medium transition-colors ${annual ? 'text-[#1A1816]' : 'text-[#A8A8A4]'}`}>Annual</span>
        </div>
        <span className="text-[11px] font-semibold bg-[#E4F5EC] text-[#0F6E56] px-2.5 py-0.5 rounded-full">Save 20%</span>
      </div>

      {/* Plan cards */}
      <div className="space-y-3">
        {PLANS.map(p => (
          <PlanCard key={p.id} plan={p} selected={selected} annual={annual} onSelect={setSelected} />
        ))}
      </div>

      {/* Quantity selector for Standard */}
      {selected === 'standard' && (
        <div className="bg-[#FAFAF8] border border-[#E8E8E4] rounded-xl p-4 space-y-3">
          <p className="text-[13px] font-semibold text-[#1A1816]">How many listings do you need?</p>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_QTY.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => { setQty(n); setCustomQty(false) }}
                className={`rounded-lg border py-2.5 text-center transition-all ${
                  !customQty && qty === n
                    ? 'border-[#D03839] bg-[#FEF0EF] text-[#D03839]'
                    : 'border-[#E8E8E4] bg-white text-[#1A1816] hover:border-[#1A1816]'
                }`}
              >
                <p className="text-[15px] font-bold">{n}</p>
                <p className="text-[11px] text-[#737370]">${(29 * n).toLocaleString()}</p>
              </button>
            ))}
          </div>
          {!customQty ? (
            <button onClick={() => setCustomQty(true)} className="text-[12px] text-[#737370] hover:text-[#1A1816] underline">
              Enter a custom amount
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 border border-[#E8E8E4] rounded-lg px-3 h-[40px]">
                <button onClick={() => setCustomVal(v => String(Math.max(1, (parseInt(v) || 1) - 1)))} className="text-[#737370] text-lg leading-none">−</button>
                <input
                  type="number"
                  min={1}
                  value={customVal}
                  onChange={e => setCustomVal(e.target.value)}
                  className="w-12 text-center text-[14px] font-semibold focus:outline-none bg-transparent"
                />
                <button onClick={() => setCustomVal(v => String((parseInt(v) || 1) + 1))} className="text-[#737370] text-lg leading-none">+</button>
              </div>
              <span className="text-[13px] text-[#737370]">listings · ${(29 * (parseInt(customVal) || 1)).toLocaleString()} total</span>
              <button onClick={() => setCustomQty(false)} className="text-[12px] text-[#737370] hover:text-[#1A1816] underline ml-auto">Presets</button>
            </div>
          )}
        </div>
      )}

      {/* Total */}
      {total !== null && (
        <div className="flex justify-between items-center px-4 py-3 bg-[#1A1816] rounded-lg">
          <span className="text-[13px] font-medium text-white">{effectiveQty} listing{effectiveQty !== 1 ? 's' : ''} · one-time</span>
          <span className="text-[16px] font-bold text-white">${total.toLocaleString()}</span>
        </div>
      )}

      <button
        onClick={handleNext}
        className="w-full h-[46px] bg-[#D03839] hover:bg-[#C73022] text-white text-[14px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        Continue to payment <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Step 3: Payment ──────────────────────────────────────────────────────────
function CheckoutForm({ session, onSuccess }) {
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

    const { error: confirmErr } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (confirmErr) {
      setError(confirmErr.message)
    } else {
      onSuccess()
    }
    setProcessing(false)
  }

  const plan = session.plan_type
  const qty = session.quantity || 1
  const billing = session.billing_cycle
  const amount = plan === 'standard' ? `$${(29 * qty).toLocaleString()} one-time`
    : plan === 'pro' ? (billing === 'annual' ? '$948/year' : '$99/month')
    : billing === 'annual' ? '$2,868/year' : '$299/month'

  return (
    <form onSubmit={handlePay} className="space-y-5">
      {/* Summary */}
      <div className="bg-[#FAFAF8] border border-[#E8E8E4] rounded-xl p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A8A4] mb-2">Order Summary</p>
        <div className="flex justify-between items-center">
          <span className="text-[14px] font-semibold text-[#1A1816] capitalize">
            {plan === 'standard' ? `Standard · ${qty} listing${qty !== 1 ? 's' : ''}` : `${plan} Seller · ${billing}`}
          </span>
          <span className="text-[14px] font-bold text-[#1A1816]">{amount}</span>
        </div>
        {plan === 'pro' && <p className="text-[12px] text-[#0F6E56] mt-1.5">7-day free trial included</p>}
      </div>

      <PaymentElement />

      {error && (
        <div className="p-3 bg-[#FEF0EF] border border-[#F5C0BF] rounded-lg text-[13px] text-[#D03839]">{error}</div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full h-[46px] bg-[#D03839] hover:bg-[#C73022] text-white text-[14px] font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {processing
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
          : plan === 'standard' ? `Pay $${(29 * qty).toLocaleString()} & Get Started`
          : plan === 'pro' ? 'Start Free Trial'
          : 'Subscribe'}
      </button>
      <p className="text-center text-[12px] text-[#A8A8A4]">Secured by Stripe · Cancel anytime in settings</p>
    </form>
  )
}

function StepPayment({ onSuccess }) {
  const [clientSecret, setClientSecret] = useState(null)
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
        if (d.clientSecret) setClientSecret(d.clientSecret)
        else setError(d.error || 'Failed to initialize payment')
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
    <div className="p-4 bg-[#FEF0EF] border border-[#F5C0BF] rounded-lg text-[13px] text-[#D03839] text-center">{error}</div>
  )

  return stripePromise && clientSecret ? (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm session={session} onSuccess={onSuccess} />
    </Elements>
  ) : (
    <div className="p-4 bg-[#FEF3E2] border border-[#F5D9A0] rounded-lg text-[13px] text-[#B5620A] text-center">
      Stripe is not configured. Add <code className="font-mono">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to env.
    </div>
  )
}

// ─── Step 4: Success ──────────────────────────────────────────────────────────
function StepSuccess() {
  const router = useRouter()

  const handleContinue = () => {
    const session = JSON.parse(sessionStorage.getItem('onboarding') || '{}')
    // Log in the seller
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
        className="w-full h-[46px] bg-[#D03839] hover:bg-[#C73022] text-white text-[14px] font-semibold rounded-lg transition-colors"
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
  const { title, sub } = STEP_TITLES[step] || STEP_TITLES[0]

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-4 py-12" style={{ fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <a href="/">
            <img src="/deelmap.png" alt="Deelmap" className="h-10 object-contain" onError={e => { e.target.style.display = 'none' }} />
          </a>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E8E8E4] rounded-2xl p-8 shadow-sm">

          {step < 4 && <StepDots current={step} />}

          {/* Heading */}
          {step < 4 && (
            <div className="mb-6">
              <h1 className="text-[22px] font-bold text-[#1A1816] tracking-tight">{title}</h1>
              <p className="text-[14px] text-[#737370] mt-0.5">{sub}</p>
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
