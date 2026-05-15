'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Check, Calendar, Zap, Building2, ArrowRight, X } from 'lucide-react'

const CheckIcon = ({ filled }) => (
  <span
    className={`flex-shrink-0 mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
      filled ? 'bg-[#1A1816] border-[#1A1816]' : 'border-[#E8E8E4]'
    }`}
  >
    {filled && (
      <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
        <path d="M1 2.5L2.8 4.2L6 1" stroke="#FAFAF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </span>
)

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }) {
  const map = {
    active:    { label: 'Active',     cls: 'bg-[#E4F5EC] text-[#0F6E56] border-[#9FDBB8]' },
    trialing:  { label: 'Trial',      cls: 'bg-[#FEF3E2] text-[#B5620A] border-[#F5D9A0]' },
    past_due:  { label: 'Past due',   cls: 'bg-[#FEF0EF] text-[#D03839] border-[#F5C4C0]' },
    canceled:  { label: 'Canceled',   cls: 'bg-[#F3F3F0] text-[#737370] border-[#E8E8E4]' },
    canceling: { label: 'Canceling',  cls: 'bg-[#FEF3E2] text-[#B5620A] border-[#F5D9A0]' },
  }
  const s = map[status] || { label: status || '—', cls: 'bg-[#F3F3F0] text-[#737370] border-[#E8E8E4]' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${s.cls}`}>
      {s.label}
    </span>
  )
}

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

const ENTERPRISE_FEATURES = [
  [true, 'Everything in Pro'],
  [true, 'Unlimited listings'],
  [true, 'Basic CRM features'],
  [true, 'Lead management tools'],
  [true, 'Team accounts'],
  [true, 'Custom branding'],
  [true, 'Dedicated account support'],
  [true, <>API access <span className="text-[10px] text-[#A8A8A4] ml-0.5">· soon</span></>],
]


export default function PlansPage() {
  const router = useRouter()

  const [sellerId,      setSellerId]      = useState(null)
  const [plan,          setPlan]          = useState(null)
  const [pending,       setPending]       = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [success,       setSuccess]       = useState(null)
  const [viewAnnual,    setViewAnnual]    = useState(true)
  const [cancelingPend,       setCancelingPend]       = useState(false)
  const [endingTrial,         setEndingTrial]         = useState(false)
  const [showEndTrialConfirm, setShowEndTrialConfirm] = useState(false)
  const [teamWorkspace,       setTeamWorkspace]       = useState(null)

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (!userStr) return
    const user = JSON.parse(userStr)
    setSellerId(user.id)
    fetch('/api/team/workspaces', { headers: { Authorization: `Bearer ${user.id}` } })
      .then(r => r.json())
      .then(ws => { if (ws?.current?.id) setTeamWorkspace(ws.current) })
      .catch(() => {})
    // Pick up success message passed back from the upgrade page
    const msg = sessionStorage.getItem('planChangeSuccess')
    if (msg) { setSuccess(msg); sessionStorage.removeItem('planChangeSuccess') }
  }, [])

  useEffect(() => {
    if (sellerId && !teamWorkspace) loadPlanInfo()
    else if (sellerId && teamWorkspace) setLoading(false)
  }, [sellerId, teamWorkspace])

  const loadPlanInfo = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/seller/plan/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: sellerId }),
      })
      const data = await res.json()
      setPlan(data.plan || null)
      setPending(data.pending || null)
      // Initialise toggle to current billing cycle on first load
      if (data.plan?.billing_cycle) setViewAnnual(data.plan.billing_cycle === 'annual')
    } catch {
      setError('Failed to load plan information.')
    } finally {
      setLoading(false)
    }
  }

  const handleEndTrial = async () => {
    setEndingTrial(true)
    setError(null)
    try {
      const res = await fetch('/api/seller/plan/end-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: sellerId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'Failed to end trial.'); return }
      setSuccess('Your trial has ended. Your subscription is now active.')
      setShowEndTrialConfirm(false)
      await loadPlanInfo()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setEndingTrial(false)
    }
  }

  // Navigate to the dedicated upgrade/change page
  const handleInitiateChange = (newPlanType) => {
    const cycle = viewAnnual ? 'annual' : 'monthly'
    router.push(`/plans/upgrade/${newPlanType}?cycle=${cycle}`)
  }

  const handleCancelPending = async () => {
    setCancelingPend(true)
    setError(null)
    try {
      const res = await fetch('/api/seller/plan/cancel-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: sellerId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'Failed to cancel scheduled change.'); return }
      setSuccess('Scheduled plan change has been cancelled.')
      await loadPlanInfo()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setCancelingPend(false)
    }
  }

  const currentPlanType = plan?.plan_type
  const isAnnual        = plan?.billing_cycle === 'annual'
  const isPro           = currentPlanType === 'pro'
  const isEnterprise    = currentPlanType === 'enterprise'
  const isTrialing      = plan?.status === 'trialing'
  const canChange       = plan && ['active', 'trialing'].includes(plan.status)

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#737370]" />
      </div>
    )
  }

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Page header */}
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-[#1A1816]">Plans</h1>
          <p className="text-[13px] text-[#737370] mt-0.5">Manage your subscription plan.</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex items-start gap-3 p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[#B82F30]">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] font-medium">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-3 p-3 bg-[#E4F5EC] border border-[#9FDBB8] rounded text-[#0F6E56]">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] font-medium">{success}</p>
          </div>
        )}

        {plan ? (
          <>
            {/* ── Current plan summary card ── */}
            <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E4]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8A8A4]">Current Plan</p>
                <StatusBadge status={plan.status} />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${
                    isEnterprise ? 'bg-[#1A1816] text-white' : 'bg-[#FEF0EF] text-[#D03839]'
                  }`}>
                    {isEnterprise ? <Building2 className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-[17px] font-bold text-[#1A1816] leading-tight">
                      {isPro ? 'Pro Seller' : isEnterprise ? 'Enterprise' : '—'}
                    </p>
                    <p className="text-[12px] text-[#737370] mt-0.5">
                      {isAnnual ? 'Annual billing' : 'Monthly billing'}
                      {' · '}
                      {isPro ? (isAnnual ? '$948 / year' : '$99 / month') : (isAnnual ? '$2,868 / year' : '$299 / month')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t border-[#E8E8E4]">
                  {isTrialing && plan.trial_ends_at && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A8A8A4] mb-1">Trial ends</p>
                      <p className="text-[14px] font-semibold text-[#B5620A] mb-1">{formatDate(plan.trial_ends_at)}</p>
                      <button
                        onClick={() => setShowEndTrialConfirm(true)}
                        className="text-[11px] font-semibold text-[#737370] underline underline-offset-2 hover:text-[#1A1816] hover:no-underline"
                      >
                        End trial early
                      </button>
                    </div>
                  )}
                  {plan.current_period_end && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A8A8A4] mb-1">
                        {isTrialing ? 'First billing' : 'Next renewal'}
                      </p>
                      <p className="text-[14px] font-semibold text-[#1A1816]">{formatDate(plan.current_period_end)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A8A8A4] mb-1">Listings used</p>
                    <p className="text-[14px] font-semibold text-[#1A1816]">
                      {plan.listings_used_this_period ?? 0}{isPro ? ' / 5' : isEnterprise ? ' / ∞' : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A8A8A4] mb-1">Billing cycle</p>
                    <p className="text-[14px] font-semibold text-[#1A1816]">{isAnnual ? 'Annual' : 'Monthly'}</p>
                  </div>
                </div>

                {/* End trial confirmation */}
                {isTrialing && showEndTrialConfirm && (
                  <div className="mt-4 pt-4 border-t border-[#E8E8E4] flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#B5620A]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1A1816]">End your trial now?</p>
                      <p className="text-[12px] text-[#737370] mt-0.5">Your card will be charged immediately and your subscription will activate today.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setShowEndTrialConfirm(false)}
                        disabled={endingTrial}
                        className="text-[12px] font-semibold text-[#737370] hover:text-[#1A1816] disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleEndTrial}
                        disabled={endingTrial}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1816] text-white text-[12px] font-semibold rounded hover:bg-[#2d2d2a] disabled:opacity-50 transition-colors"
                      >
                        {endingTrial && <Loader2 className="w-3 h-3 animate-spin" />}
                        End trial
                      </button>
                    </div>
                  </div>
                )}

                {/* Usage bar for Pro */}
                {isPro && (
                  <div className="mt-4 pt-4 border-t border-[#E8E8E4]">
                    <div className="flex justify-between items-center mb-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A8A8A4]">Monthly listings</p>
                      <p className="text-[11px] text-[#737370]">{plan.listings_used_this_period ?? 0} of 5 used</p>
                    </div>
                    <div className="h-1.5 bg-[#F3F3F0] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#D03839] rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((plan.listings_used_this_period ?? 0) / 5) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Pending change notice ── */}
            {pending && !success && (
              <div className="flex items-start gap-3 p-4 bg-[#FEF3E2] border border-[#F3C97D] rounded">
                <Calendar className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#B5620A]" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#B5620A]">Plan change scheduled</p>
                  <p className="text-[12px] text-[#B5620A] mt-0.5">
                    Switching to <strong>{pending.plan_type === 'enterprise' ? 'Enterprise' : 'Pro Seller'} ({pending.billing_cycle === 'annual' ? 'Annual' : 'Monthly'})</strong> on {formatDate(pending.scheduled_for)}.
                    Your current plan remains active until then.
                  </p>
                </div>
                <button
                  onClick={handleCancelPending}
                  disabled={cancelingPend}
                  className="flex-shrink-0 flex items-center gap-1 text-[12px] font-semibold text-[#B5620A] underline underline-offset-2 hover:no-underline disabled:opacity-50"
                >
                  {cancelingPend ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Cancel change'}
                </button>
              </div>
            )}

            {/* ── Section label ── */}
            <div className="flex items-center gap-3 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8A8A4] whitespace-nowrap">
                {isPro ? 'Upgrade your plan' : 'Change your plan'}
              </p>
              <div className="flex-1 h-px bg-[#E8E8E4]" />
            </div>

            {/* ── Billing toggle ── */}
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="flex items-center gap-3 bg-[#F5F5F3] border border-[#E8E8E4] rounded-full px-5 py-2.5">
                <span className={`text-[13px] font-semibold transition-colors ${!viewAnnual ? 'text-[#1A1816]' : 'text-[#A8A8A4]'}`}>Monthly</span>
                <button
                  type="button"
                  onClick={() => setViewAnnual(v => !v)}
                  className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${viewAnnual ? 'bg-[#D03839]' : 'bg-[#D4D4CF]'}`}
                >
                  <span className={`absolute top-[4px] left-[4px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${viewAnnual ? 'translate-x-[20px]' : ''}`} />
                </button>
                <span className={`text-[13px] font-semibold transition-colors ${viewAnnual ? 'text-[#1A1816]' : 'text-[#A8A8A4]'}`}>Annual</span>
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-opacity ${viewAnnual ? 'bg-[#E4F5EC] text-[#0F6E56] border border-[#9FDBB8] opacity-100' : 'opacity-0'}`}>
                Save 20% on annual billing
              </span>
            </div>

            {/* ── Plan cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Pro Seller */}
              {(() => {
                const isCurrent     = isPro && (isAnnual === viewAnnual)
                const isPendingThis = pending?.plan_type === 'pro' && pending?.billing_cycle === (viewAnnual ? 'annual' : 'monthly')
                const isCycleSwitch = isPro && (isAnnual !== viewAnnual)
                const isAction      = (isEnterprise || isCycleSwitch) && !isPendingThis && canChange

                return (
                  <div className={`bg-white rounded p-5 flex flex-col border-2 ${
                    isCurrent ? 'border-[#D03839]' : isPendingThis ? 'border-[#F3C97D]' : 'border-[#E8E8E4]'
                  }`}>
                    <div className="min-h-[22px] mb-3">
                      {isCurrent && (
                        <span className="inline-block text-[11px] font-semibold bg-[#FEF0EF] text-[#D03839] px-2.5 py-0.5 rounded">
                          Current plan
                        </span>
                      )}
                      {isPro && !isCurrent && !isPendingThis && (
                        <span className="inline-block text-[11px] font-semibold bg-[#F3F3F0] text-[#737370] px-2.5 py-0.5 rounded">
                          Your plan · {isAnnual ? 'annual' : 'monthly'}
                        </span>
                      )}
                      {isPendingThis && (
                        <span className="inline-block text-[11px] font-semibold bg-[#FEF3E2] text-[#B5620A] px-2.5 py-0.5 rounded">
                          Scheduled
                        </span>
                      )}
                      {!isCurrent && !isPendingThis && (
                        <span className="inline-block text-[11px] font-semibold bg-[#F3F3F0] text-[#A8A8A4] px-2.5 py-0.5 rounded">
                          Most popular
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[#A8A8A4] mb-1">Subscription</p>
                    <h2 className="text-2xl font-bold text-[#1A1816] tracking-tight mb-1">Pro Seller</h2>
                    <p className="text-xs text-[#737370] leading-relaxed mb-4">
                      For active investors and wholesalers moving deals consistently.
                    </p>

                    <div className="flex items-end gap-1.5 leading-none mb-1">
                      <span className="text-[38px] font-bold text-[#1A1816] tracking-tight leading-none">
                        <sup className="text-lg font-normal align-super">$</sup>{viewAnnual ? '948' : '99'}
                      </span>
                      <span className="text-sm font-normal text-[#737370] mb-1">{viewAnnual ? '/ year' : '/ per month'}</span>
                    </div>
                    <p className="text-xs text-[#737370] mb-1">
                      {viewAnnual ? '$79/mo · billed as $948 upfront' : 'Billed monthly'} · 5 listings included
                    </p>
                    <p className="text-[11px] text-[#A8A8A4] mb-5">
                      {viewAnnual ? 'Save $240 vs monthly' : '$19 per additional listing'}
                    </p>

                    {isCurrent ? (
                      <div className="w-full py-2.5 text-center text-xs font-semibold tracking-[0.05em] uppercase border border-[#E8E8E4] text-[#A8A8A4] rounded mb-5 cursor-default select-none">
                        Your current plan
                      </div>
                    ) : isPendingThis ? (
                      <div className="w-full py-2.5 text-center text-xs font-semibold tracking-[0.05em] uppercase border border-[#F3C97D] text-[#B5620A] rounded mb-5 cursor-default select-none">
                        Switching on {formatDate(pending?.scheduled_for)}
                      </div>
                    ) : isAction ? (
                      <button
                        onClick={() => handleInitiateChange('pro')}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold tracking-[0.05em] uppercase border border-[#D4D4CF] text-[#1A1816] rounded hover:bg-[#F3F3F0] transition-colors mb-5"
                      >
                        <ArrowRight className={`w-3.5 h-3.5 ${isEnterprise ? 'rotate-180' : ''}`} />
                        {isEnterprise ? 'Downgrade to Pro' : viewAnnual ? 'Switch to Annual' : 'Switch to Monthly'}
                      </button>
                    ) : null}

                    <hr className="border-t border-[#E8E8E4] mb-4" />
                    <p className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[#A8A8A4] mb-3">Includes</p>
                    <ul className="flex flex-col gap-1.5 flex-1">
                      {PRO_FEATURES.map(([on, label], i) => (
                        <li key={i} className={`flex items-start gap-2 text-xs leading-snug ${on ? 'text-[#1A1816]' : 'text-[#A8A8A4]'}`}>
                          <CheckIcon filled={on} />{label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}

              {/* Enterprise */}
              {(() => {
                const isCurrent     = isEnterprise && (isAnnual === viewAnnual)
                const isPendingThis = pending?.plan_type === 'enterprise' && pending?.billing_cycle === (viewAnnual ? 'annual' : 'monthly')
                const isCycleSwitch = isEnterprise && (isAnnual !== viewAnnual)
                const isAction      = (isPro || isCycleSwitch) && !isPendingThis && canChange

                return (
                  <div className={`bg-white rounded p-5 flex flex-col border-2 ${
                    isCurrent ? 'border-[#1A1816]' : isPendingThis ? 'border-[#F3C97D]' : 'border-[#E8E8E4]'
                  }`}>
                    <div className="min-h-[22px] mb-3">
                      {isEnterprise && !isCurrent && !isPendingThis && (
                        <span className="inline-block text-[11px] font-semibold bg-[#F3F3F0] text-[#737370] px-2.5 py-0.5 rounded">
                          Your plan · {isAnnual ? 'annual' : 'monthly'}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="inline-block text-[11px] font-semibold bg-[#1A1816] text-white px-2.5 py-0.5 rounded">
                          Current plan
                        </span>
                      )}
                      {isPendingThis && (
                        <span className="inline-block text-[11px] font-semibold bg-[#FEF3E2] text-[#B5620A] px-2.5 py-0.5 rounded">
                          Scheduled
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[#A8A8A4] mb-1">Subscription</p>
                    <h2 className="text-2xl font-bold text-[#1A1816] tracking-tight mb-1">Enterprise</h2>
                    <p className="text-xs text-[#737370] leading-relaxed mb-4">
                      For acquisition teams running high-volume pipelines.
                    </p>

                    <div className="flex items-end gap-1.5 leading-none mb-1">
                      <span className="text-[38px] font-bold text-[#1A1816] tracking-tight leading-none">
                        <sup className="text-lg font-normal align-super">$</sup>{viewAnnual ? '2,868' : '299'}
                      </span>
                      <span className="text-sm font-normal text-[#737370] mb-1">{viewAnnual ? '/ year' : '/ per month'}</span>
                    </div>
                    <p className="text-xs text-[#737370] mb-1">
                      {viewAnnual ? '$239/mo · billed as $2,868 upfront' : 'Billed monthly'} · unlimited listings
                    </p>
                    <p className="text-[11px] text-[#A8A8A4] mb-5">
                      {viewAnnual ? 'Save $720 vs monthly' : <>&nbsp;</>}
                    </p>

                    {isCurrent ? (
                      <div className="w-full py-2.5 text-center text-xs font-semibold tracking-[0.05em] uppercase border border-[#E8E8E4] text-[#A8A8A4] rounded mb-5 cursor-default select-none">
                        Your current plan
                      </div>
                    ) : isPendingThis ? (
                      <div className="w-full py-2.5 text-center text-xs font-semibold tracking-[0.05em] uppercase border border-[#F3C97D] text-[#B5620A] rounded mb-5 cursor-default select-none">
                        Switching on {formatDate(pending?.scheduled_for)}
                      </div>
                    ) : isAction ? (
                      <button
                        onClick={() => handleInitiateChange('enterprise')}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold tracking-[0.05em] uppercase bg-[#D03839] text-white rounded hover:bg-[#B82F30] transition-colors mb-5"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        {isPro ? 'Upgrade to Enterprise' : viewAnnual ? 'Switch to Annual' : 'Switch to Monthly'}
                      </button>
                    ) : null}

                    <hr className="border-t border-[#E8E8E4] mb-4" />
                    <p className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[#A8A8A4] mb-3">Includes</p>
                    <ul className="flex flex-col gap-1.5 flex-1">
                      {ENTERPRISE_FEATURES.map(([on, label], i) => (
                        <li key={i} className={`flex items-start gap-2 text-xs leading-snug ${on ? 'text-[#1A1816]' : 'text-[#A8A8A4]'}`}>
                          <CheckIcon filled={on} />{label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}

            </div>
          </>
        ) : (
          /* No plan state */
          teamWorkspace ? (
            <div className="bg-white border border-[#E8E8E4] rounded p-8 flex items-start gap-4">
              <div className="w-10 h-10 rounded bg-[#E4F5EC] flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-[#0F6E56]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#1A1816] mb-1">Covered by {teamWorkspace.name}</p>
                <p className="text-[13px] text-[#737370] leading-relaxed">Your access is included under your team's Enterprise plan. Billing and plan management is handled by the team owner.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E8E8E4] rounded p-8 text-center">
              <div className="w-12 h-12 rounded bg-[#F3F3F0] flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-[#A8A8A4]" />
              </div>
              <p className="text-[14px] font-semibold text-[#1A1816] mb-1">No active plan</p>
              <p className="text-[13px] text-[#737370] mb-4">Complete onboarding to subscribe to a plan.</p>
              <a
                href="/onboarding"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#D03839] hover:bg-[#B82F30] text-white text-[13px] font-semibold rounded transition-colors"
              >
                Choose a plan
              </a>
            </div>
          )
        )}

      </div>
    </>
  )
}
