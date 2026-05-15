'use client'
import { useState, useEffect } from 'react'
import { CreditCard, Check, AlertCircle, Loader2, Receipt } from 'lucide-react'
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
  const [subDetails, setSubDetails] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [pmLoading, setPmLoading] = useState(false)
  const [error, setError] = useState(null)
  const [teamWorkspace, setTeamWorkspace] = useState(null)

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (!userStr) { window.location.href = '/login'; return }
    const user = JSON.parse(userStr)
    fetch('/api/team/workspaces', { headers: { Authorization: `Bearer ${user.id}` } })
      .then(r => r.json())
      .then(ws => {
        if (ws?.current?.id) {
          setTeamWorkspace(ws.current)
          setLoading(false)
        } else {
          loadBilling(user.id)
        }
      })
      .catch(() => loadBilling(user.id))
  }, [])

  const loadBilling = async (sellerId) => {
    setLoading(true)
    setError(null)
    try {
      let { data: planData } = await supabase
        .from('seller_plans')
        .select('*')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Self-heal: if no plan row, sync from Stripe
      if (!planData) {
        const syncRes = await fetch('/api/billing/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seller_id: sellerId }),
        })
        const syncData = await syncRes.json()
        if (syncData.synced) {
          const { data: refreshed } = await supabase
            .from('seller_plans')
            .select('*')
            .eq('seller_id', sellerId)
            .maybeSingle()
          planData = refreshed
        }
      }

      setPlan(planData)

      if (planData?.stripe_subscription_id) {
        const detRes = await fetch('/api/billing/subscription-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription_id: planData.stripe_subscription_id }),
        })
        if (detRes.ok) setSubDetails(await detRes.json())
      }

      if (planData?.stripe_customer_id) {
        setPmLoading(true)
        const [pmRes, invRes] = await Promise.all([
          fetch('/api/billing/payment-methods', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer_id: planData.stripe_customer_id }),
          }),
          fetch('/api/billing/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer_id: planData.stripe_customer_id }),
          }),
        ])
        if (pmRes.ok) {
          const d = await pmRes.json()
          setPaymentMethod(d.default_payment_method || null)
        }
        if (invRes.ok) {
          const d = await invRes.json()
          setInvoices(d.invoices || [])
        }
        setPmLoading(false)
      }
    } catch {
      setError('Failed to load billing information.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
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
        ) : teamWorkspace ? (
          <div className="flex items-start gap-3 p-4 bg-[#F3F3F0] rounded border border-[#E8E8E4]">
            <Check className="w-4 h-4 text-[#0F6E56] shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-semibold text-[#1A1816]">Covered by {teamWorkspace.name}</p>
              <p className="text-[13px] text-[#737370] mt-0.5">Your access is included under your team's Enterprise plan. Billing is managed by the team owner.</p>
            </div>
          </div>
        ) : plan ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={valueCls + ' text-[16px]'}>{planLabel(plan.plan_type)}</p>
                <p className="text-[13px] text-[#737370] mt-0.5 capitalize">
                  {plan.plan_type !== 'standard' ? plan.billing_cycle : 'One-time payment'}
                </p>
                {subDetails?.has_discount ? (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[13px] text-[#A8A8A4] line-through">
                      ${(subDetails.original_amount / 100).toFixed(2)}/{subDetails.interval}
                    </span>
                    <span className="text-[14px] font-bold text-[#1A1816]">
                      ${(subDetails.discounted_amount / 100).toFixed(2)}/{subDetails.interval}
                    </span>
                    {subDetails.coupon_name && (
                      <span className="text-[11px] font-semibold bg-[#E4F5EC] text-[#0F6E56] border border-[#B6E4CE] px-2 py-0.5 rounded-full">
                        {subDetails.coupon_name}
                      </span>
                    )}
                  </div>
                ) : subDetails?.original_amount ? (
                  <p className="text-[13px] font-semibold text-[#1A1816] mt-1.5">
                    ${(subDetails.original_amount / 100).toFixed(2)}/{subDetails.interval}
                  </p>
                ) : null}
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

          </div>
        ) : teamWorkspace ? (
          <div className="flex items-start gap-3 p-4 bg-[#F3F3F0] rounded border border-[#E8E8E4]">
            <Check className="w-4 h-4 text-[#0F6E56] shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-semibold text-[#1A1816]">Covered by {teamWorkspace.name}</p>
              <p className="text-[13px] text-[#737370] mt-0.5">Your access is included under your team's Enterprise plan. Billing is managed by the team owner.</p>
            </div>
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

      {!teamWorkspace && (
        <>
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
          </div>

          {/* Billing History */}
          <div className="bg-white border border-[#E8E8E4] rounded p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8A8A4] mb-4">Billing History</p>
            {pmLoading ? (
              <div className="flex items-center gap-2 text-[#737370] text-[13px]">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex items-center gap-2 py-2">
                <Receipt className="w-4 h-4 text-[#A8A8A4]" />
                <p className="text-[13px] text-[#737370]">No billing history yet.</p>
              </div>
            ) : (
              <div className="-mx-5 -mb-5">
                {invoices.map((inv, i) => (
                  <div
                    key={inv.id}
                    className={`flex items-center justify-between px-5 py-3.5 ${i !== invoices.length - 1 ? 'border-b border-[#F3F3F0]' : ''} hover:bg-[#FAFAF8] transition-colors`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-[#F3F3F0] flex items-center justify-center flex-shrink-0">
                        <Receipt className="w-4 h-4 text-[#737370]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#1A1816] truncate">{inv.description}</p>
                        <p className="text-[11px] text-[#A8A8A4] mt-0.5">{formatDate(inv.created * 1000)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <div className="text-right">
                        {inv.discount_amount > 0 && (
                          <p className="text-[11px] text-[#A8A8A4] line-through">${(inv.subtotal / 100).toFixed(2)}</p>
                        )}
                        <p className="text-[13px] font-bold text-[#1A1816]">${((inv.amount_paid || inv.amount_due) / 100).toFixed(2)}</p>
                        {inv.discount_amount > 0 && (
                          <p className="text-[11px] text-[#0F6E56] font-medium">−${(inv.discount_amount / 100).toFixed(2)} discount</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        inv.status === 'paid' ? 'bg-[#E4F5EC] text-[#0F6E56] border-[#9FDBB8]' : 'bg-[#F3F3F0] text-[#737370] border-[#E8E8E4]'
                      }`}>
                        {inv.status === 'paid' ? 'Paid' : inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

    </div>
  )
}
