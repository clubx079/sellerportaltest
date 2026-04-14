'use client'
import { useState, useEffect } from 'react'
import { Check, Loader2, AlertCircle, Zap, Building2, ArrowUp, ArrowDown, Calendar } from 'lucide-react'

const PLANS = [
  {
    id: 'pro',
    name: 'Pro Seller',
    icon: Zap,
    monthlyPrice: 99,
    annualPrice: 79,
    annualTotal: 948,
    features: [
      '10 listings per month',
      'Verified seller badge',
      'Analytics dashboard',
      'Email support',
      'Add-on listings available',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: Building2,
    monthlyPrice: 299,
    annualPrice: 239,
    annualTotal: 2868,
    features: [
      'Unlimited listings',
      'Verified seller badge',
      'Advanced analytics',
      'Priority support',
      'Add-on listings available',
      'Dedicated account manager',
    ],
  },
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function PlansPage() {
  const [sellerId, setSellerId]   = useState(null)
  const [plan, setPlan]           = useState(null)
  const [pending, setPending]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [changing, setChanging]   = useState(null) // plan id being changed to
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(null)

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setSellerId(user.id)
    }
  }, [])

  useEffect(() => {
    if (!sellerId) return
    loadPlanInfo()
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

  const handleChangePlan = async (newPlanType) => {
    setChanging(newPlanType)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/seller/plan/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: sellerId, new_plan_type: newPlanType }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to schedule plan change.')
        return
      }
      setPending({ plan_type: newPlanType, scheduled_for: data.scheduled_for })
      const label = newPlanType === 'enterprise' ? 'Enterprise' : 'Pro Seller'
      setSuccess(`Your plan will change to ${label} on ${formatDate(data.scheduled_for)}.`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setChanging(null)
    }
  }

  const currentPlanType = plan?.plan_type
  const billingCycle = plan?.billing_cycle || 'monthly'
  const isAnnual = billingCycle === 'annual'

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#737370]" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-lg md:text-xl font-semibold tracking-tight text-[#1A1816]">Plans</h1>
        <p className="text-[13px] text-[#737370] mt-0.5">Manage your subscription plan.</p>
      </div>

      {/* Error / Success */}
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

      {/* Pending change notice */}
      {pending && !success && (
        <div className="flex items-start gap-3 p-3 bg-[#FEF3E2] border border-[#F3C97D] rounded text-[#B5620A]">
          <Calendar className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-[13px] font-medium">
            Your plan is scheduled to change to <span className="font-bold">{pending.plan_type === 'enterprise' ? 'Enterprise' : 'Pro Seller'}</span> on {formatDate(pending.scheduled_for)}.
          </p>
        </div>
      )}

      {/* Billing cycle notice */}
      {plan && (
        <p className="text-[12px] text-[#737370]">
          You&apos;re on a <span className="font-semibold text-[#1A1816]">{isAnnual ? 'annual' : 'monthly'}</span> billing cycle.
          {plan.current_period_end && (
            <> Your current period ends on <span className="font-semibold text-[#1A1816]">{formatDate(plan.current_period_end)}</span>. Any plan change will take effect on that date.</>
          )}
        </p>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLANS.map((p) => {
          const isCurrent = currentPlanType === p.id
          const isPending = pending?.plan_type === p.id
          const price = isAnnual ? p.annualPrice : p.monthlyPrice
          const Icon = p.icon
          const isUpgrade = p.id === 'enterprise' && currentPlanType === 'pro'
          const isDowngrade = p.id === 'pro' && currentPlanType === 'enterprise'

          return (
            <div
              key={p.id}
              className={`bg-white rounded border-2 p-5 flex flex-col gap-4 transition-all ${
                isCurrent
                  ? 'border-[#1A1816]'
                  : isPending
                  ? 'border-[#D03839]'
                  : 'border-[#E8E8E4]'
              }`}
            >
              {/* Plan header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded flex items-center justify-center ${
                    isCurrent ? 'bg-[#1A1816]' : isPending ? 'bg-[#FEF0EF]' : 'bg-[#F3F3F0]'
                  }`}>
                    <Icon className={`w-4.5 h-4.5 ${
                      isCurrent ? 'text-white' : isPending ? 'text-[#D03839]' : 'text-[#737370]'
                    }`} size={18} />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[#1A1816]">{p.name}</p>
                    <p className="text-[12px] text-[#737370]">
                      ${price}<span className="text-[11px]">/mo{isAnnual ? ' · billed annually' : ''}</span>
                    </p>
                  </div>
                </div>
                {isCurrent && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#1A1816] text-white border border-[#1A1816] whitespace-nowrap">
                    Current Plan
                  </span>
                )}
                {isPending && !isCurrent && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEF0EF] text-[#D03839] border border-[#F5C4C0] whitespace-nowrap">
                    Scheduled
                  </span>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#0F6E56] flex-shrink-0" />
                    <span className="text-[13px] text-[#737370]">{f}</span>
                  </li>
                ))}
              </ul>

              {/* Action button */}
              {!isCurrent && !isPending && (isUpgrade || isDowngrade) && (
                <button
                  onClick={() => handleChangePlan(p.id)}
                  disabled={!!changing}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isUpgrade
                      ? 'bg-[#D03839] hover:bg-[#B82F30] text-white'
                      : 'bg-[#F3F3F0] hover:bg-[#E8E8E4] text-[#1A1816]'
                  }`}
                >
                  {changing === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isUpgrade ? (
                    <><ArrowUp className="w-3.5 h-3.5" /> Upgrade to Enterprise</>
                  ) : (
                    <><ArrowDown className="w-3.5 h-3.5" /> Downgrade to Pro</>
                  )}
                </button>
              )}

              {isCurrent && (
                <div className="py-2 text-center text-[12px] text-[#A8A8A4] font-medium">
                  Your current plan
                </div>
              )}

              {isPending && !isCurrent && (
                <div className="py-2 text-center text-[12px] text-[#D03839] font-medium">
                  Taking effect {formatDate(pending.scheduled_for)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* No plan state */}
      {!plan && !loading && (
        <div className="bg-white border border-[#E8E8E4] rounded p-8 text-center">
          <p className="text-[14px] font-semibold text-[#1A1816] mb-1">No active plan</p>
          <p className="text-[13px] text-[#737370]">Complete onboarding to subscribe to a plan.</p>
        </div>
      )}
    </div>
  )
}
