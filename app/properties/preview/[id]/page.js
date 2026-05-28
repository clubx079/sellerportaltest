'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft, Heart, Share2,
  MapPin, Building2, Calendar, Square, Map, Bed, Droplets, Car,
  ChevronLeft, ChevronRight,
  TrendingUp, Shield, Star, DollarSign, Wrench, Home, Phone, X
} from 'lucide-react'

// ─── Footer ──────────────────────────────────────────────────────────────────
const FOOTER_PLATFORM = [
  { label: 'Buy', href: '#' }, { label: 'Sell', href: '#' },
  { label: 'Finance', href: '#' }, { label: 'Messaging', href: '#' }, { label: 'Analytics', href: '#' },
]
const FOOTER_COMPANY = [
  { label: 'About us', href: '#' }, { label: 'How it works', href: '#' },
  { label: 'Careers', href: '#' }, { label: 'Contact', href: '#' }, { label: 'Blog', href: '#' },
]
const FOOTER_RESOURCES = [
  { label: 'Help center', href: '#' }, { label: 'Investor guide', href: '#' },
  { label: 'FAQ', href: '#' }, { label: 'Market data', href: '#' },
]
const FOOTER_LEGAL = [
  { label: 'Privacy policy', href: '#' }, { label: 'Terms of service', href: '#' },
  { label: 'Cookie policy', href: '#' }, { label: 'Disclaimer', href: '#' },
]

