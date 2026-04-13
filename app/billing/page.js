'use client'
import { useState, useEffect } from 'react'
import {
  CreditCard, Check, AlertCircle, Loader2, ExternalLink,
  RefreshCw, FileText, Zap, Building2, Download,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatAmount(cents, currency = 'usd') {
  if (!cents && cents !== 0) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}

function planLabel(type) {
  if (type === 'pro') return 'Pro Seller'
  if (type === 'enterprise') return 'Enterprise'
  return type || '—'
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    active:   { label: 'Active',   cls: 'bg-[#E4F5EC] text-[#0F6E56] border-[#9FDBB8]' },
    trialing: { label: 'Trial',    cls: 'bg-[#FEF3E2] text-[#B5620A] border-[#F5D9A0]' },
    past_due: { label: 'Past due', cls: 'bg-[#FEF0EF] text-[#D03839] border-[#F5C4C0]' },
    canceled: { label: 'Canceled', cls: 'bg-[#F3F3F0] text-[#737370] border-[#E8E8E4]'  },
    paid:     { label: 'Paid',     cls: 'bg-[#E4F5EC] text-[#0F6E56] border-[#9FDBB8]' },
    open:     { label: 'Open',     cls: 'bg-[#FEF3E2] text-[#B5620A] border-[#F5D9A0]' },
    void:     { label: 'Void',     cls: 'bg-[#F3F3F0] text-[#737370] border-[#E8E8E4]'  },
  }
  const s = map[status] || { label: status || '—', cls: 'bg-[#F3F3F0] text-[#737370] border-[#E8E8E4]' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ─── Card brand chip ──────────────────────────────────────────────────────────
function CardBrand({ brand }) {
  const label = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Card'
  return (
    <span className="inline-flex items-center justify-center w-10 h-7 bg-[#1A1816] text-white text-[9px] font-bold rounded tracking-wider uppercase">
      {label.slice(0, 4)}
    </span>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, children, action }) {
  return (
    <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E4]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8A8A4]">{title}</p>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const [plan,          setPlan]          = useState(null)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [invoices,      setInvoices]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [pmLoading,     setPmLoading]     = useState(false)
  const [invLoading,    setInvLoading]    = useState(false)
  const [error,         setError]         = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (!userStr) { window.location.href = '/login'; return }
    const user = JSON.parse(userStr)
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
        // Payment method
        setPmLoading(true)
        fetch('/api/billing/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: planData.stripe_customer_id }),
        })
          .then(r => r.json())
          .then(d => setPaymentMethod(d.default_payment_method || null))
          .finally(() => setPmLoading(false))

        // Invoices
        setInvLoading(true)
        fetch('/api/billing/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: planData.stripe_customer_id }),
        })
          .then(r => r.json())
          .then(d => setInvoices(d.invoices || []))
          .finally(() => setInvLoading(false))
      }
    } catch {
      setError('Failed to load billing information.')
    } finally {
      setLoading(false)
    }
  }

  const openPortal = async () => {
    if (!plan?.stripe_customer_id) return
    setPortalLoading(true)
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
    } finally {
      setPortalLoading(false)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isPro        = plan?.plan_type === 'pro'
  const isEnterprise = plan?.plan_type === 'enterprise'
  const isTrialing   = plan?.status === 'trialing'
  const planIcon     = isEnterprise ? <Building2 className="w-5 h-5" /> : <Zap className="w-5 h-5" />

  return (
    <div className="space-y-5">

        {/* Page header */}
        <div>
          <h1 className="text-[20px] font-bold text-[#1A1816] tracking-tight">Billing</h1>
          <p className="text-[13px] text-[#737370] mt-0.5">Manage your plan and payment details.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[13px] text-[#D03839]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* ── Plan + Payment Method side by side ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Current Plan ─────────────────────────────────────────────── */}
        <Section
          title="Current Plan"
          action={
            plan?.stripe_subscription_id && (
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-[#D03839] hover:text-[#E0493B] transition-colors disabled:opacity-50"
              >
                {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                Manage
              </button>
            )
          }
        >
          {loading ? (
            <div className="flex items-center gap-2 text-[#737370] text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : plan ? (
            <div className="space-y-5">
              {/* Plan name + status */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${isEnterprise ? 'bg-[#1A1816] text-white' : 'bg-[#FEF0EF] text-[#D03839]'}`}>
                    {planIcon}
                  </div>
                  <div>
                    <p className="text-[17px] font-bold text-[#1A1816] leading-tight">{planLabel(plan.plan_type)}</p>
                    <p className="text-[12px] text-[#737370] mt-0.5 capitalize">
                      {plan.billing_cycle === 'annual' ? 'Annual billing' : plan.billing_cycle === 'monthly' ? 'Monthly billing' : plan.billing_cycle}
                    </p>
                  </div>
                </div>
                <StatusBadge status={plan.status} />
              </div>

              {/* Key dates */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-[#E8E8E4]">
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
                {plan.current_period_start && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A8A8A4] mb-1">Period started</p>
                    <p className="text-[14px] font-semibold text-[#1A1816]">{formatDate(plan.current_period_start)}</p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A8A8A4] mb-1">Listings used</p>
                  <p className="text-[14px] font-semibold text-[#1A1816]">
                    {plan.listings_used_this_period ?? 0}
                    {isPro ? ' / 10' : isEnterprise ? ' / ∞' : ''}
                  </p>
                </div>
              </div>

              {/* Usage bar for Pro */}
              {isPro && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A8A8A4]">Monthly listings</p>
                    <p className="text-[11px] text-[#737370]">{plan.listings_used_this_period ?? 0} of 10 used</p>
                  </div>
                  <div className="h-2 bg-[#F3F3F0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#D03839] rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((plan.listings_used_this_period ?? 0) / 10) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-[#FAFAF8] border border-[#E8E8E4] rounded">
                <div className="w-10 h-10 rounded bg-[#F3F3F0] flex items-center justify-center text-[#A8A8A4]">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#1A1816]">No active plan</p>
                  <p className="text-[12px] text-[#737370]">Choose a plan to start listing wholesale deals.</p>
                </div>
              </div>
              <a
                href="/onboarding"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors"
              >
                Choose a plan
              </a>
            </div>
          )}
        </Section>

        {/* ── Payment Method ───────────────────────────────────────────── */}
        <Section
          title="Payment Method"
          action={
            plan?.stripe_customer_id && (
              <button
                onClick={openPortal}
                className="text-[12px] font-semibold text-[#737370] hover:text-[#1A1816] transition-colors"
              >
                Update
              </button>
            )
          }
        >
          {pmLoading ? (
            <div className="flex items-center gap-2 text-[#737370] text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : paymentMethod ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardBrand brand={paymentMethod.brand} />
                <div>
                  <p className="text-[14px] font-semibold text-[#1A1816] capitalize">
                    {paymentMethod.brand} •••• {paymentMethod.last4}
                  </p>
                  <p className="text-[12px] text-[#737370]">
                    Expires {String(paymentMethod.exp_month).padStart(2, '0')} / {paymentMethod.exp_year}
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#0F6E56] bg-[#E4F5EC] px-2 py-0.5 rounded border border-[#9FDBB8]">
                <Check className="w-3 h-3" /> Default
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-7 bg-[#F3F3F0] border border-[#E8E8E4] rounded flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-[#A8A8A4]" />
                </div>
                <p className="text-[13px] text-[#737370]">No payment method on file.</p>
              </div>
              {plan?.stripe_customer_id && (
                <button
                  onClick={openPortal}
                  className="text-[12px] font-semibold text-[#D03839] hover:text-[#E0493B] transition-colors"
                >
                  Add card
                </button>
              )}
            </div>
          )}
        </Section>

        </div>{/* end grid */}

        {/* ── Billing History ──────────────────────────────────────────── */}
        <Section title="Billing History">
          {invLoading ? (
            <div className="flex items-center gap-2 text-[#737370] text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : invoices.length > 0 ? (
            <div className="space-y-0 -mx-5 -mb-5">
              {invoices.map((inv, i) => (
                <div
                  key={inv.id}
                  className={`flex items-center justify-between px-5 py-3.5 ${i !== invoices.length - 1 ? 'border-b border-[#F3F3F0]' : ''} hover:bg-[#FAFAF8] transition-colors`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded bg-[#F3F3F0] flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-[#737370]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#1A1816] truncate">
                        {inv.number || inv.id}
                      </p>
                      <p className="text-[11px] text-[#A8A8A4]">{formatDate(new Date(inv.created * 1000).toISOString())}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <p className="text-[13px] font-semibold text-[#1A1816]">
                      {formatAmount(inv.amount_paid || inv.amount_due, inv.currency)}
                    </p>
                    <StatusBadge status={inv.status} />
                    {(inv.invoice_pdf || inv.hosted_invoice_url) && (
                      <a
                        href={inv.invoice_pdf || inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#737370] hover:text-[#1A1816] transition-colors"
                        title="Download invoice"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {plan?.stripe_customer_id && (
                <div className="px-5 py-3 border-t border-[#E8E8E4]">
                  <button
                    onClick={openPortal}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-[#D03839] hover:text-[#E0493B] transition-colors"
                  >
                    View all in billing portal <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 gap-2 text-center">
              <div className="w-10 h-10 rounded bg-[#F3F3F0] flex items-center justify-center mb-1">
                <FileText className="w-5 h-5 text-[#A8A8A4]" />
              </div>
              <p className="text-[13px] font-semibold text-[#1A1816]">No invoices yet</p>
              <p className="text-[12px] text-[#737370]">
                {plan ? 'Your invoices will appear here once billing begins.' : 'Invoices will appear here after you subscribe.'}
              </p>
              {plan?.stripe_customer_id && (
                <button
                  onClick={openPortal}
                  className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#D03839] hover:text-[#E0493B] transition-colors"
                >
                  Open billing portal <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </Section>

    </div>
  )
}
