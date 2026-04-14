'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Star, TrendingUp, Zap, Package, Check, Loader2 } from 'lucide-react'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

const ADD_ONS = [
  { id: 'highlight', label: 'Highlight Listing',   desc: 'Red-bordered card in search results for 30 days.',                               price: 999,  icon: Star },
  { id: 'boost',     label: 'Boost Listing',        desc: 'Top of search results for 7 days.',                                             price: 1499, icon: TrendingUp },
  { id: 'homepage',  label: 'Feature on Homepage',  desc: 'Shown to all visitors in the featured section for 7 days.',                     price: 2900, icon: Zap },
  { id: 'bundle',    label: 'Visibility Bundle',    desc: 'Highlight (30 days) + Boost (7 days) at a discount. Best value.',               price: 2200, icon: Package },
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
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const in7Days  = new Date(Date.now() +  7 * 24 * 60 * 60 * 1000).toISOString()
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
          : `Pay $${(amount / 100).toFixed(2)} & Enhance`}
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

  const handleInitPayment = async () => {
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

  const title = property?.seo_title || property?.address || 'Your listing'
  const location = [property?.city, property?.state].filter(Boolean).join(', ')

  return (
    <div className="space-y-6" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded hover:bg-[#F0F0EE] transition-colors">
          <ArrowLeft size={20} className="text-[#737370]" />
        </button>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1816]">Enhance Listing</h1>
          {property && <p className="text-[13px] text-[#737370] mt-0.5">{title}{location ? ` · ${location}` : ''}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Add-on selection */}
        <div className="lg:col-span-2 space-y-3">
          <p className="text-[13px] text-[#737370]">Select the add-ons you want to apply to this listing. One-time payments per listing.</p>
          {ADD_ONS.map((ao) => {
            const Icon = ao.icon
            const selected = selectedAddOns.includes(ao.id)
            const alreadyActive = (ao.id === 'highlight' && property?.is_highlighted)
              || (ao.id === 'boost' && property?.is_boosted)
              || (ao.id === 'homepage' && property?.is_homepage_featured)
              || (ao.id === 'bundle' && property?.is_highlighted && property?.is_boosted)

            return (
              <button
                key={ao.id}
                type="button"
                onClick={() => !alreadyActive && toggleAddOn(ao.id)}
                disabled={alreadyActive}
                className={`w-full text-left p-5 rounded border-2 transition-all ${
                  alreadyActive ? 'border-[#9FDBB8] bg-[#E4F5EC] opacity-70 cursor-default'
                  : selected ? 'border-[#D03839] bg-[#FEF0EF]'
                  : 'border-[#E8E8E4] bg-white hover:border-[#1A1816]'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${alreadyActive ? 'text-[#0F6E56]' : selected ? 'text-[#D03839]' : 'text-[#737370]'}`} />
                    <p className={`text-[14px] font-semibold ${alreadyActive ? 'text-[#0F6E56]' : selected ? 'text-[#D03839]' : 'text-[#1A1816]'}`}>
                      {ao.label}
                      {alreadyActive && <span className="ml-2 text-[11px] font-bold bg-[#0F6E56] text-white px-1.5 py-0.5 rounded">Active</span>}
                    </p>
                  </div>
                  <p className="text-[14px] font-bold text-[#1A1816]">${(ao.price / 100).toFixed(2)}</p>
                </div>
                <p className="text-[12px] text-[#737370] leading-relaxed">{ao.desc}</p>
              </button>
            )
          })}
        </div>

        {/* Right: Order summary + payment */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E8E8E4] rounded p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A8A4] mb-4">Order Summary</p>
            {selectedAddOns.length === 0 ? (
              <p className="text-[13px] text-[#A8A8A4] text-center py-4">Select add-ons to see pricing</p>
            ) : (
              <div className="space-y-2">
                {selectedAddOns.map(id => {
                  const ao = ADD_ONS.find(a => a.id === id)
                  return ao ? (
                    <div key={id} className="flex justify-between items-center">
                      <span className="text-[13px] text-[#1A1816]">{ao.label}</span>
                      <span className="text-[13px] font-semibold text-[#1A1816]">${(ao.price / 100).toFixed(2)}</span>
                    </div>
                  ) : null
                })}
                <div className="border-t border-[#E8E8E4] pt-2 mt-2 flex justify-between items-center">
                  <span className="text-[13px] font-bold text-[#1A1816]">Total</span>
                  <span className="text-[15px] font-bold text-[#1A1816]">${(total / 100).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {error && <div className="p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[13px] text-[#D03839]">{error}</div>}

          {selectedAddOns.length > 0 && (
            <div className="bg-white border border-[#E8E8E4] rounded p-5">
              {!clientSecret ? (
                <button
                  onClick={handleInitPayment}
                  disabled={loading}
                  className="w-full h-[44px] bg-[#D03839] hover:bg-[#E0493B] text-white text-[14px] font-semibold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</> : 'Continue to Payment'}
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
