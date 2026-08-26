'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Check, Calendar, Zap, Building2, ArrowRight, X, CreditCard } from 'lucide-react'

// Checklist glyph — value-encoded mono ✓ / — (inherits the row's text color).
const CheckIcon = ({ filled }) => (
  <span className="flex-shrink-0 font-mono text-[12px] font-bold leading-[1.5]">
    {filled ? '✓' : '—'}
  </span>
)

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Status is value-encoded, never hue: active = ink fill, trial/canceling =
// muted fill, past_due = white + ink outline, canceled = line-2 outline.
const pillBase = 'inline-flex items-center px-2.5 py-0.5 rounded-pill font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em]'
function StatusBadge({ status }) {
  const map = {
    active:    { label: 'Active',     cls: 'bg-ink text-white border-[1.5px] border-ink' },
    trialing:  { label: 'Trial',      cls: 'bg-muted text-white border-[1.5px] border-muted' },
    past_due:  { label: 'Past due',   cls: 'bg-white text-ink border-[1.5px] border-ink' },
    canceled:  { label: 'Canceled',   cls: 'bg-white text-muted border-[1.5px] border-line-2' },
    canceling: { label: 'Canceling',  cls: 'bg-muted text-white border-[1.5px] border-muted' },
  }
  const s = map[status] || { label: status || '—', cls: 'bg-white text-muted border-[1.5px] border-line-2' }
  return (
    <span className={`${pillBase} ${s.cls}`}>
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
  [true, <>API access <span className="font-mono text-[10px] text-mist ml-0.5">· soon</span></>],
]


export default function PlansPage() {
  const router = useRouter()

  const [sellerId,      setSellerId]      = useState(null)
  const [plan,          setPlan]          = useState(null)
  const [pending,       setPending]       = useState(null)
  const [isLifetimeFree, setIsLifetimeFree] = useState(false)
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
    const msg = sessionStorage.getItem('planChangeSuccess')
    if (msg) { setSuccess(msg); sessionStorage.removeItem('planChangeSuccess') }
    // Check workspace first, then decide whether to load plan
    fetch('/api/team/workspaces', { headers: { Authorization: `Bearer ${user.id}` } })
      .then(r => r.json())
      .then(ws => {
        if (ws?.current?.id) {
          setTeamWorkspace(ws.current)
          setLoading(false)
        } else {
          loadPlanInfo(user.id)
        }
      })
      .catch(() => loadPlanInfo(user.id))
  }, [])

  const loadPlanInfo = async (id) => {
    const sid = id || sellerId
    setLoading(true)
    try {
      const res = await fetch('/api/seller/plan/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: sid }),
      })
      const data = await res.json()
      setPlan(data.plan || null)
      setPending(data.pending || null)
      setIsLifetimeFree(!!data.lifetime_free)
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
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    )
  }

  if (isLifetimeFree && plan) {
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-[-0.02em] text-body">Plans</h1>
          <p className="text-[13px] text-muted mt-0.5">Your subscription plan.</p>
        </div>
        <div className="bg-white border-[1.5px] border-ink rounded-2xl shadow-offset-5 p-5 flex flex-col max-w-sm">
          <div className="min-h-[22px] mb-3">
            <span className={`${pillBase} bg-ink text-white border-[1.5px] border-ink`}>
              Lifetime Free
            </span>
          </div>
          <p className="font-mono text-[11px] font-semibold tracking-[0.14em] uppercase text-muted mb-1">Subscription</p>
          <h2 className="font-display text-2xl font-bold text-body tracking-[-0.02em] mb-1">Enterprise</h2>
          <p className="text-xs text-muted leading-relaxed mb-4">Full enterprise access, complimentary.</p>
          <div className="w-full py-2.5 text-center font-mono text-[11px] font-semibold tracking-[0.06em] uppercase border-[1.5px] border-line-2 text-mist rounded-[10px] mb-5 cursor-default select-none">
            Active — no billing required
          </div>
          <hr className="border-t border-hairline mb-4" />
          <p className="font-mono text-[11px] font-semibold tracking-[0.14em] uppercase text-muted mb-3">Includes</p>
          <ul className="flex flex-col gap-1.5 flex-1">
            {ENTERPRISE_FEATURES.map(([on, label], i) => (
              <li key={i} className={`flex items-start gap-2 text-[13.5px] leading-snug ${on ? 'text-body' : 'text-mist'}`}>
                <CheckIcon filled={on} />{label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Page header */}
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-[-0.02em] text-body">Plans</h1>
          <p className="text-[13px] text-muted mt-0.5">Manage your subscription plan.</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex items-start gap-3 p-3 bg-tint border-[1.5px] border-ink rounded-[10px] text-ink">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] font-semibold">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-3 p-3 bg-tint border-[1.5px] border-ink rounded-[10px] text-ink">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] font-semibold">{success}</p>
          </div>
        )}

        {plan ? (
          <>
            {/* ── Past-due recovery banner ── */}
            {plan.status === 'past_due' && (
              <div className="bg-tint border-[1.5px] border-ink rounded-[12px] p-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[10px] bg-white border-[1.5px] border-ink flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-ink" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-body">Your last payment failed</p>
                    <p className="text-[12px] text-muted mt-0.5">Update your card to keep your plan active and retry the charge.</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/billing')}
                  className="flex-shrink-0 h-9 px-4 bg-ink hover:bg-smoke-2 text-white text-[13px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 transition-all duration-120"
                >
                  Update card &amp; retry
                </button>
              </div>
            )}

            {/* ── Current plan summary card ── */}
            <div className="bg-white border-[1.5px] border-ink rounded-[14px] shadow-offset-4 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b-[1.5px] border-ink">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">Current Plan</p>
                <StatusBadge status={plan.status} />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 rounded-[10px] border-[1.5px] border-ink flex items-center justify-center flex-shrink-0 ${
                    isEnterprise ? 'bg-ink text-white' : 'bg-tint text-ink'
                  }`}>
                    {isEnterprise ? <Building2 className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-display text-[17px] font-bold text-body tracking-[-0.01em] leading-tight">
                      {isPro ? 'Pro Seller' : isEnterprise ? 'Enterprise' : '—'}
                    </p>
                    <p className="font-mono text-[11.5px] text-muted mt-0.5">
                      {isAnnual ? 'Annual billing' : 'Monthly billing'}
                      {' · '}
                      {isPro ? (isAnnual ? '$948 / year' : '$99 / month') : (isAnnual ? '$2,868 / year' : '$299 / month')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t border-hairline">
                  {isTrialing && plan.trial_ends_at && (
                    <div>
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">Trial ends</p>
                      <p className="font-mono text-[14px] font-semibold text-smoke-3 mb-1">{formatDate(plan.trial_ends_at)}</p>
                      <button
                        onClick={() => setShowEndTrialConfirm(true)}
                        className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted underline underline-offset-2 hover:text-ink hover:no-underline"
                      >
                        End trial early
                      </button>
                    </div>
                  )}
                  {plan.current_period_end && (
                    <div>
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">
                        {isTrialing ? 'First billing' : 'Next renewal'}
                      </p>
                      <p className="font-mono text-[14px] font-semibold text-body">{formatDate(plan.current_period_end)}</p>
                    </div>
                  )}
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">Listings used</p>
                    <p className="font-mono text-[14px] font-semibold text-body">
                      {plan.listings_used_this_period ?? 0}{isPro ? ' / 5' : isEnterprise ? ' / ∞' : ''}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">Billing cycle</p>
                    <p className="font-mono text-[14px] font-semibold text-body">{isAnnual ? 'Annual' : 'Monthly'}</p>
                  </div>
                </div>

                {/* End trial confirmation */}
                {isTrialing && showEndTrialConfirm && (
                  <div className="mt-4 pt-4 border-t border-hairline flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-ink" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-body">End your trial now?</p>
                      <p className="text-[12px] text-muted mt-0.5">Your card will be charged immediately and your subscription will activate today.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setShowEndTrialConfirm(false)}
                        disabled={endingTrial}
                        className="text-[12px] font-semibold text-muted hover:text-ink disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleEndTrial}
                        disabled={endingTrial}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-white text-[12px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 hover:bg-smoke-2 disabled:opacity-50 transition-all duration-120"
                      >
                        {endingTrial && <Loader2 className="w-3 h-3 animate-spin" />}
                        End trial
                      </button>
                    </div>
                  </div>
                )}

                {/* Usage bar for Pro */}
                {isPro && (
                  <div className="mt-4 pt-4 border-t border-hairline">
                    <div className="flex justify-between items-center mb-1.5">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Monthly listings</p>
                      <p className="font-mono text-[11px] text-muted">{plan.listings_used_this_period ?? 0} of 5 used</p>
                    </div>
                    <div className="h-1.5 bg-tint border border-line rounded-pill overflow-hidden">
                      <div
                        className="h-full bg-ink rounded-pill transition-all"
                        style={{ width: `${Math.min(100, ((plan.listings_used_this_period ?? 0) / 5) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Pending change notice ── */}
            {pending && !success && (
              <div className="flex items-start gap-3 p-4 bg-tint border-[1.5px] border-line rounded-[12px]">
                <Calendar className="w-4 h-4 flex-shrink-0 mt-0.5 text-smoke-3" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-body">Plan change scheduled</p>
                  <p className="text-[12px] text-smoke-3 mt-0.5">
                    Switching to <strong>{pending.plan_type === 'enterprise' ? 'Enterprise' : 'Pro Seller'} ({pending.billing_cycle === 'annual' ? 'Annual' : 'Monthly'})</strong> on {formatDate(pending.scheduled_for)}.
                    Your current plan remains active until then.
                  </p>
                </div>
                <button
                  onClick={handleCancelPending}
                  disabled={cancelingPend}
                  className="flex-shrink-0 flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-smoke-3 underline underline-offset-2 hover:no-underline disabled:opacity-50"
                >
                  {cancelingPend ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Cancel change'}
                </button>
              </div>
            )}

            {/* ── Section label ── */}
            <div className="flex items-center gap-3 pt-1">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink whitespace-nowrap">
                {isPro ? 'Upgrade your plan' : 'Change your plan'}
              </p>
              <div className="flex-1 h-px bg-hairline" />
            </div>

            {/* ── Billing toggle — value-encoded ink/line pills ── */}
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewAnnual(false)}
                  className={`font-mono text-[11px] font-semibold uppercase tracking-[0.06em] border-[1.5px] border-ink rounded-pill px-3.5 py-2 transition-colors duration-120 ${!viewAnnual ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-tint'}`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setViewAnnual(true)}
                  className={`font-mono text-[11px] font-semibold uppercase tracking-[0.06em] border-[1.5px] border-ink rounded-pill px-3.5 py-2 transition-colors duration-120 ${viewAnnual ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-tint'}`}
                >
                  Annual
                </button>
              </div>
              <span className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] px-2.5 py-0.5 rounded-pill bg-tint text-ink border-[1.5px] border-ink transition-opacity ${viewAnnual ? 'opacity-100' : 'opacity-0'}`}>
                Save 20% on annual billing
              </span>
            </div>

            {/* ── Plan cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Pro Seller — the "most popular" card gets the black-card-on-paper treatment */}
              {(() => {
                const isCurrent     = isPro && (isAnnual === viewAnnual)
                const isPendingThis = pending?.plan_type === 'pro' && pending?.billing_cycle === (viewAnnual ? 'annual' : 'monthly')
                const isCycleSwitch = isPro && (isAnnual !== viewAnnual)
                const isAction      = (isEnterprise || isCycleSwitch) && !isPendingThis && canChange
                const dark          = !isCurrent && !isPendingThis

                return (
                  <div className={`rounded-2xl p-5 flex flex-col ${
                    dark
                      ? 'bg-coal text-white border-2 border-ink shadow-grey-7'
                      : isCurrent
                        ? 'bg-white border-[1.5px] border-ink shadow-offset-5'
                        : 'bg-white border-[1.5px] border-line'
                  }`}>
                    <div className="min-h-[22px] mb-3 flex items-center gap-2 flex-wrap">
                      {isCurrent && (
                        <span className={`${pillBase} bg-ink text-white border-[1.5px] border-ink`}>
                          Current plan
                        </span>
                      )}
                      {isPro && !isCurrent && !isPendingThis && (
                        <span className={`${pillBase} bg-coal text-mist border-[1.5px] border-coal-line`}>
                          Your plan · billed {isAnnual ? 'annually' : 'monthly'}
                        </span>
                      )}
                      {isPendingThis && (
                        <span className={`${pillBase} bg-muted text-white border-[1.5px] border-muted`}>
                          Scheduled
                        </span>
                      )}
                      {!isCurrent && !isPendingThis && (
                        <span className={`${pillBase} bg-white text-coal border-[1.5px] border-white`}>
                          Most popular
                        </span>
                      )}
                    </div>

                    <p className={`font-mono text-[11px] font-semibold tracking-[0.14em] uppercase mb-1 ${dark ? 'text-mist' : 'text-muted'}`}>Subscription</p>
                    <h2 className={`font-display text-2xl font-bold tracking-[-0.02em] mb-1 ${dark ? 'text-white' : 'text-body'}`}>Pro Seller</h2>
                    <p className={`text-xs leading-relaxed mb-4 ${dark ? 'text-mist' : 'text-muted'}`}>
                      For active investors and wholesalers moving deals consistently.
                    </p>

                    <div className="flex items-end gap-1.5 leading-none mb-1">
                      <span className={`font-display text-[40px] font-bold tracking-[-0.02em] leading-none ${dark ? 'text-white' : 'text-body'}`}>
                        <sup className="text-lg font-normal align-super">$</sup>{viewAnnual ? '948' : '99'}
                      </span>
                      <span className={`font-mono text-[11px] mb-1 ${dark ? 'text-mist' : 'text-muted'}`}>{viewAnnual ? '/ year' : '/ per month'}</span>
                    </div>
                    <p className={`font-mono text-[11px] mb-1 ${dark ? 'text-mist' : 'text-muted'}`}>
                      {viewAnnual ? '$79/mo · billed as $948 upfront' : 'Billed monthly'} · 5 listings included
                    </p>
                    <p className={`font-mono text-[10.5px] mb-5 ${dark ? 'text-mist' : 'text-mist'}`}>
                      {viewAnnual ? 'Save $240 vs monthly' : '$19 per additional listing'}
                    </p>

                    {isCurrent ? (
                      <div className="w-full py-2.5 text-center font-mono text-[11px] font-semibold tracking-[0.06em] uppercase border-[1.5px] border-line-2 text-mist rounded-[10px] mb-5 cursor-default select-none">
                        Your current plan
                      </div>
                    ) : isPendingThis ? (
                      <div className="w-full py-2.5 text-center font-mono text-[11px] font-semibold tracking-[0.06em] uppercase border-[1.5px] border-line text-smoke-3 rounded-[10px] mb-5 cursor-default select-none">
                        Switching on {formatDate(pending?.scheduled_for)}
                      </div>
                    ) : isAction ? (
                      <button
                        onClick={() => handleInitiateChange('pro')}
                        className={`w-full flex items-center justify-center gap-1.5 py-2.5 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase rounded-[10px] transition-colors duration-120 mb-5 ${
                          dark
                            ? 'bg-white text-coal border-[1.5px] border-white hover:bg-hairline'
                            : 'bg-white text-ink border-[1.5px] border-ink shadow-offset-2 hover:bg-tint'
                        }`}
                      >
                        <ArrowRight className={`w-3.5 h-3.5 ${isEnterprise ? 'rotate-180' : ''}`} />
                        {isEnterprise ? 'Downgrade to Pro' : viewAnnual ? 'Switch to Annual' : 'Switch to Monthly'}
                      </button>
                    ) : null}

                    <hr className={`border-t mb-4 ${dark ? 'border-coal-line' : 'border-hairline'}`} />
                    <p className={`font-mono text-[11px] font-semibold tracking-[0.14em] uppercase mb-3 ${dark ? 'text-mist' : 'text-muted'}`}>Includes</p>
                    <ul className="flex flex-col gap-1.5 flex-1">
                      {PRO_FEATURES.map(([on, label], i) => (
                        <li key={i} className={`flex items-start gap-2 text-[13.5px] leading-snug ${on ? (dark ? 'text-white' : 'text-body') : (dark ? 'text-smoke-4' : 'text-mist')}`}>
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
                  <div className={`bg-white rounded-2xl p-5 flex flex-col border-[1.5px] ${
                    isCurrent ? 'border-ink shadow-offset-5' : isPendingThis ? 'border-line' : 'border-ink shadow-offset-5'
                  }`}>
                    <div className="min-h-[22px] mb-3">
                      {isEnterprise && !isCurrent && !isPendingThis && (
                        <span className={`${pillBase} bg-white text-muted border-[1.5px] border-line-2`}>
                          Your plan · billed {isAnnual ? 'annually' : 'monthly'}
                        </span>
                      )}
                      {isCurrent && (
                        <span className={`${pillBase} bg-ink text-white border-[1.5px] border-ink`}>
                          Current plan
                        </span>
                      )}
                      {isPendingThis && (
                        <span className={`${pillBase} bg-muted text-white border-[1.5px] border-muted`}>
                          Scheduled
                        </span>
                      )}
                    </div>

                    <p className="font-mono text-[11px] font-semibold tracking-[0.14em] uppercase text-muted mb-1">Subscription</p>
                    <h2 className="font-display text-2xl font-bold text-body tracking-[-0.02em] mb-1">Enterprise</h2>
                    <p className="text-xs text-muted leading-relaxed mb-4">
                      For acquisition teams running high-volume pipelines.
                    </p>

                    <div className="flex items-end gap-1.5 leading-none mb-1">
                      <span className="font-display text-[40px] font-bold text-body tracking-[-0.02em] leading-none">
                        <sup className="text-lg font-normal align-super">$</sup>{viewAnnual ? '2,868' : '299'}
                      </span>
                      <span className="font-mono text-[11px] text-muted mb-1">{viewAnnual ? '/ year' : '/ per month'}</span>
                    </div>
                    <p className="font-mono text-[11px] text-muted mb-1">
                      {viewAnnual ? '$239/mo · billed as $2,868 upfront' : 'Billed monthly'} · unlimited listings
                    </p>
                    <p className="font-mono text-[10.5px] text-mist mb-5">
                      {viewAnnual ? 'Save $720 vs monthly' : <>&nbsp;</>}
                    </p>

                    {isCurrent ? (
                      <div className="w-full py-2.5 text-center font-mono text-[11px] font-semibold tracking-[0.06em] uppercase border-[1.5px] border-line-2 text-mist rounded-[10px] mb-5 cursor-default select-none">
                        Your current plan
                      </div>
                    ) : isPendingThis ? (
                      <div className="w-full py-2.5 text-center font-mono text-[11px] font-semibold tracking-[0.06em] uppercase border-[1.5px] border-line text-smoke-3 rounded-[10px] mb-5 cursor-default select-none">
                        Switching on {formatDate(pending?.scheduled_for)}
                      </div>
                    ) : isAction ? (
                      <button
                        onClick={() => handleInitiateChange('enterprise')}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase bg-ink text-white border-[1.5px] border-ink rounded-[10px] shadow-soft-3 hover:bg-smoke-2 transition-all duration-120 mb-5"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        {isPro ? 'Upgrade to Enterprise' : viewAnnual ? 'Switch to Annual' : 'Switch to Monthly'}
                      </button>
                    ) : null}

                    <hr className="border-t border-hairline mb-4" />
                    <p className="font-mono text-[11px] font-semibold tracking-[0.14em] uppercase text-muted mb-3">Includes</p>
                    <ul className="flex flex-col gap-1.5 flex-1">
                      {ENTERPRISE_FEATURES.map(([on, label], i) => (
                        <li key={i} className={`flex items-start gap-2 text-[13.5px] leading-snug ${on ? 'text-body' : 'text-mist'}`}>
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
            <div className="bg-white border-[1.5px] border-ink rounded-[14px] shadow-offset-4 p-8 flex items-start gap-4">
              <div className="w-10 h-10 rounded-[10px] bg-tint border-[1.5px] border-ink flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-ink" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-body mb-1">Covered by {teamWorkspace.name}</p>
                <p className="text-[13px] text-muted leading-relaxed">Your access is included under your team's Enterprise plan. Billing and plan management is handled by the team owner.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white border-[1.5px] border-ink rounded-[14px] shadow-offset-4 p-8 text-center">
              <div className="w-12 h-12 rounded-[10px] bg-tint border-[1.5px] border-ink flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-ink" />
              </div>
              <p className="font-display text-[15px] font-semibold text-body mb-1">No active plan</p>
              <p className="text-[13px] text-muted mb-4">Complete onboarding to subscribe to a plan.</p>
              <a
                href="/onboarding"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-ink hover:bg-smoke-2 text-white text-[13px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 transition-all duration-120"
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
