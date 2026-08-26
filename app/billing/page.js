'use client'
import { useState, useEffect } from 'react'
import { CreditCard, Check, AlertCircle, Loader2, Receipt, X, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCents } from '@/lib/format'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

// Native card-update form — collects a card via Stripe Elements and saves it
// as the customer's default. No redirect to Stripe's hosted portal.
function CardUpdateForm({ customerId, onSaved, onCancel }) {
  const stripe = useStripe()
  const elements = useElements()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSaving(true); setError(null)
    const { error: submitErr } = await elements.submit()
    if (submitErr) { setError(submitErr.message); setSaving(false); return }
    const result = await stripe.confirmSetup({ elements, redirect: 'if_required' })
    if (result.error) { setError(result.error.message); setSaving(false); return }
    const intent = result.setupIntent
    const pmId = typeof intent?.payment_method === 'string' ? intent.payment_method : intent?.payment_method?.id
    if (!pmId) { setError('Could not read the new card. Please try again.'); setSaving(false); return }
    try {
      const res = await fetch('/api/billing/set-default-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, payment_method_id: pmId }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to save card')
      onSaved(json.payment_method || null)
    } catch (e) {
      setError(e?.message || 'Failed to save card')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <PaymentElement />
      {error && <div className="p-3 bg-tint border-[1.5px] border-ink rounded-[10px] text-[13px] font-semibold text-ink">{error}</div>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} disabled={saving}
          className="flex-1 h-10 text-[13px] font-semibold text-ink bg-white border-[1.5px] border-ink rounded-[10px] shadow-offset-2 hover:bg-tint transition-colors duration-120 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={saving || !stripe}
          className="flex-1 h-10 text-[13px] font-semibold text-white bg-ink hover:bg-smoke-2 border-[1.5px] border-ink rounded-[10px] shadow-soft-3 transition-all duration-120 disabled:opacity-50 flex items-center justify-center gap-1.5">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save card'}
        </button>
      </div>
    </form>
  )
}

const labelCls = 'block font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.08em] mb-1'
const valueCls = 'font-mono text-[14px] font-semibold text-body'

