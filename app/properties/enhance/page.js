'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Star, TrendingUp, Zap, Package, Check, Loader2, Sparkles, CalendarDays } from 'lucide-react'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

const ACTIVE_ENHANCEMENT_META = {
  highlight: { label: 'Highlight Listing',    icon: Sparkles,   totalDays: 30, color: '#111111', bg: '#f2f2f2', border: '#111111' },
  boost:     { label: 'Boost Listing',        icon: Zap,        totalDays: 7,  color: '#111111', bg: '#f2f2f2', border: '#111111' },
  homepage:  { label: 'Featured on Homepage', icon: TrendingUp, totalDays: 7,  color: '#111111', bg: '#f2f2f2', border: '#111111' },
}

function getActiveEnhancements(property) {
  const now = new Date()
  const entries = []
  if (property.is_highlighted && property.highlight_ends_at && new Date(property.highlight_ends_at) > now)
    entries.push({ id: 'highlight', endsAt: property.highlight_ends_at })
  if (property.is_boosted && property.boost_ends_at && new Date(property.boost_ends_at) > now)
    entries.push({ id: 'boost', endsAt: property.boost_ends_at })
  if (property.is_homepage_featured && property.homepage_feature_ends_at && new Date(property.homepage_feature_ends_at) > now)
    entries.push({ id: 'homepage', endsAt: property.homepage_feature_ends_at })
  return entries
}

function daysRemaining(endsAt) {
  return Math.max(0, Math.ceil((new Date(endsAt) - new Date()) / (1000 * 60 * 60 * 24)))
}

