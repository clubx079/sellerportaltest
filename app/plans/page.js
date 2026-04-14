'use client'
import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, Check, Calendar } from 'lucide-react'

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

export default function PlansPage() {
  const [sellerId, setSellerId] = useState(null)
  const [plan,     setPlan]     = useState(null)
  const [pending,  setPending]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [changing, setChanging] = useState(null)
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(null)

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
  const isAnnual = plan?.billing_cycle === 'annual'

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#737370]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-lg md:text-xl font-semibold tracking-tight text-[#1A1816]">Plans</h1>
        <p className="text-[13px] text-[#737370] mt-0.5">Upgrade or downgrade your subscription.</p>
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
      {pending && !success && (
        <div className="flex items-start gap-3 p-3 bg-[#FEF3E2] border border-[#F3C97D] rounded text-[#B5620A]">
          <Calendar className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-[13px] font-medium">
            Scheduled change to <strong>{pending.plan_type === 'enterprise' ? 'Enterprise' : 'Pro Seller'}</strong> on {formatDate(pending.scheduled_for)}.
          </p>
        </div>
      )}

      {/* Billing cycle info */}
      {plan && (
        <p className="text-[12px] text-[#737370]">
          You&apos;re on a <span className="font-semibold text-[#1A1816]">{isAnnual ? 'annual' : 'monthly'}</span> billing cycle.
          {plan.current_period_end && (
            <> Current period ends <span className="font-semibold text-[#1A1816]">{formatDate(plan.current_period_end)}</span>. Plan changes take effect on that date.</>
          )}
        </p>
      )}

      {/* Plan cards — centered */}
      <div className="flex justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">

          {/* Pro Seller */}
          {(() => {
            const isCurrent = currentPlanType === 'pro'
            const isPending = pending?.plan_type === 'pro'
            const isUpgrade = false
            const isDowngrade = currentPlanType === 'enterprise'

            return (
              <div className={`bg-white rounded p-5 flex flex-col border-2 transition-all ${
                isCurrent ? 'border-[#D03839]' : isPending ? 'border-[#D03839] opacity-80' : 'border-[#E8E8E4]'
              }`}>
                {/* Badge row */}
                <div className="min-h-[24px] mb-2.5">
                  {isCurrent ? (
                    <span className="inline-block text-[11px] font-semibold bg-[#FEF0EF] text-[#D03839] px-2.5 py-0.5 rounded">
                      Current plan
                    </span>
                  ) : isPending ? (
                    <span className="inline-block text-[11px] font-semibold bg-[#FEF3E2] text-[#B5620A] px-2.5 py-0.5 rounded">
                      Scheduled
                    </span>
                  ) : (
                    <span className="inline-block text-[11px] font-semibold bg-[#F3F3F0] text-[#A8A8A4] px-2.5 py-0.5 rounded">
                      Most popular
                    </span>
                  )}
                </div>

                <p className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[#A8A8A4] mb-1">Subscription</p>
                <h2 className="text-2xl font-bold text-[#1A1816] tracking-tight mb-1">Pro Seller</h2>
                <p className="text-xs text-[#737370] leading-relaxed mb-4 min-h-[2.4rem]">
                  For active investors and wholesalers moving deals consistently.
                </p>

                {/* Price */}
                <div className="text-[38px] font-bold text-[#1A1816] leading-none tracking-tight mb-1">
                  <sup className="text-lg font-normal align-super">$</sup>
                  {isAnnual ? '948' : '99'}
                </div>
                <p className="text-xs text-[#737370] mb-1">
                  {isAnnual ? 'per year · billed annually' : 'per month'} · 10 listings included
                </p>
                <p className="text-[11px] text-[#A8A8A4] mb-5 min-h-[1rem]">
                  {isAnnual ? 'Save $240 vs monthly · $79/mo' : '$19 per additional listing'}
                </p>

                {/* CTA */}
                {isCurrent ? (
                  <div className="w-full py-2.5 text-center text-xs font-semibold tracking-[0.05em] uppercase border border-[#E8E8E4] text-[#A8A8A4] rounded mb-5 cursor-default">
                    Current plan
                  </div>
                ) : isPending ? (
                  <div className="w-full py-2.5 text-center text-xs font-semibold tracking-[0.05em] uppercase border border-[#F3C97D] text-[#B5620A] rounded mb-5 cursor-default">
                    Taking effect {formatDate(pending.scheduled_for)}
                  </div>
                ) : isDowngrade ? (
                  <button
                    onClick={() => handleChangePlan('pro')}
                    disabled={!!changing}
                    className="w-full py-2.5 text-center text-xs font-semibold tracking-[0.05em] uppercase border border-[#D4D4CF] text-[#1A1816] rounded hover:bg-[#F3F3F0] transition-colors mb-5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changing === 'pro' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Downgrade to Pro'}
                  </button>
                ) : null}

                <hr className="border-t border-[#E8E8E4] mb-4" />
                <p className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[#A8A8A4] mb-2.5">Includes</p>
                <ul className="flex flex-col gap-1.5 flex-1">
                  {PRO_FEATURES.map(([on, label], i) => (
                    <li key={i} className={`flex items-start gap-2 text-xs leading-snug ${on ? 'text-[#1A1816]' : 'text-[#A8A8A4]'}`}>
                      <CheckIcon filled={on} />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}

          {/* Enterprise */}
          {(() => {
            const isCurrent = currentPlanType === 'enterprise'
            const isPending = pending?.plan_type === 'enterprise'
            const isUpgrade = currentPlanType === 'pro'

            return (
              <div className={`bg-white rounded p-5 flex flex-col border-2 transition-all ${
                isCurrent ? 'border-[#1A1816]' : isPending ? 'border-[#D03839] opacity-80' : 'border-[#E8E8E4]'
              }`}>
                {/* Badge row */}
                <div className="min-h-[24px] mb-2.5">
                  {isCurrent ? (
                    <span className="inline-block text-[11px] font-semibold bg-[#1A1816] text-white px-2.5 py-0.5 rounded">
                      Current plan
                    </span>
                  ) : isPending ? (
                    <span className="inline-block text-[11px] font-semibold bg-[#FEF3E2] text-[#B5620A] px-2.5 py-0.5 rounded">
                      Scheduled
                    </span>
                  ) : (
                    <div className="min-h-[24px]" />
                  )}
                </div>

                <p className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[#A8A8A4] mb-1">Subscription</p>
                <h2 className="text-2xl font-bold text-[#1A1816] tracking-tight mb-1">Enterprise</h2>
                <p className="text-xs text-[#737370] leading-relaxed mb-4 min-h-[2.4rem]">
                  For acquisition teams running high-volume pipelines.
                </p>

                {/* Price */}
                <div className="text-[38px] font-bold text-[#1A1816] leading-none tracking-tight mb-1">
                  <sup className="text-lg font-normal align-super">$</sup>
                  {isAnnual ? '2,868' : '299'}
                </div>
                <p className="text-xs text-[#737370] mb-1">
                  {isAnnual ? 'per year · billed annually' : 'per month'} · unlimited listings
                </p>
                <p className="text-[11px] text-[#A8A8A4] mb-5 min-h-[1rem]">
                  {isAnnual ? 'Save $720 vs monthly · $239/mo' : <>&nbsp;</>}
                </p>

                {/* CTA */}
                {isCurrent ? (
                  <div className="w-full py-2.5 text-center text-xs font-semibold tracking-[0.05em] uppercase border border-[#E8E8E4] text-[#A8A8A4] rounded mb-5 cursor-default">
                    Current plan
                  </div>
                ) : isPending ? (
                  <div className="w-full py-2.5 text-center text-xs font-semibold tracking-[0.05em] uppercase border border-[#F3C97D] text-[#B5620A] rounded mb-5 cursor-default">
                    Taking effect {formatDate(pending.scheduled_for)}
                  </div>
                ) : isUpgrade ? (
                  <button
                    onClick={() => handleChangePlan('enterprise')}
                    disabled={!!changing}
                    className="w-full py-2.5 text-center text-xs font-semibold tracking-[0.05em] uppercase bg-[#D03839] text-white rounded hover:bg-[#B82F30] transition-colors mb-5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changing === 'enterprise' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Upgrade to Enterprise'}
                  </button>
                ) : null}

                <hr className="border-t border-[#E8E8E4] mb-4" />
                <p className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[#A8A8A4] mb-2.5">Includes</p>
                <ul className="flex flex-col gap-1.5 flex-1">
                  {ENTERPRISE_FEATURES.map(([on, label], i) => (
                    <li key={i} className={`flex items-start gap-2 text-xs leading-snug ${on ? 'text-[#1A1816]' : 'text-[#A8A8A4]'}`}>
                      <CheckIcon filled={on} />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}

        </div>
      </div>

      {/* No plan */}
      {!plan && (
        <div className="max-w-2xl mx-auto bg-white border border-[#E8E8E4] rounded p-8 text-center">
          <p className="text-[14px] font-semibold text-[#1A1816] mb-1">No active plan</p>
          <p className="text-[13px] text-[#737370]">Complete onboarding to subscribe to a plan.</p>
        </div>
      )}

    </div>
  )
}