// Status is value-encoded, never hue: active = ink fill, trialing = muted fill,
// past_due = white + ink outline, canceled = line-2 outline.
const pillBase = 'inline-flex items-center px-2.5 py-0.5 rounded-pill font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em]'
function PlanBadge({ status }) {
  const map = {
    active:   { label: 'Active',   cls: 'bg-ink text-white border-[1.5px] border-ink' },
    trialing: { label: 'Trialing', cls: 'bg-muted text-white border-[1.5px] border-muted' },
    past_due: { label: 'Past due', cls: 'bg-white text-ink border-[1.5px] border-ink' },
    canceled: { label: 'Canceled', cls: 'bg-white text-muted border-[1.5px] border-line-2' },
  }
  const s = map[status] || map.active
  return (
    <span className={`${pillBase} ${s.cls}`}>
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
  const [isLifetimeFree, setIsLifetimeFree] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [subDetails, setSubDetails] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [pmLoading, setPmLoading] = useState(false)
  const [error, setError] = useState(null)
  const [teamWorkspace, setTeamWorkspace] = useState(null)
  const [showCardModal, setShowCardModal] = useState(false)
  const [cardClientSecret, setCardClientSecret] = useState(null)
  const [cardModalLoading, setCardModalLoading] = useState(false)

  // Open the native card-update modal: create a SetupIntent, then mount Elements.
  async function openCardModal() {
    if (!plan?.stripe_customer_id) return
    setCardModalLoading(true)
    try {
      const res = await fetch('/api/billing/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: plan.stripe_customer_id }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to start card update')
      setCardClientSecret(json.clientSecret)
      setShowCardModal(true)
    } catch (e) {
      setError(e?.message || 'Could not start card update')
    } finally {
      setCardModalLoading(false)
    }
  }

  function handleCardSaved(newPm) {
    if (newPm) setPaymentMethod(newPm)
    setShowCardModal(false)
    setCardClientSecret(null)
  }

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
      const { data: appRow } = await supabase
        .from('seller_applications')
        .select('admin_notes')
        .eq('id', sellerId)
        .maybeSingle()

      const lifetimeFree = appRow?.admin_notes === 'LIFETIME_FREE'
      setIsLifetimeFree(lifetimeFree)

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

      // "Listings this period" = live count of the seller's active (non-archived)
      // listings — the same source of truth the Plans page uses. The stored
      // seller_plans.listings_used_this_period counter is not recomputed on
      // add/archive, so it would otherwise show a stale number here.
      if (planData) {
        const { count: activeListings } = await supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', sellerId)
          .neq('status', 'archived')
        planData = { ...planData, listings_used_this_period: activeListings ?? 0 }
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
        <h1 className="font-display text-[22px] font-bold text-body tracking-[-0.02em]">Billing</h1>
        <p className="text-[13px] text-muted mt-0.5">Manage your plan and payment information.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-tint border-[1.5px] border-ink rounded-[10px] text-[13px] font-semibold text-ink">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-white border-[1.5px] border-ink rounded-[14px] shadow-offset-4 p-5">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink mb-4">Current Plan</p>
        {loading ? (
          <div className="flex items-center gap-2 text-muted text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : teamWorkspace ? (
          <div className="flex items-start gap-3 p-4 bg-tint rounded-[12px] border-[1.5px] border-line">
            <Check className="w-4 h-4 text-ink shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-semibold text-body">Covered by {teamWorkspace.name}</p>
              <p className="text-[13px] text-muted mt-0.5">Your access is included under your team's Enterprise plan. Billing is managed by the team owner.</p>
            </div>
          </div>
        ) : plan ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-[17px] font-bold text-body tracking-[-0.01em]">{planLabel(plan.plan_type)}</p>
                <p className="font-mono text-[11.5px] text-muted mt-0.5 capitalize">
                  {isLifetimeFree ? 'Lifetime Free' : plan.plan_type !== 'standard' ? plan.billing_cycle : 'One-time payment'}
                </p>
                {isLifetimeFree ? null : subDetails?.has_discount ? (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="font-mono text-[12.5px] text-mist line-through">
                      {formatCents(subDetails.original_amount)}/{subDetails.interval}
                    </span>
                    <span className="font-mono text-[14px] font-bold text-ink">
                      {formatCents(subDetails.discounted_amount)}/{subDetails.interval}
                    </span>
                    {subDetails.coupon_name && (
                      <span className={`${pillBase} bg-white text-ink border-[1.5px] border-ink`}>
                        {subDetails.coupon_name}
                      </span>
                    )}
                  </div>
                ) : subDetails?.original_amount ? (
                  <p className="font-mono text-[13px] font-semibold text-ink mt-1.5">
                    {formatCents(subDetails.original_amount)}/{subDetails.interval}
                  </p>
                ) : null}
              </div>
              <PlanBadge status={plan.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-hairline">
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
                  <div>
                    <p className={labelCls}>Listings this period</p>
                    <p className={valueCls}>{plan.listings_used_this_period || 0} used</p>
                  </div>
                  {!isLifetimeFree && plan.status === 'trialing' && plan.trial_ends_at && (
                    <div>
                      <p className={labelCls}>Trial ends</p>
                      <p className={valueCls}>{formatDate(plan.trial_ends_at)}</p>
                    </div>
                  )}
                  {!isLifetimeFree && (
                    <div>
                      <p className={labelCls}>Next renewal</p>
                      <p className={valueCls}>{formatDate(plan.current_period_end)}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {!isLifetimeFree && !teamWorkspace && plan.plan_type !== 'standard' && ['active','trialing','canceling'].includes(plan.status) && (
              <a href="/settings" className="inline-flex items-center gap-1 mt-3 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted hover:text-ink transition-colors duration-120">
                Manage or cancel subscription →
              </a>
            )}
          </div>
        ) : teamWorkspace ? (
          <div className="flex items-start gap-3 p-4 bg-tint rounded-[12px] border-[1.5px] border-line">
            <Check className="w-4 h-4 text-ink shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-semibold text-body">Covered by {teamWorkspace.name}</p>
              <p className="text-[13px] text-muted mt-0.5">Your access is included under your team's Enterprise plan. Billing is managed by the team owner.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[14px] text-muted">No active plan found.</p>
            <a
              href="/onboarding"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-ink hover:bg-smoke-2 text-white text-[13px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 transition-all duration-120"
            >
              Choose a plan
            </a>
          </div>
        )}
      </div>

      {!teamWorkspace && isLifetimeFree && plan && (
        <div className="flex items-start gap-3 p-4 bg-tint border-[1.5px] border-ink rounded-[12px]">
          <Check className="w-4 h-4 text-ink shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-semibold text-ink">Lifetime Free Account</p>
            <p className="text-[13px] text-muted mt-0.5">This account has complimentary Enterprise access. No payment method or billing history applies.</p>
          </div>
        </div>
      )}

      {!teamWorkspace && !isLifetimeFree && (
        <>
          {/* Payment Method */}
          <div className="bg-white border-[1.5px] border-ink rounded-[14px] shadow-offset-4 p-5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink mb-4">Payment Method</p>
            {pmLoading ? (
              <div className="flex items-center gap-2 text-muted text-[13px]">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : paymentMethod ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 bg-tint border-[1.5px] border-ink rounded-[6px] flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-ink" />
                  </div>
                  <div>
                    <p className="font-mono text-[13.5px] font-semibold text-body capitalize">
                      {paymentMethod.brand} •••• {paymentMethod.last4}
                    </p>
                    <p className="font-mono text-[11px] text-muted">
                      Expires {paymentMethod.exp_month}/{paymentMethod.exp_year}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${pillBase} gap-1 bg-ink text-white border-[1.5px] border-ink`}>
                    <Check className="w-3 h-3" /> Default
                  </span>
                  <button onClick={openCardModal} disabled={cardModalLoading}
                    className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-ink hover:underline disabled:opacity-50">
                    {cardModalLoading ? 'Opening…' : 'Update'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-muted">No payment method on file.</p>
                <button onClick={openCardModal} disabled={cardModalLoading}
                  className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-ink hover:underline disabled:opacity-50">
                  {cardModalLoading ? 'Opening…' : 'Add card'}
                </button>
              </div>
            )}
          </div>

          {/* Billing History */}
          <div className="bg-white border-[1.5px] border-ink rounded-[14px] shadow-offset-4 p-5 overflow-hidden">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink mb-4">Billing History</p>
            {pmLoading ? (
              <div className="flex items-center gap-2 text-muted text-[13px]">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex items-center gap-2 py-2">
                <Receipt className="w-4 h-4 text-mist" />
                <p className="text-[13px] text-muted">No billing history yet.</p>
              </div>
            ) : (
              <div className="-mx-5 -mb-5">
                {invoices.map((inv, i) => (
                  <div
                    key={inv.id}
                    className={`flex items-center justify-between px-5 py-3.5 ${i !== invoices.length - 1 ? 'border-b border-hairline' : ''} hover:bg-tint transition-colors duration-120`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-[8px] bg-tint border-[1.5px] border-line flex items-center justify-center flex-shrink-0">
                        <Receipt className="w-4 h-4 text-muted" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-body truncate">{inv.description}</p>
                        <p className="font-mono text-[11px] text-muted mt-0.5">{formatDate(inv.created * 1000)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <div className="text-right">
                        {inv.discount_amount > 0 && (
                          <p className="font-mono text-[11px] text-mist line-through">{formatCents(inv.subtotal, { cents: 'always' })}</p>
                        )}
                        <p className="font-mono text-[13px] font-bold text-ink">{formatCents(inv.amount_paid || inv.amount_due, { cents: 'always' })}</p>
                        {inv.discount_amount > 0 && (
                          <p className="font-mono text-[11px] font-semibold text-ink">−{formatCents(inv.discount_amount, { cents: 'always' })} discount</p>
                        )}
                      </div>
                      <span className={`${pillBase} ${
                        inv.status === 'paid' ? 'bg-ink text-white border-[1.5px] border-ink' : 'bg-white text-muted border-[1.5px] border-line-2'
                      }`}>
                        {inv.status === 'paid' ? 'Paid' : inv.status}
                      </span>
                      {(inv.invoice_pdf || inv.hosted_invoice_url) && (
                        <a href={inv.invoice_pdf || inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer"
                          title="Download invoice"
                          className="w-7 h-7 flex items-center justify-center rounded-[8px] border-[1.5px] border-line text-mist hover:text-ink hover:border-ink transition-colors duration-120">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showCardModal && cardClientSecret && stripePromise && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-body/40" onClick={() => { setShowCardModal(false); setCardClientSecret(null); }} aria-hidden="true" />
          <div className="relative bg-white border-[1.5px] border-ink rounded-[14px] shadow-offset-6 max-w-md w-full p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-[16.5px] font-semibold tracking-[-0.01em] text-body">Update payment method</h3>
              <button onClick={() => { setShowCardModal(false); setCardClientSecret(null); }} className="p-1.5 rounded-[8px] hover:bg-tint text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[13px] text-muted mb-4">Enter your new card details below. It becomes the default for future charges.</p>
            <Elements stripe={stripePromise} options={{
              clientSecret: cardClientSecret,
              appearance: {
                variables: {
                  borderRadius: '4px',
                  colorPrimary: '#111111',
                  colorText: '#171717',
                  colorDanger: '#111111',
                  fontFamily: 'DM Sans, -apple-system, sans-serif',
                  fontSizeBase: '14px',
                },
              },
            }}>
              <CardUpdateForm
                customerId={plan?.stripe_customer_id}
                onSaved={handleCardSaved}
                onCancel={() => { setShowCardModal(false); setCardClientSecret(null); }}
              />
            </Elements>
          </div>
        </div>
      )}

    </div>
  )
}
