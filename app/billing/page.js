'use client'
import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { CreditCard, Check, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const labelCls = 'block text-[12px] font-semibold text-[#737370] uppercase tracking-[0.08em] mb-1'
const valueCls = 'text-[14px] font-semibold text-[#1A1816]'

function PlanBadge({ status }) {
  const map = {
    active:   { label: 'Active',   cls: 'bg-[#E4F5EC] text-[#0F6E56] border-[#9FDBB8]' },
    trialing: { label: 'Trialing', cls: 'bg-[#FEF3E2] text-[#B5620A] border-[#F5D9A0]' },
    past_due: { label: 'Past due', cls: 'bg-[#FEF0EF] text-[#D03839] border-[#F5C4C0]' },
    canceled: { label: 'Canceled', cls: 'bg-[#F3F3F0] text-[#737370] border-[#E8E8E4]' },
  }
  const s = map[status] || map.active
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-semibold border ${s.cls}`}>
      {s.label}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function planLabel(type) {
  if (type === 'standard') return 'Pay Per Listing'
  if (type === 'pro') return 'Pro Seller'
  if (type === 'enterprise') return 'Enterprise'
  return type || '—'
}

export default function BillingPage() {
  const [plan, setPlan] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pmLoading, setPmLoading] = useState(false)
  const [error, setError] = useState(null)
  const [seller, setSeller] = useState(null)

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (!userStr) { window.location.href = '/login'; return }
    const user = JSON.parse(userStr)
    setSeller(user)
    loadBilling(user.id)
  }, [])

  const loadBilling = async (sellerId) => {
    setLoading(true)
    setError(null)
    try {
      const { data: planData } = await supabase
        .from('seller_plans')
        .select('*')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      setPlan(planData)

      if (planData?.stripe_customer_id) {
        setPmLoading(true)
        const res = await fetch('/api/billing/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: planData.stripe_customer_id }),
        })
        if (res.ok) {
          const d = await res.json()
          setPaymentMethod(d.default_payment_method || null)
        }
        setPmLoading(false)
      }
    } catch (err) {
      setError('Failed to load billing information.')
    } finally {
      setLoading(false)
    }
  }

  const handleManageBilling = async () => {
    if (!plan?.stripe_customer_id) return
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: plan.stripe_customer_id }),
      })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
    } catch {
      setError('Could not open billing portal.')
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-[20px] font-bold text-[#1A1816] tracking-tight">Billing</h1>
          <p className="text-[13px] text-[#737370] mt-0.5">Manage your plan and payment information.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[13px] text-[#D03839]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Current Plan */}
        <div className="bg-white border border-[#E8E8E4] rounded p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8A8A4] mb-4">Current Plan</p>
          {loading ? (
            <div className="flex items-center gap-2 text-[#737370] text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : plan ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={valueCls + ' text-[16px]'}>{planLabel(plan.plan_type)}</p>
                  <p className="text-[13px] text-[#737370] mt-0.5 capitalize">
                    {plan.plan_type !== 'standard' ? plan.billing_cycle : 'One-time payment'}
                  </p>
                </div>
                <PlanBadge status={plan.status} />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#E8E8E4]">
                {plan.plan_type === 'standard' && (
                  <>
                    <div>
                      <p className={labelCls}>Listings purchased</p>
                      <p className={valueCls}>{plan.quantity || 1}</p>
                    </div>
                    <div>
                      <p className={labelCls}>Listings used</p>
                      <p className={valueCls}>{plan.listings_used_this_period || 0}</p>
                    </div>
                  </>
                )}
                {plan.plan_type !== 'standard' && (
                  <>
                    {plan.status === 'trialing' && plan.trial_ends_at && (
                      <div>
                        <p className={labelCls}>Trial ends</p>
                        <p className={valueCls}>{formatDate(plan.trial_ends_at)}</p>
                      </div>
                    )}
                    <div>
                      <p className={labelCls}>Next renewal</p>
                      <p className={valueCls}>{formatDate(plan.current_period_end)}</p>
                    </div>
                    <div>
                      <p className={labelCls}>Listings this period</p>
                      <p className={valueCls}>{plan.listings_used_this_period || 0} used</p>
                    </div>
                  </>
                )}
              </div>

              {plan.stripe_subscription_id ? (
                <button
                  onClick={handleManageBilling}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-[#D03839] hover:text-[#E0493B] transition-colors mt-1"
                >
                  Manage subscription <ExternalLink className="w-3.5 h-3.5" />
                </button>
              ) : plan.stripe_customer_id && (
                <button
                  onClick={handleManageBilling}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-[#D03839] hover:text-[#E0493B] transition-colors mt-1"
                >
                  View receipt <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[14px] text-[#737370]">No active plan found.</p>
              <a
                href="/onboarding"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors"
              >
                Choose a plan
              </a>
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div className="bg-white border border-[#E8E8E4] rounded p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8A8A4] mb-4">Payment Method</p>
          {pmLoading ? (
            <div className="flex items-center gap-2 text-[#737370] text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : paymentMethod ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-7 bg-[#F3F3F0] border border-[#E8E8E4] rounded flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-[#737370]" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#1A1816] capitalize">
                    {paymentMethod.brand} •••• {paymentMethod.last4}
                  </p>
                  <p className="text-[12px] text-[#737370]">
                    Expires {paymentMethod.exp_month}/{paymentMethod.exp_year}
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#0F6E56] bg-[#E4F5EC] px-2 py-0.5 rounded border border-[#9FDBB8]">
                <Check className="w-3 h-3" /> Default
              </span>
            </div>
          ) : (
            <p className="text-[13px] text-[#737370]">No payment method on file.</p>
          )}

          {plan?.stripe_customer_id && (
            <button
              onClick={handleManageBilling}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 border border-[#D1D1CE] text-[#1A1816] text-[13px] font-semibold rounded hover:bg-[#F3F3F0] transition-colors"
            >
              Update payment method
            </button>
          )}
        </div>

        {/* Billing History */}
        <div className="bg-white border border-[#E8E8E4] rounded p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8A8A4] mb-4">Billing History</p>
          <p className="text-[13px] text-[#737370] mb-3">View your invoices and receipts in the Stripe billing portal.</p>
          {plan?.stripe_customer_id && (
            <button
              onClick={handleManageBilling}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#D03839] hover:text-[#E0493B] transition-colors"
            >
              Open billing portal <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
