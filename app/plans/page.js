'use client'
import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, Check, Calendar, Zap, Building2, ArrowRight, X, AlertTriangle } from 'lucide-react'

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
  [true,  '10 listings / month'],
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

// ── Confirmation modal ──────────────────────────────────────────────────────
function ConfirmChangeModal({ plan, targetPlanType, onConfirm, onClose, loading }) {
  const isAnnual    = plan?.billing_cycle === 'annual'
  const isUpgrade   = targetPlanType === 'enterprise'
  const scheduledFor = plan?.current_period_end

  const newPriceLabel = isUpgrade
    ? (isAnnual ? '$2,868 / year' : '$299 / month')
    : (isAnnual ? '$948 / year'   : '$99 / month')

  const newPlanName = isUpgrade ? 'Enterprise' : 'Pro Seller'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E4]">
          <p className="text-[14px] font-semibold text-[#1A1816]">
            {isUpgrade ? 'Upgrade to Enterprise' : 'Downgrade to Pro Seller'}
          </p>
          <button onClick={onClose} disabled={loading} className="text-[#A8A8A4] hover:text-[#737370]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* What's changing */}
          <div className="bg-[#F3F3F0] rounded p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#737370]">Switching to</span>
              <span className="text-[13px] font-semibold text-[#1A1816]">{newPlanName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#737370]">New price</span>
              <span className="text-[13px] font-semibold text-[#1A1816]">{newPriceLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#737370]">Takes effect</span>
              <span className="text-[13px] font-semibold text-[#1A1816]">{formatDate(scheduledFor)}</span>
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2.5 p-3 bg-[#FEF3E2] border border-[#F3C97D] rounded">
            <Calendar className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#B5620A]" />
            <p className="text-[12px] text-[#B5620A] leading-relaxed">
              Your current plan stays active until <strong>{formatDate(scheduledFor)}</strong>.
              No charge today — your card will be billed at the new rate on your next renewal.
            </p>
          </div>

          {!isUpgrade && (
            <p className="text-[12px] text-[#737370] leading-relaxed">
              Pro includes up to 10 listings per month. Make sure you have 10 or fewer active listings before your plan switches.
            </p>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 text-[13px] font-semibold border border-[#E8E8E4] text-[#1A1816] rounded hover:bg-[#F3F3F0] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold rounded transition-colors disabled:opacity-50 ${
              isUpgrade
                ? 'bg-[#D03839] text-white hover:bg-[#B82F30]'
                : 'bg-[#1A1816] text-white hover:bg-[#2A2A26]'
            }`}
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : `Confirm ${isUpgrade ? 'Upgrade' : 'Downgrade'}`
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Property block modal (too many listings to downgrade) ───────────────────
function PropertyBlockModal({ activeCount, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E4]">
          <p className="text-[14px] font-semibold text-[#1A1816]">Too many active listings</p>
          <button onClick={onClose} className="text-[#A8A8A4] hover:text-[#737370]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-[#FEF0EF] border border-[#F5C4C0] rounded">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#D03839]" />
            <div>
              <p className="text-[13px] font-semibold text-[#B82F30] mb-1">
                {activeCount} active listings detected
              </p>
              <p className="text-[12px] text-[#B82F30] leading-relaxed">
                Pro Seller allows a maximum of 10 listings per month. Please deactivate {activeCount - 10} listing{activeCount - 10 > 1 ? 's' : ''} before switching.
              </p>
            </div>
          </div>

          <p className="text-[12px] text-[#737370] leading-relaxed">
            Go to your Properties page, deactivate listings you're not actively selling, then return here to complete the downgrade.
          </p>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-[13px] font-semibold border border-[#E8E8E4] text-[#1A1816] rounded hover:bg-[#F3F3F0] transition-colors"
          >
            Close
          </button>
          <a
            href="/properties"
            className="flex-1 flex items-center justify-center py-2.5 text-[13px] font-semibold bg-[#D03839] text-white rounded hover:bg-[#B82F30] transition-colors"
          >
            Manage listings
          </a>
        </div>
      </div>
    </div>
  )
}

export default function PlansPage() {
  const [sellerId,    setSellerId]    = useState(null)
  const [plan,        setPlan]        = useState(null)
  const [pending,     setPending]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [success,     setSuccess]     = useState(null)

  // Modal states
  const [confirmModal,   setConfirmModal]   = useState(null) // { planType }
  const [propBlockModal, setPropBlockModal] = useState(null) // { count }
  const [confirming,     setConfirming]     = useState(false)
  const [cancelingPend,  setCancelingPend]  = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (userStr) setSellerId(JSON.parse(userStr).id)
  }, [])

  useEffect(() => {
    if (sellerId) loadPlanInfo()
  }, [sellerId])

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
    } catch {
      setError('Failed to load plan information.')
    } finally {
      setLoading(false)
    }
  }

  // Step 1: user clicks upgrade/downgrade → show confirmation modal
  const handleInitiateChange = (newPlanType) => {
    setError(null)
    setSuccess(null)
    setConfirmModal({ planType: newPlanType })
  }

  // Step 2: user confirms in modal → call API
  const handleConfirmChange = async () => {
    const newPlanType = confirmModal?.planType
    if (!newPlanType) return

    setConfirming(true)
    try {
      const res = await fetch('/api/seller/plan/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: sellerId, new_plan_type: newPlanType }),
      })
      const data = await res.json()

      if (res.status === 422 && data.requires_deactivation) {
        setConfirmModal(null)
        setPropBlockModal({ count: data.active_count })
        return
      }

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to change plan.')
        setConfirmModal(null)
        return
      }

      const renewalNote = data.scheduled_for ? ` on ${formatDate(data.scheduled_for)}` : ''
      setSuccess(`Scheduled: switching to ${newPlanType === 'enterprise' ? 'Enterprise' : 'Pro Seller'}${renewalNote}.`)
      setConfirmModal(null)
      await loadPlanInfo()
    } catch {
      setError('Something went wrong. Please try again.')
      setConfirmModal(null)
    } finally {
      setConfirming(false)
    }
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
      {/* Confirmation modal */}
      {confirmModal && (
        <ConfirmChangeModal
          plan={plan}
          targetPlanType={confirmModal.planType}
          onConfirm={handleConfirmChange}
          onClose={() => setConfirmModal(null)}
          loading={confirming}
        />
      )}

      {/* Property block modal */}
      {propBlockModal && (
        <PropertyBlockModal
          activeCount={propBlockModal.count}
          onClose={() => setPropBlockModal(null)}
        />
      )}

      <div className="space-y-5 max-w-3xl mx-auto">

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
                      <p className="text-[14px] font-semibold text-[#B5620A]">{formatDate(plan.trial_ends_at)}</p>
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
                      {plan.listings_used_this_period ?? 0}{isPro ? ' / 10' : isEnterprise ? ' / ∞' : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A8A8A4] mb-1">Billing cycle</p>
                    <p className="text-[14px] font-semibold text-[#1A1816]">{isAnnual ? 'Annual' : 'Monthly'}</p>
                  </div>
                </div>

                {/* Usage bar for Pro */}
                {isPro && (
                  <div className="mt-4 pt-4 border-t border-[#E8E8E4]">
                    <div className="flex justify-between items-center mb-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A8A8A4]">Monthly listings</p>
                      <p className="text-[11px] text-[#737370]">{plan.listings_used_this_period ?? 0} of 10 used</p>
                    </div>
                    <div className="h-1.5 bg-[#F3F3F0] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#D03839] rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((plan.listings_used_this_period ?? 0) / 10) * 100)}%` }}
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
                    Switching to <strong>{pending.plan_type === 'enterprise' ? 'Enterprise' : 'Pro Seller'}</strong> on {formatDate(pending.scheduled_for)}.
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

            {/* ── Plan cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Pro Seller */}
              {(() => {
                const isCurrent     = isPro
                const isPendingThis = pending?.plan_type === 'pro'
                const isAction      = isEnterprise && !isPendingThis && canChange

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

                    <div className="text-[38px] font-bold text-[#1A1816] leading-none tracking-tight mb-1">
                      <sup className="text-lg font-normal align-super">$</sup>{isAnnual ? '948' : '99'}
                    </div>
                    <p className="text-xs text-[#737370] mb-1">
                      {isAnnual ? 'per year · billed annually' : 'per month'} · 10 listings included
                    </p>
                    <p className="text-[11px] text-[#A8A8A4] mb-5">
                      {isAnnual ? 'Save $240 vs monthly · $79/mo' : '$19 per additional listing'}
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
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" />Downgrade to Pro
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
                const isCurrent     = isEnterprise
                const isPendingThis = pending?.plan_type === 'enterprise'
                const isAction      = isPro && !isPendingThis && canChange

                return (
                  <div className={`bg-white rounded p-5 flex flex-col border-2 ${
                    isCurrent ? 'border-[#1A1816]' : isPendingThis ? 'border-[#F3C97D]' : 'border-[#E8E8E4]'
                  }`}>
                    <div className="min-h-[22px] mb-3">
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

                    <div className="text-[38px] font-bold text-[#1A1816] leading-none tracking-tight mb-1">
                      <sup className="text-lg font-normal align-super">$</sup>{isAnnual ? '2,868' : '299'}
                    </div>
                    <p className="text-xs text-[#737370] mb-1">
                      {isAnnual ? 'per year · billed annually' : 'per month'} · unlimited listings
                    </p>
                    <p className="text-[11px] text-[#A8A8A4] mb-5">
                      {isAnnual ? 'Save $720 vs monthly · $239/mo' : <>&nbsp;</>}
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
                        <ArrowRight className="w-3.5 h-3.5" />Upgrade to Enterprise
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
        )}

      </div>
    </>
  )
}
