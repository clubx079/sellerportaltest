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
  highlight: { label: 'Highlight Listing',    icon: Sparkles,   totalDays: 30, color: '#D03839', bg: '#FEF0EF', border: '#F5C0BF' },
  boost:     { label: 'Boost Listing',        icon: Zap,        totalDays: 7,  color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
  homepage:  { label: 'Featured on Homepage', icon: TrendingUp, totalDays: 7,  color: '#0F6E56', bg: '#E4F5EC', border: '#B6E4CE' },
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
  { id: 'highlight', label: 'Highlight Listing',        desc: 'Red-bordered card in search results.',                                        price: 999,  duration: '30 Days', icon: Star },
  { id: 'boost',     label: 'Boost Listing',             desc: 'Top of search results.',                                                     price: 1499, duration: '7 Days',  icon: TrendingUp },
  { id: 'homepage',  label: 'Feature on Homepage',       desc: 'Shown to all visitors in the featured section.',                            price: 2900, duration: '7 Days',  icon: Zap },
  { id: 'bundle',    label: 'Search Visibility Bundle',  desc: 'Highlight Listing and Boost Listing together at a discount.',                price: 2200, duration: 'Highlight 30d + Boost 7d', strikePrice: 2498, savings: 298, icon: Package },
]

function CheckoutForm({ amount, addOns, propertyId, sellerId, onSuccess }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

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
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const in7Days  = new Date(now.getTime() +  7 * 24 * 60 * 60 * 1000).toISOString()
      const flags = {}
      if (addOns.includes('highlight') || addOns.includes('bundle')) {
        flags.is_highlighted = true
        flags.highlight_ends_at = in30Days
      }
      if (addOns.includes('boost') || addOns.includes('bundle')) {
        flags.is_boosted = true
        flags.boost_ends_at = in7Days
      }
      if (addOns.includes('homepage')) {
        flags.is_homepage_featured = true
        flags.homepage_feature_ends_at = in7Days
      }
      await supabase.from('properties').update(flags).eq('id', propertyId)

      // Record each add-on in listing_addons for tracking/history (best-effort)
      try {
        const ADDON_DAYS   = { highlight: 30, boost: 7, homepage: 7, bundle: 30 }
        const ADDON_PRICES = { highlight: 999, boost: 1499, homepage: 2900, bundle: 2200 }
        for (const addonId of addOns) {
          const days = ADDON_DAYS[addonId] || 7
          await supabase.from('listing_addons').insert({
            property_id:  propertyId,
            seller_id:    sellerId,
            addon_type:   addonId,
            amount_paid:  ADDON_PRICES[addonId] || 0,
            days_purchased: days,
            starts_at:    now.toISOString(),
            ends_at:      new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
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
      {error && <div className="p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[13px] text-[#D03839]">{error}</div>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full h-[46px] bg-[#D03839] hover:bg-[#E0493B] text-white text-[14px] font-semibold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {processing
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
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
  const [selectedAddOns, setSelectedAddOns] = useState([])
  const [clientSecret, setClientSecret] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoValidating, setPromoValidating] = useState(false)
  const [promoError, setPromoError] = useState(null)
  const [appliedPromo, setAppliedPromo] = useState(null)

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (!userStr) { router.push('/login'); return }
    const user = JSON.parse(userStr)
    setUserId(user.id)
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

  if (success) {
    return (
      <div className="flex flex-col items-center text-center py-12 gap-4">
        <div className="w-16 h-16 bg-[#E4F5EC] rounded-full flex items-center justify-center">
          <Check className="w-8 h-8 text-[#0F6E56]" />
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-[#1A1816] mb-1">Enhancements applied!</h2>
          <p className="text-[14px] text-[#737370]">Your listing is now boosted with the selected add-ons.</p>
        </div>
        <button
          onClick={() => router.push('/properties')}
          className="h-[46px] px-8 bg-[#D03839] hover:bg-[#E0493B] text-white text-[14px] font-semibold rounded transition-colors"
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
    <div className="space-y-6" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded hover:bg-[#F0F0EE] transition-colors">
          <ArrowLeft size={20} className="text-[#737370]" />
        </button>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1816]">{property ? title : 'Enhance Listing'}</h1>
          {property && location && <p className="text-[13px] text-[#737370] mt-0.5">{location}</p>}
        </div>
      </div>

      {/* Active Enhancements with timeline */}
      {activeEnhancements.length > 0 && (
        <div className="bg-white border border-[#E8E8E4] rounded p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[15px] font-semibold text-[#1A1816]">Active Enhancements</p>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#0F6E56] bg-[#E4F5EC] border border-[#B6E4CE] px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F6E56] animate-pulse inline-block" />
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
                <div key={id} className="border border-[#E8E8E4] rounded overflow-hidden bg-white">
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                      <Icon className="w-[18px] h-[18px]" style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-[13px] font-semibold text-[#1A1816] truncate">{meta.label}</p>
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
                          style={{ color: urgency ? '#B5620A' : meta.color, background: urgency ? '#FEF3E2' : meta.bg, borderColor: urgency ? '#F3C97D' : meta.border }}
                        >
                          {days}d left
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#A8A8A4]">
                        <CalendarDays className="w-3 h-3 flex-shrink-0" />
                        <span>Expires {formatExpiry(endsAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="w-full h-[5px] bg-[#F3F3F0] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${meta.color}60, ${meta.color})`, transition: 'width 0.6s ease' }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-[#A8A8A4]">Day 1</span>
                      <span className="text-[10px] text-[#A8A8A4]">{Math.round(pct)}% elapsed · {meta.totalDays}d total</span>
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
          <p className="text-[13px] text-[#737370]">Select the add-ons you want to apply to this listing. One-time payments per listing.</p>
          {ADD_ONS.map((ao) => {
            const Icon = ao.icon
            const selected = selectedAddOns.includes(ao.id)
            const alreadyActive = (ao.id === 'highlight' && property?.is_highlighted)
              || (ao.id === 'boost' && property?.is_boosted)
              || (ao.id === 'homepage' && property?.is_homepage_featured)
              || (ao.id === 'bundle' && property?.is_highlighted && property?.is_boosted)
            const isDisabled = alreadyActive
              || (ao.id === 'bundle' && (selectedAddOns.includes('highlight') || selectedAddOns.includes('boost')))
              || ((ao.id === 'highlight' || ao.id === 'boost') && selectedAddOns.includes('bundle'))

            return (
              <button
                key={ao.id}
                type="button"
                onClick={() => !isDisabled && toggleAddOn(ao.id)}
                disabled={isDisabled}
                className={`w-full grid grid-cols-[44px_1fr_auto_22px] gap-4 items-center p-[18px_20px] border rounded-xl text-left transition-all
                  ${alreadyActive ? 'border-[#9FDBB8] bg-[#E4F5EC] opacity-70 cursor-default'
                  : selected ? 'border-[#D03839] bg-gradient-to-b from-[#FEF8F9] to-white shadow-[0_0_0_1px_#D03839]'
                  : isDisabled ? 'border-[#E8E8E4] bg-white opacity-40 cursor-not-allowed'
                  : 'border-[#E8E8E4] bg-white hover:border-[#C8C8C4] hover:-translate-y-px hover:shadow-sm'}`}
              >
                {/* Icon */}
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0
                  ${alreadyActive ? 'bg-[#E4F5EC] text-[#0F6E56]' : selected ? 'bg-[#FEF0EF] text-[#D03839]' : 'bg-[#F5F3EE] text-[#444441]'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {/* Text */}
                <div className="min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-0.5">
                    <span className={`text-[14px] font-semibold ${alreadyActive ? 'text-[#0F6E56]' : selected ? 'text-[#D03839]' : 'text-[#1A1816]'}`}>
                      {ao.label}
                    </span>
                    {alreadyActive ? (
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#0F6E56] bg-[#E4F5EC] border border-[#9FDBB8] px-1.5 py-0.5 rounded">Active</span>
                    ) : (
                      <span className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-[#737370] bg-[#F5F3EE] border border-[#E8E8E4] px-1.5 py-0.5 rounded">
                        {ao.duration}
                      </span>
                    )}
                    {ao.savings && !alreadyActive && (
                      <span className="font-mono text-[10px] font-semibold tracking-[0.06em] uppercase text-[#0F6E56] bg-[#E8F1EC] px-1.5 py-0.5 rounded">
                        Save ${(ao.savings / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#737370]">{ao.desc}</p>
                </div>
                {/* Price */}
                <div className="text-right flex-shrink-0">
                  {ao.strikePrice && !alreadyActive && (
                    <p className="text-[12px] text-[#A8A8A4] line-through">${(ao.strikePrice / 100).toFixed(2)}</p>
                  )}
                  <p className={`text-[16px] font-bold ${alreadyActive ? 'text-[#0F6E56]' : selected ? 'text-[#D03839]' : 'text-[#1A1816]'}`}>
                    {alreadyActive ? 'Active' : `+$${(ao.price / 100).toFixed(2)}`}
                  </p>
                </div>
                {/* Checkbox */}
                <div className={`w-[22px] h-[22px] rounded-full border flex items-center justify-center flex-shrink-0 transition-all
                  ${alreadyActive ? 'bg-[#0F6E56] border-[#0F6E56]' : selected ? 'bg-[#D03839] border-[#D03839]' : 'border-[#C8C8C4]'}`}>
                  {(selected || alreadyActive) && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            )
          })}
        </div>

        {/* Right: Sticky order summary + payment */}
        <div className="lg:sticky lg:top-6 border border-[#E8E8E4] rounded-xl overflow-hidden bg-white flex flex-col shadow-sm">

          {/* Order lines */}
          <div className="p-5 flex-1 border-b border-[#E8E8E4]">
            <div className="flex justify-between items-baseline mb-3.5">
              <p className="font-mono text-[10px] font-medium tracking-[0.12em] uppercase text-[#737370]">Order Summary</p>
              <p className="text-[11px] text-[#737370] font-medium">{selectedAddOns.length} item{selectedAddOns.length !== 1 ? 's' : ''}</p>
            </div>
            {selectedAddOns.length === 0 ? (
              <p className="text-[13px] text-[#A8A8A4] italic py-2">No add-ons selected</p>
            ) : (
              <div className="divide-y divide-[#F0F0EE]">
                {selectedAddOns.map(id => {
                  const ao = ADD_ONS.find(a => a.id === id)
                  return ao ? (
                    <div key={id} className="flex justify-between items-baseline py-2">
                      <span className="text-[13px] text-[#444441]">
                        <span className="font-mono text-[11px] text-[#A8A8A4] mr-1">+</span>
                        {ao.label}
                      </span>
                      <span className="font-mono text-[13px] font-bold text-[#1A1816]">+${(ao.price / 100).toFixed(2)}</span>
                    </div>
                  ) : null
                })}
              </div>
            )}
          </div>

          {/* Promo code */}
          <div className="px-5 py-4 border-b border-[#E8E8E4]">
            {appliedPromo ? (
              <div className="flex items-center justify-between p-2.5 bg-[#E4F5EC] border border-[#9FDBB8] rounded">
                <div>
                  <p className="text-[12px] font-semibold text-[#0F6E56]">{appliedPromo.name || promoCode.toUpperCase()} applied</p>
                  <p className="text-[11px] text-[#0F6E56]">
                    {appliedPromo.discount.type === 'percent'
                      ? `${appliedPromo.discount.value}% off`
                      : `$${appliedPromo.discount.value.toFixed(2)} off`}
                  </p>
                </div>
                <button
                  onClick={() => { setAppliedPromo(null); setPromoCode('') }}
                  className="text-[11px] text-[#0F6E56] underline hover:no-underline"
                >Remove</button>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A8A8A4] mb-2">Promo Code</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(null) }}
                    onKeyDown={e => e.key === 'Enter' && validatePromo()}
                    placeholder="Enter promo code"
                    className="flex-1 h-[36px] px-3 text-[13px] border border-[#E8E8E4] rounded bg-white focus:outline-none focus:border-[#D03839]"
                  />
                  <button
                    type="button"
                    onClick={validatePromo}
                    disabled={promoValidating || !promoCode.trim()}
                    className="px-3 h-[36px] text-[13px] font-semibold border border-[#E8E8E4] rounded bg-white hover:bg-[#FAFAF8] disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {promoValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                  </button>
                </div>
                {promoError && <p className="text-[12px] text-[#D03839] mt-1.5">{promoError}</p>}
              </div>
            )}
          </div>

          {/* Total */}
          <div className="px-5 py-4 flex justify-between items-baseline border-b border-[#E8E8E4]">
            <div>
              <p className="text-[15px] font-bold text-[#1A1816]">Total</p>
              <p className="text-[11px] text-[#737370] mt-0.5">One-time charge</p>
            </div>
            <div className="text-right">
              {discountAmount > 0 && (
                <p className="text-[13px] text-[#A8A8A4] line-through">${(total / 100).toFixed(2)}</p>
              )}
              <span className="text-[28px] font-bold text-[#1A1816] tracking-tight">${(finalTotal / 100).toFixed(2)}</span>
            </div>
          </div>

          {error && <div className="mx-5 mt-4 p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded-lg text-[13px] text-[#D03839]">{error}</div>}

          {/* CTA / Payment form */}
          <div className="p-5">
            {selectedAddOns.length === 0 ? (
              <button disabled className="w-full h-[48px] bg-[#E8E8E4] text-[#A8A8A4] text-[14px] font-semibold rounded-lg cursor-not-allowed">
                Select Add-Ons to Continue
              </button>
            ) : !clientSecret ? (
              <button
                onClick={handleInitPayment}
                disabled={loading}
                className="w-full h-[48px] bg-[#D03839] hover:bg-[#B8102A] active:scale-[0.98] text-white text-[14px] font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(208,56,57,0.25)]"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</> : 'Proceed to Payment'}
              </button>
            ) : (
              stripePromise && (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CheckoutForm
                    amount={total}
                    addOns={selectedAddOns}
                    propertyId={propertyId}
                    sellerId={userId}
                    onSuccess={() => setSuccess(true)}
                  />
                </Elements>
              )
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 bg-[#FAFAF6] border-t border-[#E8E8E4] text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <svg className="w-3 h-3 text-[#737370]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span className="text-[12px] text-[#737370]">Secured by Stripe</span>
            </div>
            <p className="text-[11px] text-[#A8A8A4]">No subscription · No auto-renewal</p>
          </div>
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
