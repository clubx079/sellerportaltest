'use client'
import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
  Loader2, ArrowLeft, Check, Building2, Zap,
  CreditCard, AlertCircle, AlertTriangle, Calendar, Lock,
} from 'lucide-react'

// ─── Plan config ──────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  pro: {
    name:      'Pro Seller',
    Icon:      Zap,
    iconBg:    'bg-[#FEF0EF]',
    iconColor: 'text-[#D03839]',
    prices:    { monthly: 99, annual: 79, annualTotal: 948 },
    features: [
      'Verified seller badge',
      'Advanced seller dashboard',
      'Advanced analytics',
      'Priority search placement',
      'Priority support',
      '10 listings / month',
    ],
  },
  enterprise: {
    name:      'Enterprise',
    Icon:      Building2,
    iconBg:    'bg-[#1A1816]',
    iconColor: 'text-white',
    prices:    { monthly: 299, annual: 239, annualTotal: 2868 },
    features: [
      'Everything in Pro',
      'Unlimited listings',
      'Basic CRM features',
      'Lead management tools',
      'Team accounts',
      'Custom branding',
      'Dedicated account support',
      'API access (coming soon)',
    ],
  },
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ─── Inner page ───────────────────────────────────────────────────────────────
function UpgradeContent() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const router       = useRouter()

  const targetType = params.planType
  const cycle      = searchParams.get('cycle') || 'annual'
  const isAnnual   = cycle === 'annual'

  const [sellerId,      setSellerId]      = useState(null)
  const [plan,          setPlan]          = useState(null)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [confirming,    setConfirming]    = useState(false)
  const [error,         setError]         = useState(null)
  const [propBlock,     setPropBlock]     = useState(null)

  const targetCfg = PLAN_CONFIG[targetType]

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (!userStr) { window.location.href = '/login'; return }
    const user = JSON.parse(userStr)
    setSellerId(user.id)
    loadData(user.id)
  }, [])

  const loadData = async (sid) => {
    setLoading(true)
    try {
      const planRes  = await fetch('/api/seller/plan/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: sid }),
      })
      const planData = await planRes.json()
      const p = planData.plan || null
      setPlan(p)

      const customerId = p?.stripe_customer_id
      if (customerId) {
        const pmRes  = await fetch('/api/billing/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: customerId }),
        })
        const pmData = await pmRes.json()
        setPaymentMethod(pmData.default_payment_method || null)
      }
    } catch {
      setError('Failed to load your plan information.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!sellerId) return
    setConfirming(true)
    setError(null)
    setPropBlock(null)
    try {
      const res  = await fetch('/api/seller/plan/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: sellerId, new_plan_type: targetType, billing_cycle: cycle }),
      })
      const data = await res.json()

      if (res.status === 422 && data.requires_deactivation) {
        setPropBlock({ count: data.active_count })
        return
      }
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to change plan. Please try again.')
        return
      }

      const label = targetType === 'enterprise' ? 'Enterprise' : 'Pro Seller'
      const msg   = data.immediate
        ? `You're now on ${label}. Your trial continues — billing starts ${fmtDate(data.scheduled_for)}.`
        : data.scheduled_for
          ? `Switching to ${label} on ${fmtDate(data.scheduled_for)}.`
          : `Switched to ${label}.`

      sessionStorage.setItem('planChangeSuccess', msg)
      router.push('/plans')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  if (!targetCfg) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-[13px] text-[#737370]">Invalid plan type.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#737370]" />
      </div>
    )
  }

  const currentType   = plan?.plan_type
  const currentCfg    = PLAN_CONFIG[currentType]
  const isDowngrade   = targetType === 'pro' && currentType === 'enterprise'
  const isCycleSwitch = targetType === currentType
  const isTrialing    = plan?.status === 'trialing'

  const price         = isAnnual ? targetCfg.prices.annual : targetCfg.prices.monthly
  const annualTotal   = targetCfg.prices.annualTotal
  const effectiveDate = plan?.current_period_end

  const effectNote = isTrialing
    ? `Your trial continues unchanged. You'll be billed $${price}/mo starting ${fmtDate(effectiveDate)}.`
    : `Switch takes effect ${fmtDate(effectiveDate)}. No charge today — you'll be billed at the new rate on renewal.`

  const TargetIcon = targetCfg.Icon

  let pageTitle = `Upgrade to ${targetCfg.name}`
  if (isDowngrade)   pageTitle = 'Downgrade to Pro Seller'
  if (isCycleSwitch) pageTitle = `Switch to ${isAnnual ? 'Annual' : 'Monthly'} Billing`

  let ctaLabel = `Start ${targetCfg.name} Plan`
  if (isDowngrade)   ctaLabel = 'Confirm Downgrade'
  if (isCycleSwitch) ctaLabel = `Switch to ${isAnnual ? 'Annual' : 'Monthly'}`

  return (
    <div className="space-y-5" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>

      {/* Back */}
      <button
        onClick={() => router.push('/plans')}
        className="flex items-center gap-1.5 text-[13px] text-[#737370] hover:text-[#1A1816] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Plans
      </button>

      {/* Header */}
      <div>
        <h1 className="text-[20px] font-bold text-[#1A1816] tracking-tight">{pageTitle}</h1>
        <p className="text-[13px] text-[#737370] mt-0.5">Review your plan change before confirming.</p>
      </div>

      {/* Property block warning */}
      {propBlock && (
        <div className="flex items-start gap-3 p-4 bg-[#FEF0EF] border border-[#F5C4C0] rounded">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#D03839]" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[#B82F30] mb-1">
              {propBlock.count} active listings detected
            </p>
            <p className="text-[12px] text-[#B82F30] leading-relaxed">
              Pro allows a maximum of 10 listings. Please deactivate {propBlock.count - 10} listing{propBlock.count - 10 > 1 ? 's' : ''} before switching.
            </p>
          </div>
          <a
            href="/properties"
            className="flex-shrink-0 text-[12px] font-semibold text-[#D03839] underline underline-offset-2 hover:no-underline whitespace-nowrap"
          >
            Manage listings
          </a>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5 items-start">

        {/* ── Left ── */}
        <div className="space-y-5">

          {/* Plan transition card */}
          <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E8E8E4]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8A8A4]">Plan change</p>
            </div>
            <div className="p-5 flex items-center gap-4">

              {/* Current plan */}
              {currentCfg && (() => {
                const CurrIcon = currentCfg.Icon
                return (
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${currentCfg.iconBg}`}>
                      <CurrIcon className={`w-5 h-5 ${currentCfg.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#1A1816] leading-tight">{currentCfg.name}</p>
                      <p className="text-[12px] text-[#A8A8A4] mt-0.5">
                        {plan?.billing_cycle === 'annual' ? 'Annual' : 'Monthly'}
                        {isTrialing && ' · Trial'}
                      </p>
                    </div>
                  </div>
                )
              })()}

              {/* Arrow */}
              <div className="w-8 h-8 rounded-full bg-[#F3F3F0] flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="#737370" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Target plan */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${targetCfg.iconBg}`}>
                  <TargetIcon className={`w-5 h-5 ${targetCfg.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#1A1816] leading-tight">{targetCfg.name}</p>
                  <p className="text-[12px] text-[#A8A8A4] mt-0.5">{isAnnual ? 'Annual' : 'Monthly'}</p>
                </div>
              </div>

            </div>
          </div>

          {/* Features card */}
          <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E8E8E4]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8A8A4]">
                {isCycleSwitch ? `What's included` : `What you're getting`}
              </p>
            </div>
            <div className="p-5">
              <ul className="space-y-3">
                {targetCfg.features.map((feat, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-[13px] text-[#1A1816]">
                    <span className="w-4 h-4 rounded-full bg-[#E4F5EC] border border-[#9FDBB8] flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-[#0F6E56]" />
                    </span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>

        {/* ── Right: order summary ── */}
        <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden sticky top-6">

          <div className="px-5 py-4 border-b border-[#E8E8E4]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8A8A4]">Order Summary</p>
          </div>

          <div className="p-5 space-y-4">

            {/* Plan name + price */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[17px] font-bold text-[#1A1816] leading-tight">{targetCfg.name}</p>
                <p className="text-[12px] text-[#737370] mt-0.5">{isAnnual ? 'Annual billing' : 'Monthly billing'}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="flex items-end gap-1 leading-none">
                  <span className="text-[32px] font-bold text-[#1A1816] tracking-tight leading-none">
                    <sup className="text-[14px] font-normal align-super">$</sup>{isAnnual ? annualTotal.toLocaleString() : price}
                  </span>
                  <span className="text-[12px] text-[#737370] mb-0.5">{isAnnual ? '/yr' : '/mo'}</span>
                </div>
                {isAnnual && (
                  <p className="text-[11px] text-[#A8A8A4] mt-1">${price}/mo · billed upfront</p>
                )}
              </div>
            </div>

            {isAnnual && (
              <div className="flex items-center justify-between px-3 py-2 bg-[#E4F5EC] border border-[#9FDBB8] rounded">
                <p className="text-[12px] font-semibold text-[#0F6E56]">Annual discount</p>
                <p className="text-[12px] font-semibold text-[#0F6E56]">Save 20%</p>
              </div>
            )}

            <div className="border-t border-[#F3F3F0]" />

            {/* When it takes effect */}
            <div className="flex items-start gap-2.5 p-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#737370]" />
              <p className="text-[12px] text-[#737370] leading-relaxed">{effectNote}</p>
            </div>

            {/* Payment method */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A8A8A4] mb-2">Payment method</p>
              {paymentMethod ? (
                <div className="flex items-center gap-3 p-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded">
                  <div className="w-10 h-7 bg-[#1A1816] rounded text-white text-[8px] font-bold flex items-center justify-center tracking-wider uppercase flex-shrink-0">
                    {(paymentMethod.brand || 'Card').slice(0, 4)}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#1A1816] capitalize">
                      {paymentMethod.brand} •••• {paymentMethod.last4}
                    </p>
                    <p className="text-[11px] text-[#A8A8A4] mt-0.5">
                      Expires {String(paymentMethod.exp_month).padStart(2, '0')} / {paymentMethod.exp_year}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded">
                  <CreditCard className="w-4 h-4 text-[#A8A8A4] flex-shrink-0" />
                  <p className="text-[13px] text-[#A8A8A4]">No card on file</p>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#D03839]" />
                <p className="text-[12px] text-[#B82F30] leading-relaxed">{error}</p>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className={`w-full flex items-center justify-center gap-2 py-3 text-[13px] font-semibold rounded transition-all active:scale-[0.98] disabled:opacity-50 ${
                isDowngrade
                  ? 'bg-[#1A1816] text-white hover:bg-[#2A2A26]'
                  : 'bg-[#D03839] text-white hover:bg-[#E0493B] active:bg-[#C73022]'
              }`}
            >
              {confirming
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                : ctaLabel
              }
            </button>

            <button
              onClick={() => router.push('/plans')}
              disabled={confirming}
              className="w-full text-[12px] font-medium text-[#737370] hover:text-[#1A1816] transition-colors text-center disabled:opacity-50"
            >
              Cancel
            </button>

            {/* Stripe badge */}
            <div className="flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3 text-[#A8A8A4]" />
              <p className="text-[11px] text-[#A8A8A4]">Secured by Stripe</p>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Suspense wrapper (required for useSearchParams) ──────────────────────────
export default function UpgradePage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#737370]" />
      </div>
    }>
      <UpgradeContent />
    </Suspense>
  )
}