function Footer() {
  return (
    <footer>
      <div className="bg-[#1A1816] relative overflow-hidden">
        <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white/[0.04] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
            <div className="max-w-lg">
              <p className="text-[11px] font-semibold text-[#737370] uppercase tracking-[2px] mb-4">GET STARTED TODAY</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-4">Find and close better<br />real estate deals</h2>
              <p className="text-[#737370] text-[15px] leading-relaxed">Join thousands of investors already using Deelmap to source, analyze, and close off-market deals across the United States.</p>
            </div>
            <div className="flex flex-col gap-3 lg:min-w-[260px]">
              <button className="flex items-center justify-center gap-2 h-14 bg-[#D03839] hover:bg-[#E0493B] text-white font-semibold text-[16px] rounded transition-colors">Start finding deals →</button>
              <button className="flex items-center justify-center h-14 border border-[#444441] text-white hover:border-[#737370] font-medium text-[15px] rounded transition-colors">List a property</button>
              <p className="text-[12px] text-[#737370] text-center">No credit card required · Free to browse</p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-[#111111]">
        <div className="w-full px-6 lg:px-10 py-12 lg:py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[#D03839] rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7zm0 9.5c-1.381 0-2.5-1.119-2.5-2.5S10.619 6.5 12 6.5s2.5 1.119 2.5 2.5S13.381 11.5 12 11.5z"/></svg>
                </div>
                <span className="text-white font-bold text-[18px]">DeelMap</span>
              </div>
              <p className="text-[13px] text-[#737370] leading-relaxed mb-6">The trusted marketplace for verified off-market real estate deals across the United States.</p>
              <div className="flex items-center gap-2">
                {[
                  <svg key="tw" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
                  <svg key="ig" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
                ].map((icon, i) => (
                  <button key={i} className="w-9 h-9 border border-[#333333] rounded flex items-center justify-center text-[#737370] hover:text-white hover:border-[#555555] transition-colors">{icon}</button>
                ))}
              </div>
            </div>
            {[
              { title: 'PLATFORM', links: FOOTER_PLATFORM },
              { title: 'COMPANY', links: FOOTER_COMPANY },
              { title: 'RESOURCES', links: FOOTER_RESOURCES },
              { title: 'LEGAL', links: FOOTER_LEGAL },
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 className="text-[11px] font-semibold text-white uppercase tracking-[1.5px] mb-5">{title}</h4>
                <ul className="space-y-3">
                  {links.map(l => (
                    <li key={l.label}><a href={l.href} className="text-[14px] text-[#737370] hover:text-white transition-colors">{l.label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-[#222222]">
          <div className="w-full px-6 lg:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[13px] text-[#555555]">© 2025 Deelmap. All rights reserved.</p>
            <div className="flex items-center gap-5">
              {['Privacy', 'Terms', 'Cookies'].map(l => (
                <a key={l} href="#" className="text-[13px] text-[#555555] hover:text-white transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Image Modal ─────────────────────────────────────────────────────────────
function ImageModal({ isOpen, onClose, photos, initialIndex = 0 }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  useEffect(() => { if (isOpen) setCurrentIndex(initialIndex) }, [isOpen, initialIndex])

  useEffect(() => {
    if (!isOpen) return
    const handle = (e) => {
      if (e.key === 'ArrowLeft') setCurrentIndex(i => (i - 1 + photos.length) % photos.length)
      else if (e.key === 'ArrowRight') setCurrentIndex(i => (i + 1) % photos.length)
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [isOpen, photos?.length, onClose])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen || !photos || photos.length === 0) return null

  const url = photos[currentIndex]?.image_url || photos[currentIndex]?.photo_url || ''

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-[#0D0D0D]" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-white/50 text-[13px] font-medium">{currentIndex + 1} <span className="text-white/25">/</span> {photos.length}</span>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-14 min-h-0 relative" onClick={e => e.stopPropagation()}>
        <img src={url} alt={`Photo ${currentIndex + 1}`} className="max-w-full max-h-full w-auto h-auto object-contain" style={{ maxHeight: 'calc(100vh - 180px)' }} />
        {photos.length > 1 && (
          <>
            <button onClick={() => setCurrentIndex(i => (i - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setCurrentIndex(i => (i + 1) % photos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex-shrink-0 px-5 py-4" onClick={e => e.stopPropagation()}>
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {photos.map((photo, idx) => (
              <button key={idx} onClick={() => setCurrentIndex(idx)}
                className={`relative flex-shrink-0 w-16 h-16 rounded overflow-hidden transition-all duration-150 ${idx === currentIndex ? 'ring-2 ring-white opacity-100' : 'opacity-40 hover:opacity-70'}`}>
                <img src={photo.image_url || photo.photo_url || ''} alt={`Thumb ${idx + 1}`} loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main preview page ────────────────────────────────────────────────────────
export default function PropertyPreviewPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id

  const [property, setProperty] = useState(null)
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showPhone, setShowPhone] = useState(false)
  const [sellerPhone, setSellerPhone] = useState('')
  const [showImageModal, setShowImageModal] = useState(false)
  const [imageModalIndex, setImageModalIndex] = useState(0)
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [purchasePrice, setPurchasePrice] = useState(null)
  const [downPaymentPercent, setDownPaymentPercent] = useState(25)
  const [estimatedRent, setEstimatedRent] = useState(null)
  const [similarProperties, setSimilarProperties] = useState([])
  const [similarSliderIndex, setSimilarSliderIndex] = useState(0)
  const mapRef = useRef(null)
  const mapInitRef = useRef(false)

  const intercept = (e) => { e.preventDefault(); e.stopPropagation(); setShowPreviewModal(true) }

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('seller_user') || '{}')
      if (u?.phone) setSellerPhone(u.phone)
    } catch {}
  }, [])

  useEffect(() => {
    if (!id) return
    const fetchProperty = async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*, property_images(*)')
        .eq('id', id)
        .single()

      if (error || !data) { setLoading(false); return }

      const sorted = (data.property_images || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      setPhotos(sorted)
      setPurchasePrice(data.price || null)
      setEstimatedRent(data.estimated_rent || null)
      setProperty(data)
      setLoading(false)

      // Fetch similar
      if (data.city) {
        const { data: sim } = await supabase
          .from('properties')
          .select('*, property_images(*)')
          .eq('city', data.city)
          .neq('id', id)
          .eq('status', 'active')
          .limit(8)
        if (sim) setSimilarProperties(sim)
      }
    }
    fetchProperty()
  }, [id])

  // Google Maps
  useEffect(() => {
    if (!property || mapInitRef.current) return
    const lat = property.latitude ? parseFloat(property.latitude) : null
    const lng = property.longitude ? parseFloat(property.longitude) : null
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return

    const initMap = () => {
      if (!window.google || !mapRef.current || mapInitRef.current) return
      mapInitRef.current = true
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat, lng }, zoom: 15,
        mapTypeControl: false, streetViewControl: false,
      })
      new window.google.maps.Marker({ position: { lat, lng }, map })
    }

    if (window.google) {
      initMap()
    } else {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
      if (!apiKey) {
        if (mapRef.current) mapRef.current.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#737370;font-size:13px">Map not available</div>'
        return
      }
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        const check = setInterval(() => { if (window.google) { clearInterval(check); initMap() } }, 100)
        return
      }
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
      script.async = true
      script.onload = initMap
      document.head.appendChild(script)
    }
  }, [property])

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center" style={{ fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#E8E8E4] border-t-[#D03839]" />
    </div>
  )

  if (!property) return (
    <div className="min-h-screen bg-white flex items-center justify-center" style={{ fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <p className="text-[#737370]">Property not found.</p>
    </div>
  )

  const fullAddress = property.address
    ? [property.address, property.city, property.state].filter(Boolean).join(', ')
    : property.title || 'Address unavailable'

  const formatPrice = (p) => {
    if (!p) return '—'
    const n = Number(p)
    return n > 0 ? `$${Math.round(n).toLocaleString('en-US')}` : '—'
  }

  // Financial calc
  const purchasePriceNum = purchasePrice ? Number(purchasePrice) : 0
  const estimatedRentNum = estimatedRent ? Number(estimatedRent) : 0
  const downPayment = purchasePriceNum * (downPaymentPercent / 100)
  const loanAmount = purchasePriceNum - downPayment
  const rate = 0.07 / 12
  const n = 30 * 12
  const monthlyPayment = loanAmount > 0 ? loanAmount * (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1) : 0
  const annualRent = estimatedRentNum * 12
  const annualExpenses = (purchasePriceNum * 0.015) + (annualRent * 0.1)
  const noi = annualRent - annualExpenses
  const netCashFlow = noi - monthlyPayment * 12
  const grossYield = purchasePriceNum > 0 ? (annualRent / purchasePriceNum) * 100 : null
  const capRate = purchasePriceNum > 0 ? (noi / purchasePriceNum) * 100 : null
  const cashOnCash = downPayment > 0 ? (netCashFlow / downPayment) * 100 : null

  const arv = property.arv || null
  const estimatedProfit = arv && property.price ? arv - property.price : null

  const snapshotItems = [
    property.property_type && { icon: <Home className="h-4 w-4" />, label: 'Property Type', value: property.property_type },
    property.year_built && { icon: <Calendar className="h-4 w-4" />, label: 'Year built', value: property.year_built },
    property.floor_area && { icon: <Square className="h-4 w-4" />, label: 'Living Area', value: `${Number(property.floor_area).toLocaleString()} sq ft` },
    property.lot_size && { icon: <Map className="h-4 w-4" />, label: 'Lot Size', value: property.lot_size },
    property.parking && { icon: <Car className="h-4 w-4" />, label: 'Parking', value: property.parking },
    property.zoning && { icon: <MapPin className="h-4 w-4" />, label: 'Zoning', value: property.zoning },
  ].filter(Boolean)

  const investmentHighlights = (() => {
    const items = []
    if (arv && property.price && property.price < arv * 0.85) items.push({ title: 'Below-Market Acquisition', desc: 'Purchase price is significantly below after-repair value, offering built-in equity.' })
    if (cashOnCash != null && cashOnCash > 15) items.push({ title: 'High ROI Potential', desc: 'Strong cash-on-cash returns indicate excellent investment performance.' })
    items.push({ title: 'Value-Add Opportunity', desc: 'Property offers potential for appreciation through strategic improvements.' })
    items.push({ title: 'Strong Rental Market', desc: 'Located in a market with consistent rental demand and low vacancy rates.' })
    return items.slice(0, 4)
  })()

  const perPage = 4
  const totalSimPages = Math.ceil(similarProperties.length / perPage)
  const visibleSimilar = similarProperties.slice(similarSliderIndex * perPage, similarSliderIndex * perPage + perPage)

  return (
    <div className="min-h-screen bg-[#FAFAF8] relative overflow-x-hidden" style={{ fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>

      {/* Preview modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded w-full max-w-sm p-6 text-center shadow-xl">
            <h3 className="text-[16px] font-bold text-[#1A1816] mb-2">You&apos;re in Preview Mode</h3>
            <p className="text-[13px] text-[#737370] mb-5">This is how buyers see your listing. Actions buyers use — messaging, offers, and saving — are turned off here.</p>
            <button onClick={() => setShowPreviewModal(false)} className="w-full h-[40px] bg-[#1A1816] hover:bg-[#2A2825] text-white text-[13px] font-semibold rounded transition-colors">
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Image modal */}
      <ImageModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        photos={photos}
        initialIndex={imageModalIndex}
      />

      {/* Preview banner */}
      <div className="sticky top-0 z-[100] bg-[#1A1816] text-white text-center py-2 px-4 text-[13px] font-medium">
        Preview Mode — this is how your listing appears to buyers
      </div>

      {/* Sticky Navbar */}
      <nav className="sticky top-8 z-50 bg-white border-b border-[#E8E8E4] h-14 flex items-center px-4 sm:px-6">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          {/* Left: Back to My Listings */}
          <Link
            href="/properties"
            className="flex items-center gap-1.5 text-[#737370] hover:text-[#1A1816] text-sm transition-colors relative z-[50]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to My Listings</span>
          </Link>

          {/* Center: Logo */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <img src="/assets/logo.svg" alt="DeelMap" className="h-[44px] w-auto object-contain" />
          </div>

          {/* Right: Share + Save */}
          <div className="flex items-center gap-2">
            <button
              onClick={intercept}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E8E8E4] bg-white text-[#444441] hover:bg-[#FAFAF8] transition-colors text-sm font-medium"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <button
              onClick={intercept}
              title="Disabled in preview"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E8E8E4] bg-[#F3F3F1] text-[#A8A8A4] cursor-not-allowed transition-colors text-sm font-medium"
            >
              <Heart className="h-4 w-4" />
              <span className="hidden sm:inline">Save</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Photo Grid */}
      <div className="bg-white border-b border-[#E8E8E4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className={`relative h-[260px] sm:h-[460px] rounded overflow-hidden grid gap-[6px] ${photos.length > 1 ? 'sm:grid-cols-2' : ''} grid-cols-1`}>
            {/* Main photo — full width on mobile, left half on sm+ */}
            <div
              className="relative bg-[#E8E8E4] cursor-pointer overflow-hidden rounded"
              onClick={() => { if (photos.length > 0) { setImageModalIndex(0); setShowImageModal(true) } }}
            >
              {photos.length > 0 ? (
                <img
                  src={photos[0].image_url}
                  alt="Main property photo"
                  className="absolute inset-0 w-full h-full object-cover hover:brightness-95 transition-all duration-200"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <img src="/assets/logo.svg" alt="DeelMap" className="w-36 h-10 object-contain opacity-30" />
                  <span className="text-sm text-[#A8A8A4]">Photos coming soon</span>
                </div>
              )}
              {/* Mobile-only: Show all photos button on main photo */}
              {photos.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setImageModalIndex(0); setShowImageModal(true) }}
                  className="sm:hidden absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-[#E8E8E4] text-[#1A1816] text-[13px] font-semibold px-3 py-1.5 rounded shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="1.5"/></svg>
                  Show all photos
                </button>
              )}
            </div>

            {/* Right 2×2 grid — hidden on mobile */}
            {photos.length > 1 && (
              <div className="hidden sm:grid grid-cols-2 grid-rows-2 gap-[6px]">
                {[1, 2, 3, 4].map((offset) => {
                  const photo = photos[offset]
                  const isLast = offset === 4
                  return (
                    <div
                      key={offset}
                      className="relative bg-[#E8E8E4] cursor-pointer overflow-hidden rounded"
                      onClick={() => { setImageModalIndex(offset < photos.length ? offset : 0); setShowImageModal(true) }}
                    >
                      {photo ? (
                        <img
                          src={photo.image_url}
                          alt={`Property photo ${offset + 1}`}
                          className="absolute inset-0 w-full h-full object-cover hover:brightness-95 transition-all duration-200"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[#E8E8E4]" />
                      )}
                      {isLast && photos.length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setImageModalIndex(0); setShowImageModal(true) }}
                          className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/90 hover:bg-white backdrop-blur-sm border border-[#E8E8E4] text-[#1A1816] text-[13px] font-semibold px-3 py-1.5 rounded shadow-sm transition-all duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="1.5"/></svg>
                          Show all photos
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Left column */}
          <div className="flex-1 min-w-0">

            {/* Property overview card */}
            <div className="bg-white border border-[#E8E8E4] rounded p-5 mb-6">
              {(property.city || property.state) && (
                <div className="flex items-center gap-1.5 text-[#737370] text-[13px] mb-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{[property.city, property.state].filter(Boolean).join(', ')}</span>
                </div>
              )}

              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-[22px] sm:text-[26px] font-bold text-[#1A1816] leading-snug break-words">{fullAddress}</h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#E4F5EC] text-[#0F6E56] text-[13px] font-semibold rounded border border-[#9FDBB8] flex-shrink-0 mt-1">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A] inline-block" />
                  {property.property_status || 'Available'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[#444441] text-[14px] mb-4">
                {property.floor_area && <span><span className="font-semibold">{Number(property.floor_area).toLocaleString()}</span> sq ft</span>}
                {property.bedrooms && (
                  <><span className="text-[#D4D4CF]">·</span><span><span className="font-semibold">{property.bedrooms}</span> bed</span></>
                )}
                {property.bathrooms && (
                  <><span className="text-[#D4D4CF]">·</span><span><span className="font-semibold">{property.bathrooms}</span> bath</span></>
                )}
              </div>

              <div className="border-t border-[#E8E8E4] mb-4" />

              {property.description && (
                <div className="mb-4">
                  <div
                    className="text-[14px] text-[#444441] leading-relaxed break-words"
                    dangerouslySetInnerHTML={{
                      __html: showFullDescription || property.description.length <= 300
                        ? property.description
                        : `${property.description.substring(0, 300)}...`
                    }}
                  />
                  {property.description.length > 300 && (
                    <button
                      onClick={() => setShowFullDescription(v => !v)}
                      className="text-[#D03839] hover:text-[#E0493B] text-[13px] font-medium mt-2 flex items-center gap-1 transition-colors"
                    >
                      {showFullDescription ? 'Show less' : 'Show more'}
                      <svg className={`w-4 h-4 transition-transform ${showFullDescription ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Return Calculator */}
            <div className="bg-white border border-[#E8E8E4] rounded p-4 sm:p-6 mb-6">
              <h3 className="text-sm font-semibold text-[#A8A8A4] uppercase tracking-[1.1px] mb-4">Return Calculator</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-[#737370] mb-1.5">Purchase price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737370] text-sm">$</span>
                    <input type="number" value={purchasePrice ?? ''} onChange={e => setPurchasePrice(e.target.value === '' ? null : parseFloat(e.target.value) || null)}
                      className="w-full h-10 pl-7 pr-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:ring-2 focus:ring-[#D03839]/[.12] outline-none text-sm text-[#1A1816]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#737370] mb-1.5">Down payment</label>
                  <div className="relative">
                    <input type="number" value={downPaymentPercent || ''} onChange={e => setDownPaymentPercent(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 pr-7 pl-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:ring-2 focus:ring-[#D03839]/[.12] outline-none text-sm text-[#1A1816]" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737370] text-sm">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#737370] mb-1.5">Estimated rent</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737370] text-sm">$</span>
                    <input type="number" value={estimatedRent ?? ''} onChange={e => setEstimatedRent(e.target.value === '' ? null : parseFloat(e.target.value) || null)}
                      className="w-full h-10 pl-7 pr-3 border border-[#E8E8E4] rounded focus:border-[#D03839] focus:ring-2 focus:ring-[#D03839]/[.12] outline-none text-sm text-[#1A1816]" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-[#A8A8A4]">Enter values above to calculate your estimated returns and cash flow projections.</p>
            </div>

            {/* Property Snapshot */}
            {snapshotItems.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-[#D03839] uppercase tracking-[1.1px] mb-3">Property Snapshot</h3>
                <div className="bg-white border border-[#E8E8E4] rounded p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                    {snapshotItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 flex-shrink-0 bg-[#F5F5F3] rounded flex items-center justify-center text-[#444441]">{item.icon}</div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[#1A1816] leading-snug truncate">{item.value}</p>
                          <p className="text-[12px] text-[#737370]">{item.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Investment Highlights */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-[#D03839] uppercase tracking-[1.1px] mb-3">Investment Highlights</h3>
              <div className="grid grid-cols-2 gap-3">
                {investmentHighlights.map((item, i) => {
                  const icons = [
                    <TrendingUp key={0} className="w-4 h-4 text-[#0F6E56]" />,
                    <Shield key={1} className="w-4 h-4 text-[#0F6E56]" />,
                    <Star key={2} className="w-4 h-4 text-[#0F6E56]" />,
                    <DollarSign key={3} className="w-4 h-4 text-[#0F6E56]" />,
                  ]
                  return (
                    <div key={i} className="bg-white border border-[#E8E8E4] rounded p-4">
                      <div className="w-8 h-8 rounded bg-[#E4F5EC] flex items-center justify-center mb-3">{icons[i % icons.length]}</div>
                      <div className="text-sm font-semibold text-[#1A1816] mb-1">{item.title}</div>
                      <div className="text-xs text-[#737370] leading-relaxed">{item.desc}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Condition & Rehab */}
            {property.repairs && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-[#D03839] uppercase tracking-[1.1px] mb-3">Condition &amp; Rehab</h3>
                <div className="bg-white border border-[#E8E8E4] rounded p-4">
                  <div
                    className="text-sm text-[#444441] leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: property.repairs }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="lg:w-[380px] shrink-0">
            <div className="sticky top-24">
              <div className="bg-white border border-[#E8E8E4] rounded p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-medium text-[#737370]">Price</span>
                  <span className="text-[22px] font-bold text-[#1A1816]">{formatPrice(property.price)}</span>
                </div>
                {arv && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-medium text-[#737370]">ARV</span>
                    <span className="text-[16px] font-semibold text-[#0F6E56]">{formatPrice(arv)}</span>
                  </div>
                )}
                <hr className="border-[#E8E8E4] mb-3" />
                {estimatedProfit != null && estimatedProfit > 0 && (
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[13px] font-medium text-[#737370]">Estimated Profit</span>
                    <span className="text-[16px] font-semibold text-[#0F6E56]">{formatPrice(estimatedProfit)}</span>
                  </div>
                )}

                {/* Call Seller — phone is safe to reveal in preview */}
                <div className="mb-3">
                  {showPhone ? (
                    sellerPhone ? (
                      <a
                        href={`tel:${sellerPhone}`}
                        className="flex items-center justify-center gap-2 w-full font-semibold py-2.5 px-4 rounded text-sm bg-[#1A1816] hover:bg-[#2C2A28] text-white transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        {sellerPhone}
                      </a>
                    ) : (
                      <div className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded text-sm bg-[#FAFAF8] border border-[#E8E8E4] text-[#737370]">
                        <Phone className="w-4 h-4" />
                        No phone number on file
                      </div>
                    )
                  ) : (
                    <button
                      onClick={() => setShowPhone(true)}
                      className="flex items-center justify-center gap-2 w-full font-semibold py-2.5 px-4 rounded text-sm bg-[#1A1816] hover:bg-[#2C2A28] text-white transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      Call Seller
                    </button>
                  )}
                </div>

                {/* Message Seller — disabled in preview (would start a real chat) */}
                <button
                  onClick={intercept}
                  title="Disabled in preview"
                  className="block w-full bg-[#F3F3F1] text-[#A8A8A4] border border-[#E8E8E4] font-semibold py-2.5 px-4 rounded text-center text-sm cursor-not-allowed mb-3"
                >
                  Message Seller
                </button>

                {/* Make Offer — disabled in preview */}
                <button
                  onClick={intercept}
                  title="Disabled in preview"
                  className="block w-full bg-[#F3F3F1] text-[#A8A8A4] border border-[#E8E8E4] font-semibold py-2.5 px-4 rounded text-center text-sm cursor-not-allowed"
                >
                  Make Offer
                </button>
                <p className="text-[12px] text-[#A8A8A4] text-center mt-2">Buyer actions are disabled in preview.</p>
              </div>

              {/* Map */}
              <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
                <div ref={mapRef} className="w-full h-[280px] sm:h-[320px]" style={{ minHeight: '280px' }} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Similar Properties */}
      {visibleSimilar.length > 0 && (
        <div className="bg-[#FAFAF8] border-t border-[#E8E8E4] py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] font-bold text-[#1A1816]">Similar Properties Nearby</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSimilarSliderIndex(i => Math.max(0, i - 1))}
                  disabled={similarSliderIndex === 0}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-[#E8E8E4] bg-white text-[#737370] hover:border-[#1A1816] hover:text-[#1A1816] transition-colors disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSimilarSliderIndex(i => Math.min(totalSimPages - 1, i + 1))}
                  disabled={similarSliderIndex >= totalSimPages - 1}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-[#E8E8E4] bg-white text-[#737370] hover:border-[#1A1816] hover:text-[#1A1816] transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {visibleSimilar.map(p => {
                const featuredImg = (p.property_images || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0]
                const imgUrl = featuredImg?.image_url || ''
                const cityState = [p.city, p.state].filter(Boolean).join(', ')
                const pPrice = Number(p.price) || 0
                const title = p.address || p.title || cityState || 'Address unavailable'
                return (
                  <div key={p.id} className="bg-white rounded overflow-hidden hover:shadow-xl transition-shadow duration-200 flex flex-col">
                    <div className="relative h-[200px] bg-[#FAFAF8] flex-shrink-0 overflow-hidden">
                      {imgUrl ? (
                        <img src={imgUrl} alt={cityState} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Home className="w-8 h-8 text-[#E8E8E4]" />
                        </div>
                      )}
                      <div className="absolute top-2.5 left-2.5">
                        <span className="text-[11px] font-semibold px-2 py-1 rounded bg-[#E4F5EC] text-[#0F6E56] border border-[#9FDBB8]">New Deal</span>
                      </div>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-center gap-1 mb-2">
                        <MapPin className="w-3 h-3 text-[#A8A8A4] flex-shrink-0" />
                        <span className="text-[12px] text-[#737370] truncate">{cityState || 'Location unavailable'}</span>
                      </div>
                      <h3 className="text-[15px] font-bold text-[#1A1816] mb-1.5 leading-snug line-clamp-1">{title}</h3>
                      <div className="flex items-center gap-2 text-[12px] text-[#737370] mb-3">
                        {p.floor_area && <span>{Number(p.floor_area).toLocaleString()} sq ft</span>}
                        {p.floor_area && p.bedrooms && <span>·</span>}
                        {p.bedrooms && <span>{p.bedrooms} bed</span>}
                        {p.bedrooms && p.bathrooms && <span>·</span>}
                        {p.bathrooms && <span>{p.bathrooms} bath</span>}
                      </div>
                      <span className="text-[20px] font-bold text-[#1A1816]">{pPrice ? `$${pPrice.toLocaleString()}` : 'Contact for Price'}</span>
                      <div className="mt-auto pt-3 flex justify-end">
                        <button
                          onClick={intercept}
                          className="px-4 py-2 bg-[#1A1816] text-white text-[12px] font-semibold rounded hover:bg-[#333] transition-colors"
                        >
                          View Listing
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