function formatExpiry(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const ADD_ONS = [
  { id: 'highlight', label: 'Highlight Listing',        desc: 'Ink-bordered card in search results.',                                        price: 999,  duration: '30 Days', icon: Star },
  { id: 'boost',     label: 'Boost Listing',             desc: 'Top of search results.',                                                     price: 1499, duration: '7 Days',  icon: TrendingUp },
  { id: 'homepage',  label: 'Feature on Homepage',       desc: 'Shown to all visitors in the featured section.',                            price: 2900, duration: '7 Days',  icon: Zap },
  { id: 'bundle',    label: 'Search Visibility Bundle',  desc: 'Highlight Listing and Boost Listing together at a discount.',                price: 2200, duration: 'Highlight 30d + Boost 7d', strikePrice: 2498, savings: 298, icon: Package },
]

function CheckoutForm({ amount, addOns, propertyId, sellerId, property, onSuccess }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  // Renewals stack: extend from the current expiry if it's still in the future,
  // otherwise from now — so renewing early never loses remaining days.
  const endFrom = (currentEnd, days) => {
    const now = Date.now()
    const base = currentEnd && new Date(currentEnd).getTime() > now ? new Date(currentEnd).getTime() : now
    return new Date(base + days * 24 * 60 * 60 * 1000).toISOString()
  }

  const handlePay = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    setError(null)
    const { error: submitErr } = await elements.submit()
    if (submitErr) { setError(submitErr.message); setProcessing(false); return }
    const { error: confirmErr } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    if (confirmErr) {
      setError(confirmErr.message)
      setProcessing(false)
    } else {
      const now = new Date()
      const flags = {}
      if (addOns.includes('highlight') || addOns.includes('bundle')) {
        flags.is_highlighted = true
        flags.highlight_ends_at = endFrom(property?.highlight_ends_at, 30)
      }
      if (addOns.includes('boost') || addOns.includes('bundle')) {
        flags.is_boosted = true
        flags.boost_ends_at = endFrom(property?.boost_ends_at, 7)
      }
      if (addOns.includes('homepage')) {
        flags.is_homepage_featured = true
        flags.homepage_feature_ends_at = endFrom(property?.homepage_feature_ends_at, 7)
      }
      await supabase.from('properties').update(flags).eq('id', propertyId)

      // Record each add-on in listing_addons for tracking/history (best-effort)
      try {
        const ADDON_DAYS   = { highlight: 30, boost: 7, homepage: 7, bundle: 30 }
        const ADDON_PRICES = { highlight: 999, boost: 1499, homepage: 2900, bundle: 2200 }
        const ADDON_END_FIELD = { highlight: 'highlight_ends_at', boost: 'boost_ends_at', homepage: 'homepage_feature_ends_at', bundle: 'highlight_ends_at' }
        for (const addonId of addOns) {
          const days = ADDON_DAYS[addonId] || 7
          await supabase.from('listing_addons').insert({
            property_id:  propertyId,
            seller_id:    sellerId,
            addon_type:   addonId,
            amount_paid:  ADDON_PRICES[addonId] || 0,
            days_purchased: days,
            starts_at:    now.toISOString(),
            ends_at:      endFrom(property?.[ADDON_END_FIELD[addonId]], days),
            status:       'active',
          })
        }
      } catch (_) { /* non-critical — webhook will back-fill */ }

      onSuccess()
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement />
      {error && <div className="p-3 bg-tint border-[1.5px] border-ink rounded-[10px] text-[13px] font-semibold text-ink">{error}</div>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full h-[46px] bg-ink hover:bg-smoke-2 text-white border-[1.5px] border-ink text-[14px] font-semibold rounded-[10px] shadow-soft-3 transition-all duration-120 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {processing
          ? <><Loader2 className="w-4 h-4 motion-safe:animate-spin" /> Processing…</>
          : `Pay $${(amount / 100).toFixed(2)}`}
      </button>
    </form>
  )
}

function EnhanceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const propertyId = searchParams.get('id')

  const [property, setProperty] = useState(null)
  const [userId, setUserId] = useState(null)
  const [isLifetimeFree, setIsLifetimeFree] = useState(false)
  const [selectedAddOns, setSelectedAddOns] = useState([])
  const [clientSecret, setClientSecret] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoValidating, setPromoValidating] = useState(false)
  const [promoError, setPromoError] = useState(null)
  const [appliedPromo, setAppliedPromo] = useState(null)
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (!userStr) { router.push('/login'); return }
    const user = JSON.parse(userStr)
    setUserId(user.id)

    // Owner/personal always allowed; members need addons_buy.
    fetch('/api/team/workspaces', { headers: { Authorization: `Bearer ${user.id}` } })
      .then(r => r.json())
      .then(ws => {
        const isOwner = !ws?.current?.id || ws?.current?.role === 'admin'
        if (!isOwner && !ws?.current?.permissions?.addons_buy) setAccessDenied(true)
      })
      .catch(() => {})

    supabase
      .from('seller_applications')
      .select('admin_notes')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data?.admin_notes === 'LIFETIME_FREE') setIsLifetimeFree(true) })

    if (propertyId) {
      supabase
        .from('properties')
        .select('id, seo_title, address, city, state, is_highlighted, highlight_ends_at, is_boosted, boost_ends_at, is_homepage_featured, homepage_feature_ends_at')
        .eq('id', propertyId)
        .eq('seller_id', user.id)
        .single()
        .then(async ({ data }) => {
          if (!data) return
          // Clear any expired add-ons
          const now = new Date()
          const expiredClears = {}
          if (data.is_highlighted && data.highlight_ends_at && new Date(data.highlight_ends_at) < now) {
            expiredClears.is_highlighted = false; expiredClears.highlight_ends_at = null
          }
          if (data.is_boosted && data.boost_ends_at && new Date(data.boost_ends_at) < now) {
            expiredClears.is_boosted = false; expiredClears.boost_ends_at = null
          }
          if (data.is_homepage_featured && data.homepage_feature_ends_at && new Date(data.homepage_feature_ends_at) < now) {
            expiredClears.is_homepage_featured = false; expiredClears.homepage_feature_ends_at = null
          }
          if (Object.keys(expiredClears).length > 0) {
            await supabase.from('properties').update(expiredClears).eq('id', propertyId)
            setProperty({ ...data, ...expiredClears })
          } else {
            setProperty(data)
          }
        })
    }
  }, [propertyId, router])

  const toggleAddOn = (id) => {
    setSelectedAddOns(prev => {
      if (prev.includes(id)) return prev.filter(a => a !== id)
      let next = [...prev, id]
      if (id === 'bundle') next = next.filter(a => a !== 'highlight' && a !== 'boost')
      if (id === 'highlight' || id === 'boost') next = next.filter(a => a !== 'bundle')
      return next
    })
    setClientSecret(null)
    setError(null)
  }

  const total = selectedAddOns.reduce((sum, id) => {
    const ao = ADD_ONS.find(a => a.id === id)
    return sum + (ao?.price || 0)
  }, 0)

  const discountAmount = appliedPromo
    ? appliedPromo.discount.type === 'percent'
      ? Math.round(total * appliedPromo.discount.value / 100)
      : Math.min(appliedPromo.discount.value * 100, total - 50)
    : 0
  const finalTotal = total - discountAmount

  const validatePromo = async () => {
    if (!promoCode.trim()) return
    setPromoValidating(true)
    setPromoError(null)
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(promoCode.trim())}`)
      const data = await res.json()
      if (data.valid) {
        setAppliedPromo(data)
      } else {
        setPromoError(data.error || 'Invalid promo code')
      }
    } catch {
      setPromoError('Failed to validate code')
    } finally {
      setPromoValidating(false)
    }
  }

  const applyFreeAddons = async () => {
    if (!userId || selectedAddOns.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seller/listing-addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: userId, add_ons: selectedAddOns, property_id: propertyId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to apply add-ons')
      // Update property flags client-side
      const now = new Date()
      const flags = {}
      if (selectedAddOns.includes('highlight') || selectedAddOns.includes('bundle')) {
        flags.is_highlighted = true
        flags.highlight_ends_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
      if (selectedAddOns.includes('boost') || selectedAddOns.includes('bundle')) {
        flags.is_boosted = true
        flags.boost_ends_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
      if (selectedAddOns.includes('homepage')) {
        flags.is_homepage_featured = true
        flags.homepage_feature_ends_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
      await supabase.from('properties').update(flags).eq('id', propertyId)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInitPayment = async () => {
    if (!userId || selectedAddOns.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seller/listing-addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: userId, add_ons: selectedAddOns, property_id: propertyId, promo_code_id: appliedPromo?.promo_code_id || null }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to initialize payment')
      setClientSecret(d.clientSecret)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-tint-3 flex items-center justify-center p-6" style={{ fontFamily: 'var(--font-instrument), sans-serif' }}>
        <div className="bg-white border-[1.5px] border-ink rounded-[14px] shadow-offset-4 p-10 text-center max-w-sm">
          <div className="w-12 h-12 bg-tint border-[1.5px] border-ink rounded-[10px] flex items-center justify-center mx-auto mb-4">
            <Star className="w-6 h-6 text-ink" />
          </div>
          <h2 className="font-display text-[16.5px] font-bold tracking-[-0.01em] text-body mb-2">Access Restricted</h2>
          <p className="text-[13px] text-muted leading-relaxed">You don&apos;t have permission to buy add-ons. Contact your team owner to request access.</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex flex-col items-center text-center py-12 gap-4">
        <div className="w-16 h-16 bg-tint border-[1.5px] border-ink rounded-pill flex items-center justify-center">
          <Check className="w-8 h-8 text-ink" />
        </div>
        <div>
          <h2 className="font-display text-[20px] font-bold tracking-[-0.01em] text-body mb-1">Enhancements applied!</h2>
          <p className="text-[14px] text-muted">Your listing is now boosted with the selected add-ons.</p>
        </div>
        <button
          onClick={() => router.push('/properties')}
          className="h-[46px] px-8 bg-ink hover:bg-smoke-2 text-white border-[1.5px] border-ink text-[14px] font-semibold rounded-[10px] shadow-soft-3 transition-all duration-120"
        >
          Back to My Listings
        </button>
      </div>
    )
  }

  const title = property?.address || property?.seo_title || 'Your listing'
  const location = [property?.city, property?.state].filter(Boolean).join(', ')
  const activeEnhancements = property ? getActiveEnhancements(property) : []

  return (
    <div className="space-y-6" style={{ fontFamily: 'var(--font-instrument), sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-[8px] hover:bg-tint transition-colors duration-120">
          <ArrowLeft size={20} className="text-muted" />
        </button>
        <div>
          <h1 className="font-display text-[18px] font-bold tracking-[-0.01em] text-body">{property ? title : 'Enhance Listing'}</h1>
          {property && location && <p className="font-mono text-[12px] text-muted mt-0.5">{location}</p>}
        </div>
      </div>

      {/* Active Enhancements with timeline */}
      {activeEnhancements.length > 0 && (
        <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-display text-[15px] font-semibold tracking-[-0.01em] text-body">Active Enhancements</p>
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.05em] text-white bg-ink px-2.5 py-1 rounded-pill">
              <span className="w-1.5 h-1.5 rounded-full bg-white motion-safe:animate-pin-blink inline-block" />
              {activeEnhancements.length} Live
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {activeEnhancements.map(({ id, endsAt }) => {
              const meta = ACTIVE_ENHANCEMENT_META[id]
              if (!meta) return null
              const Icon = meta.icon
              const days = daysRemaining(endsAt)
              const elapsed = meta.totalDays - days
              const pct = Math.min(97, Math.max(3, (elapsed / meta.totalDays) * 100))
              const urgency = days <= 2
              return (
                <div key={id} className="border-[1.5px] border-ink rounded-[12px] overflow-hidden bg-white">
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    <div className="w-9 h-9 rounded-[8px] border-[1.5px] border-ink bg-tint flex items-center justify-center flex-shrink-0">
                      <Icon className="w-[18px] h-[18px] text-ink" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-[13px] font-semibold text-body truncate">{meta.label}</p>
                        <span
                          className={`font-mono text-[10.5px] font-bold uppercase tracking-[0.05em] px-2 py-0.5 rounded-pill flex-shrink-0 ${urgency ? 'bg-ink text-white' : 'bg-tint text-ink border border-ink'}`}
                        >
                          {days}d left
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[10.5px] text-muted">
                        <CalendarDays className="w-3 h-3 flex-shrink-0" />
                        <span>Expires {formatExpiry(endsAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="w-full h-[6px] bg-tint rounded-pill overflow-hidden border border-hairline">
                      <div
                        className="h-full rounded-pill bg-ink"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted">Day 1</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted">{Math.round(pct)}% elapsed · {meta.totalDays}d total</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
        {/* Left: Add-on selection */}
        <div className="space-y-3">
          <p className="text-[13px] text-muted">{isLifetimeFree ? 'Select the add-ons you want to apply to this listing.' : 'Select the add-ons you want to apply to this listing. One-time payments per listing.'}</p>
          {ADD_ONS.map((ao) => {
            const Icon = ao.icon
            const selected = selectedAddOns.includes(ao.id)
            const alreadyActive = (ao.id === 'highlight' && property?.is_highlighted)
              || (ao.id === 'boost' && property?.is_boosted)
              || (ao.id === 'homepage' && property?.is_homepage_featured)
              || (ao.id === 'bundle' && property?.is_highlighted && property?.is_boosted)
            const isDisabled =
              (ao.id === 'bundle' && (selectedAddOns.includes('highlight') || selectedAddOns.includes('boost')))
              || ((ao.id === 'highlight' || ao.id === 'boost') && selectedAddOns.includes('bundle'))

            return (
              <button
                key={ao.id}
                type="button"
                onClick={() => !isDisabled && toggleAddOn(ao.id)}
                disabled={isDisabled}
                className={`w-full grid grid-cols-[44px_1fr_auto_22px] gap-4 items-center p-[18px_20px] border-[1.5px] rounded-[12px] text-left transition-all duration-120
                  ${selected ? 'border-ink bg-tint shadow-offset-3'
                  : isDisabled ? 'border-line bg-white opacity-40 cursor-not-allowed'
                  : alreadyActive ? 'border-ink bg-white hover:bg-tint'
                  : 'border-line bg-white hover:border-ink hover:bg-tint'}`}
              >
                {/* Icon */}
                <div className={`w-11 h-11 rounded-[10px] border-[1.5px] flex items-center justify-center flex-shrink-0
                  ${selected ? 'bg-ink border-ink text-white' : 'bg-tint border-ink text-ink'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {/* Text */}
                <div className="min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-0.5">
                    <span className={`text-[14px] font-semibold ${selected || alreadyActive ? 'text-ink' : 'text-body'}`}>
                      {ao.label}
                    </span>
                    {alreadyActive && (
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white bg-ink px-2 py-0.5 rounded-pill">Active</span>
                    )}
                    <span className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-muted bg-tint-2 border border-hairline px-2 py-0.5 rounded-pill">
                      {ao.duration}
                    </span>
                    {ao.savings && (
                      <span className="font-mono text-[10px] font-semibold tracking-[0.06em] uppercase text-ink bg-tint border border-ink px-2 py-0.5 rounded-pill">
                        Save ${(ao.savings / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-muted">{ao.desc}</p>
                  {alreadyActive && (
                    <p className="text-[12px] font-medium text-ink mt-0.5">Currently active — select to renew (added on top of remaining time).</p>
                  )}
                </div>
                {/* Price */}
                <div className="text-right flex-shrink-0">
                  {ao.strikePrice && (
                    <p className="font-mono text-[12px] text-mist line-through">${(ao.strikePrice / 100).toFixed(2)}</p>
                  )}
                  <p className={`font-display text-[16px] font-bold ${selected ? 'text-ink' : 'text-body'}`}>
                    {isLifetimeFree ? 'Free' : `+$${(ao.price / 100).toFixed(2)}`}
                  </p>
                </div>
                {/* Checkbox */}
                <div className={`w-[22px] h-[22px] rounded-pill border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all duration-120
                  ${selected ? 'bg-ink border-ink' : 'border-line bg-white'}`}>
                  {selected && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            )
          })}
        </div>

        {/* Right: Sticky order summary + payment */}
        <div className="lg:sticky lg:top-6 border-[1.5px] border-ink rounded-[12px] overflow-hidden bg-white flex flex-col shadow-offset-4">

          {/* Order lines */}
          <div className="p-5 flex-1 border-b border-hairline">
            <div className="flex justify-between items-baseline mb-3.5">
              <p className="font-mono text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">Order Summary</p>
              <p className="font-mono text-[11px] text-muted font-medium">{selectedAddOns.length} item{selectedAddOns.length !== 1 ? 's' : ''}</p>
            </div>
            {selectedAddOns.length === 0 ? (
              <p className="text-[13px] text-mist italic py-2">No add-ons selected</p>
            ) : (
              <div className="divide-y divide-hairline-2">
                {selectedAddOns.map(id => {
                  const ao = ADD_ONS.find(a => a.id === id)
                  return ao ? (
                    <div key={id} className="flex justify-between items-baseline py-2">
                      <span className="text-[13px] text-smoke-2">
                        <span className="font-mono text-[11px] text-mist mr-1">+</span>
                        {ao.label}
                      </span>
                      <span className="font-mono text-[13px] font-bold text-ink">{isLifetimeFree ? 'Free' : `+$${(ao.price / 100).toFixed(2)}`}</span>
                    </div>
                  ) : null
                })}
              </div>
            )}
          </div>

          {/* Promo code — hidden for lifetime free accounts */}
          {!isLifetimeFree && (
            <div className="px-5 py-4 border-b border-hairline">
              {appliedPromo ? (
                <div className="flex items-center justify-between p-2.5 bg-tint border-[1.5px] border-ink rounded-[10px]">
                  <div>
                    <p className="font-mono text-[12px] font-semibold text-ink">{appliedPromo.name || promoCode.toUpperCase()} applied</p>
                    <p className="font-mono text-[11px] text-ink">
                      {appliedPromo.discount.type === 'percent'
                        ? `${appliedPromo.discount.value}% off`
                        : `$${appliedPromo.discount.value.toFixed(2)} off`}
                    </p>
                  </div>
                  <button
                    onClick={() => { setAppliedPromo(null); setPromoCode('') }}
                    className="text-[11px] text-ink underline hover:no-underline"
                  >Remove</button>
                </div>
              ) : (
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted mb-2">Promo Code</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(null) }}
                      onKeyDown={e => e.key === 'Enter' && validatePromo()}
                      placeholder="Enter promo code"
                      className="flex-1 h-[36px] px-3 font-mono text-[13px] border-[1.5px] border-line rounded-[9px] bg-white focus:outline-none focus:border-ink focus:shadow-offset-2"
                    />
                    <button
                      type="button"
                      onClick={validatePromo}
                      disabled={promoValidating || !promoCode.trim()}
                      className="px-3 h-[36px] text-[13px] font-semibold border-[1.5px] border-ink rounded-[9px] bg-white text-ink shadow-offset-2 hover:bg-tint disabled:opacity-50 flex items-center gap-1.5 transition-all duration-120"
                    >
                      {promoValidating ? <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                  {promoError && <p className="text-[12px] font-semibold text-ink mt-1.5">{promoError}</p>}
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div className="px-5 py-4 flex justify-between items-baseline border-b border-hairline">
            <div>
              <p className="font-display text-[15px] font-bold text-body">Total</p>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-muted mt-0.5">{isLifetimeFree ? 'Complimentary — DeelMap account' : 'One-time charge'}</p>
            </div>
            <div className="text-right">
              {!isLifetimeFree && discountAmount > 0 && (
                <p className="font-mono text-[13px] text-mist line-through">${(total / 100).toFixed(2)}</p>
              )}
              <span className="font-display text-[28px] font-bold text-ink tracking-[-0.025em]">{isLifetimeFree ? 'Free' : `$${(finalTotal / 100).toFixed(2)}`}</span>
            </div>
          </div>

          {error && <div className="mx-5 mt-4 p-3 bg-tint border-[1.5px] border-ink rounded-[10px] text-[13px] font-semibold text-ink">{error}</div>}

          {/* CTA / Payment form */}
          <div className="p-5">
            {selectedAddOns.length === 0 ? (
              <button disabled className="w-full h-[48px] bg-tint text-mist border-[1.5px] border-line text-[14px] font-semibold rounded-[10px] cursor-not-allowed">
                Select Add-Ons to Continue
              </button>
            ) : isLifetimeFree ? (
              <button
                onClick={applyFreeAddons}
                disabled={loading}
                className="w-full h-[48px] bg-ink hover:bg-smoke-2 text-white border-[1.5px] border-ink text-[14px] font-semibold rounded-[10px] shadow-soft-3 transition-all duration-120 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 motion-safe:animate-spin" /> Applying…</> : 'Apply for Free'}
              </button>
            ) : !clientSecret ? (
              <button
                onClick={handleInitPayment}
                disabled={loading}
                className="w-full h-[48px] bg-ink hover:bg-smoke-2 text-white border-[1.5px] border-ink text-[14px] font-semibold rounded-[10px] shadow-soft-3 transition-all duration-120 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 motion-safe:animate-spin" /> Loading…</> : 'Proceed to Payment'}
              </button>
            ) : (
              stripePromise && (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CheckoutForm
                    amount={total}
                    addOns={selectedAddOns}
                    propertyId={propertyId}
                    sellerId={userId}
                    property={property}
                    onSuccess={() => setSuccess(true)}
                  />
                </Elements>
              )
            )}
          </div>

          {/* Footer */}
          {!isLifetimeFree && (
            <div className="px-5 py-3.5 bg-tint-3 border-t border-hairline text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <svg className="w-3 h-3 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted">Secured by Stripe</span>
              </div>
              <p className="font-mono text-[10.5px] text-mist">No subscription · No auto-renewal</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EnhancePage() {
  return (
    <Suspense>
      <EnhanceContent />
    </Suspense>
  )
}
