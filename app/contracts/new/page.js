'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DocusealForm } from '@docuseal/react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  PenLine,
  Send,
  Check,
  User,
  AlertCircle,
} from 'lucide-react'
import SaveStatus from '@/components/properties/SaveStatus'
import StickyActionBar from '@/components/properties/StickyActionBar'
import { decorateTemplates } from '@/lib/contract-templates'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

function fmtFee(cents) {
  return `$${((cents || 0) / 100).toFixed(2)}`
}

// Stripe card form shown when the contract fee needs an on-session card / 3DS.
function ContractPayForm({ amount, onSuccess }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [err, setErr] = useState(null)

  async function handlePay(e) {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    setErr(null)
    const { error: submitErr } = await elements.submit()
    if (submitErr) { setErr(submitErr.message); setProcessing(false); return }
    const { error: confirmErr } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    if (confirmErr) {
      setErr(confirmErr.message || 'Payment failed. Please try another card.')
      setProcessing(false)
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement />
      {err && <div className="p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[13px] text-[#D03839]">{err}</div>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full h-[48px] bg-[#D03839] hover:bg-[#B8102A] active:scale-[0.98] text-white text-[14px] font-semibold rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(208,56,57,0.25)]"
      >
        {processing ? <>Processing…</> : `Pay ${fmtFee(amount)} & send contract`}
      </button>
    </form>
  )
}

const STEP_NAMES = ['Start', 'Property', 'Buyer info', 'Seller info', 'Terms', 'Review']
const NUM_STEPS = STEP_NAMES.length

function fmtPrice(v) {
  if (v === '' || v == null) return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtDate(v) {
  if (!v) return '—'
  try { return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return String(v) }
}
const todayISOf = () => new Date().toISOString().slice(0, 10)

const INPUT_CLS = 'w-full h-10 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#D03839] focus:ring-1 focus:ring-[#D03839]/20'
const LABEL_CLS = 'block text-[12px] font-semibold text-[#444441] mb-1.5'

function roleLabels(isAssignment) {
  return isAssignment ? { buyer: 'Assignee', seller: 'Assignor' } : { buyer: 'Buyer', seller: 'Seller' }
}

export default function NewContractWizardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeDraftId = searchParams.get('draft_id')

  // ── Identity / workspace context ────────────────────────────────
  const [userId, setUserId] = useState(null)
  const [accountEmail, setAccountEmail] = useState(null)
  const [accountName, setAccountName] = useState('')
  const [effectiveSellerId, setEffectiveSellerId] = useState(null)
  const [effectiveEmail, setEffectiveEmail] = useState(null)
  const [effectiveName, setEffectiveName] = useState('')

  // ── Wizard state ─────────────────────────────────────────────────
  const [step, setStep] = useState(1)
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [properties, setProperties] = useState([])
  const [propertiesLoading, setPropertiesLoading] = useState(true)

  const [templateId, setTemplateId] = useState('')
  const [contractRole, setContractRole] = useState('') // 'seller' | 'buyer'
  const [propertyId, setPropertyId] = useState('') // '' | 'manual' | <uuid>

  // Both parties collected explicitly. The creator's side is prefilled from their account.
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [sellerPartyName, setSellerPartyName] = useState('')
  const [sellerPartyEmail, setSellerPartyEmail] = useState('')

  const acceptanceDefaultISO = (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10) })()

  // Profile defaults — saved in localStorage when the seller fills closing details.
  const SAVED_DEFAULTS_KEY = 'seller_contract_defaults'
  const loadSavedDefaults = () => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(SAVED_DEFAULTS_KEY) : null
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  }
  const persistDefault = (key, value) => {
    try {
      const cur = loadSavedDefaults()
      if (value && String(value).trim()) cur[key] = value
      else delete cur[key]
      localStorage.setItem(SAVED_DEFAULTS_KEY, JSON.stringify(cur))
    } catch {}
  }
  const savedDefaults = loadSavedDefaults()

  const [fieldValues, setFieldValues] = useState({
    property_address:    '',
    purchase_price:      '',
    emd:                 '',
    closing_date:        '',
    special_terms:       '',
    financing_type:      '',
    seller_address:      savedDefaults.seller_address || '',
    buyer_address:       '',
    property_tax_id:     '',
    other_description:   '',
    co_seller_name:      '',
    co_buyer_name:       '',
    emd_escrow:          savedDefaults.emd_escrow || '',
    due_diligence_days:  '14',
    acceptance_deadline: acceptanceDefaultISO,
    closing_location:    savedDefaults.closing_location || '',
    original_seller_name: '',
    original_psa_date:    '',
  })

  // ── Auto-save state ─────────────────────────────────────────────
  const [currentDraftId, setCurrentDraftId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [autoSaveError, setAutoSaveError] = useState(null)
  const [readyForAutoSave, setReadyForAutoSave] = useState(false)
  const inFlightSaveRef = useRef(false)

  // ── Send state ──────────────────────────────────────────────────
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [signingEmbedSrc, setSigningEmbedSrc] = useState(null)
  const [signingTitle, setSigningTitle] = useState('')
  const [sentInfo, setSentInfo] = useState(null) // { firstSignerName } when the counterparty signs first
  const [payClientSecret, setPayClientSecret] = useState(null)
  const [payAmount, setPayAmount] = useState(299)

  const template = templates.find(t => String(t.id) === String(templateId))
  const isAssignment = template?.slug === 'assignment'
  const L = roleLabels(isAssignment)

  // ── Identity bootstrap ──────────────────────────────────────────
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('seller_user') : null
    if (!raw) return
    const u = JSON.parse(raw)
    setUserId(u.id)
    setAccountEmail(u.email)
    const myName = u.contactPersonName || u.businessName || u.name || u.full_name || u.first_name || ''
    setAccountName(myName)
    setEffectiveEmail(u.email)
    setEffectiveName(myName)
    setEffectiveSellerId(u.id)

    fetch('/api/team/workspaces', { headers: { Authorization: `Bearer ${u.id}` } })
      .then(r => r.json())
      .then(ws => {
        const eff = ws?.current?.effectiveSellerId || u.id
        setEffectiveSellerId(eff)
        if (eff !== u.id) {
          fetch(`/api/team/owner-info?sellerId=${eff}`)
            .then(r => r.json())
            .then(info => {
              if (info?.email) setEffectiveEmail(info.email)
              if (info?.name) setEffectiveName(info.name)
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [])

  // Prefill the creator's own side once they pick a role.
  useEffect(() => {
    if (!contractRole) return
    const myName = effectiveName || accountName || ''
    const myEmail = effectiveEmail || accountEmail || ''
    if (contractRole === 'seller') {
      setSellerPartyName(prev => prev || myName); setSellerPartyEmail(prev => prev || myEmail)
      setBuyerName(prev => prev === myName ? '' : prev); setBuyerEmail(prev => prev === myEmail ? '' : prev)
    } else if (contractRole === 'buyer') {
      setBuyerName(prev => prev || myName); setBuyerEmail(prev => prev || myEmail)
      setSellerPartyName(prev => prev === myName ? '' : prev); setSellerPartyEmail(prev => prev === myEmail ? '' : prev)
    }
  }, [contractRole, effectiveName, effectiveEmail, accountName, accountEmail])

  // ── Load templates ──────────────────────────────────────────────
  useEffect(() => {
    setTemplatesLoading(true)
    fetch('/api/contracts?type=templates')
      .then(r => r.json())
      .then(raw => setTemplates(decorateTemplates(raw)))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false))
  }, [])

  useEffect(() => {
    if (templatesLoading || !templateId || templates.length === 0) return
    if (!templates.some(t => String(t.id) === String(templateId))) { setTemplateId(''); setStep(1) }
  }, [templates, templatesLoading, templateId])

  // ── Load properties for the dropdown ────────────────────────────
  useEffect(() => {
    if (!effectiveSellerId) return
    setPropertiesLoading(true)
    supabase
      .from('properties')
      .select('id, address, price, bedrooms, bathrooms, floor_area, slug, status')
      .eq('seller_id', effectiveSellerId)
      .in('status', ['active', 'inactive'])
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => { if (!error && data) setProperties(data) })
      .finally(() => setPropertiesLoading(false))
  }, [effectiveSellerId])

  // ── Resume an existing draft ────────────────────────────────────
  useEffect(() => {
    if (!resumeDraftId) return
    fetch(`/api/contracts/drafts/${resumeDraftId}`)
      .then(r => r.json())
      .then(d => {
        if (!d || d.error) return
        setCurrentDraftId(d.id)
        if (d.template_id) setTemplateId(String(d.template_id))
        if (d.property_id) setPropertyId(d.property_id)
        if (d.buyer_name) setBuyerName(d.buyer_name)
        if (d.buyer_email) setBuyerEmail(d.buyer_email)
        if (d.field_values && typeof d.field_values === 'object') {
          const fv = d.field_values
          if (fv.__contract_role) setContractRole(fv.__contract_role)
          if (fv.__seller_name) setSellerPartyName(fv.__seller_name)
          if (fv.__seller_email) setSellerPartyEmail(fv.__seller_email)
          setFieldValues(prev => ({ ...prev, ...fv }))
        }
        setStep(1)
      })
      .catch(() => {})
  }, [resumeDraftId])

  // ── Prefill from an accepted offer (?from_offer=…) ──────────────
  const fromOfferId = searchParams.get('from_offer')
  const appliedOfferRef = useRef(false)
  useEffect(() => {
    if (!fromOfferId || appliedOfferRef.current) return
    if (!effectiveSellerId) return
    if (templatesLoading || templates.length === 0) return
    if (propertiesLoading) return
    appliedOfferRef.current = true

    ;(async () => {
      try {
        const res = await fetch(`/api/seller/offers?offer_id=${encodeURIComponent(fromOfferId)}`, {
          headers: { Authorization: `Bearer ${userId}` },
        })
        const json = await res.json()
        const o = json?.offer
        if (!o) { appliedOfferRef.current = false; return }

        // Accepting an investor's offer = assigning the deal → default Assignment,
        // and the creator is the Assignor (Seller side).
        const assignment = templates.find(t => t.slug === 'assignment') || templates[0]
        if (assignment) setTemplateId(String(assignment.id))
        setContractRole('seller')

        const match = properties.find(pp => String(pp.id) === String(o.property_id))
        if (match) setPropertyId(match.id)
        else if (o.property_address) setPropertyId('manual')

        if (o.buyer_name && o.buyer_name !== 'Buyer') setBuyerName(o.buyer_name)
        if (o.buyer_email) setBuyerEmail(o.buyer_email)

        const next = {}
        if (o.offer_price != null) next.purchase_price = String(Math.round(Number(o.offer_price)))
        if (o.earnest_money != null && o.earnest_money !== '') next.emd = String(Math.round(Number(o.earnest_money)))
        if (match) next.property_address = match.address || o.property_address || ''
        else if (o.property_address) next.property_address = o.property_address
        if (o.financing_type) next.financing_type = /cash/i.test(String(o.financing_type)) ? 'cash' : 'financing'
        const insp = String(o.inspection_period ?? '').match(/\d+/)
        if (insp) next.due_diligence_days = insp[0]
        const noteLines = []
        if (o.closing_timeline) {
          const days = String(o.closing_timeline).match(/\d+/)
          if (days) { const d = new Date(); d.setDate(d.getDate() + parseInt(days[0], 10)); next.closing_date = d.toISOString().slice(0, 10) }
          noteLines.push(`Buyer's requested closing timeline: ${o.closing_timeline}`)
        }
        if (o.notes) noteLines.push(String(o.notes))
        if (noteLines.length) next.special_terms = noteLines.join('\n')

        setFieldValues(prev => ({ ...prev, ...next }))
        setDirty(true)
        setStep(NUM_STEPS) // jump to Review
      } catch {
        appliedOfferRef.current = false
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromOfferId, effectiveSellerId, templatesLoading, templates, propertiesLoading, properties, userId])

  function handlePropertyChange(value) {
    setPropertyId(value)
    setDirty(true)
    if (value === '' || value === 'manual') return
    const p = properties.find(pp => pp.id === value)
    if (p) setFieldValues(prev => ({ ...prev, property_address: p.address || '' }))
  }

  function setField(key, value) {
    setFieldValues(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  function buildDraftPayload() {
    return {
      seller_id: effectiveSellerId,
      template_id: templateId || '',
      property_id: propertyId && propertyId !== 'manual' ? propertyId : null,
      buyer_name: buyerName || null,
      buyer_email: buyerEmail || null,
      field_values: {
        ...fieldValues,
        __contract_role: contractRole || '',
        __seller_name: sellerPartyName || '',
        __seller_email: sellerPartyEmail || '',
      },
    }
  }

  useEffect(() => {
    if (effectiveSellerId && templateId && contractRole && !readyForAutoSave) setReadyForAutoSave(true)
  }, [effectiveSellerId, templateId, contractRole, readyForAutoSave])

  useEffect(() => {
    if (!readyForAutoSave || !dirty) return
    if (autoSaving || inFlightSaveRef.current) return
    if (!effectiveSellerId || !templateId) return

    const timer = setTimeout(async () => {
      inFlightSaveRef.current = true
      setAutoSaving(true); setAutoSaveError(null)
      try {
        const payload = buildDraftPayload()
        if (currentDraftId) {
          const res = await fetch(`/api/contracts/drafts/${currentDraftId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
          const json = await res.json()
          if (!res.ok || json.error) throw new Error(json.error || 'Save failed')
        } else {
          const hasMeaningfulInput = !!payload.property_id || !!(payload.field_values && payload.field_values.property_address) || !!payload.buyer_name || !!payload.buyer_email
          if (!hasMeaningfulInput) { setDirty(false); return }
          const res = await fetch('/api/contracts/drafts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
          const json = await res.json()
          if (!res.ok || json.error || !json.id) throw new Error(json.error || 'Save failed')
          setCurrentDraftId(json.id)
        }
        setLastSavedAt(new Date()); setDirty(false)
      } catch (e) {
        setAutoSaveError(e?.message || "Couldn't save")
      } finally {
        setAutoSaving(false); inFlightSaveRef.current = false
      }
    }, 2000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, readyForAutoSave, templateId, contractRole, propertyId, buyerName, buyerEmail, sellerPartyName, sellerPartyEmail, fieldValues, currentDraftId, autoSaving])

  // ── Step validation ─────────────────────────────────────────────
  const selfDeal = !!buyerEmail && !!sellerPartyEmail && buyerEmail.trim().toLowerCase() === sellerPartyEmail.trim().toLowerCase()

  function canContinueFromStep(s) {
    if (s === 1) return !!templateId && !!contractRole
    if (s === 2) {
      if (propertyId && propertyId !== 'manual') return true
      if (propertyId === 'manual' && (fieldValues.property_address || '').trim().length > 0) return true
      return false
    }
    if (s === 3) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((buyerEmail || '').trim()) && (buyerName || '').trim().length > 0
    if (s === 4) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((sellerPartyEmail || '').trim()) && (sellerPartyName || '').trim().length > 0
    if (s === 5) {
      const filled = k => String(fieldValues[k] ?? '').trim().length > 0
      if (!filled('purchase_price') || !filled('emd') || !filled('closing_date')) return false
      if (isAssignment && (!filled('original_seller_name') || !filled('original_psa_date'))) return false
      const t = todayISOf()
      if (fieldValues.closing_date && fieldValues.closing_date < t) return false
      if (fieldValues.acceptance_deadline && fieldValues.acceptance_deadline < t) return false
      // The original purchase contract was already signed — can't be in the future
      if (fieldValues.original_psa_date && fieldValues.original_psa_date > t) return false
      return true
    }
    return true
  }

  function handleContinue() {
    if (!canContinueFromStep(step)) return
    setStep(s => Math.min(NUM_STEPS, s + 1))
  }
  function handleBack() {
    if (step === 1) { router.push('/contracts'); return }
    setStep(s => Math.max(1, s - 1))
  }

  // ── Send (payment gate → create submission) ─────────────────────
  async function handleSend() {
    if (!effectiveSellerId) return
    if (!templateId) { setSendError('Pick a contract type first.'); setStep(1); return }
    if (!buyerEmail) { setSendError(`${L.buyer} email is required.`); setStep(3); return }
    if (!sellerPartyEmail) { setSendError(`${L.seller} email is required.`); setStep(4); return }
    if (selfDeal) { setSendError(`The ${L.buyer.toLowerCase()} and ${L.seller.toLowerCase()} can't use the same email.`); setStep(4); return }
    if (!canContinueFromStep(5)) { setSendError('Please fill in all required deal terms before sending.'); setStep(5); return }

    setSending(true); setSendError(null)

    let draftId = currentDraftId
    try {
      const payload = buildDraftPayload()
      if (currentDraftId) {
        await fetch(`/api/contracts/drafts/${currentDraftId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      } else {
        const res = await fetch('/api/contracts/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const json = await res.json()
        if (json?.id) { draftId = json.id; setCurrentDraftId(json.id) }
      }
    } catch { /* non-fatal */ }

    try {
      const payRes = await fetch('/api/contracts/pay', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userId}` },
        body: JSON.stringify({ seller_id: effectiveSellerId, draft_id: draftId }),
      })
      const payData = await payRes.json().catch(() => ({}))
      if (!payRes.ok) { setSendError(payData.error || 'Payment could not be started.'); setSending(false); return }
      if (payData.free || payData.paid) { await doSend(); return }
      if (payData.clientSecret) { setPayAmount(payData.amount || 299); setPayClientSecret(payData.clientSecret); setSending(false); return }
      setSendError('Payment could not be started. Please try again.'); setSending(false)
    } catch {
      setSendError('Payment could not be started. Please try again.'); setSending(false)
    }
  }

  async function doSend() {
    setSending(true); setSendError(null)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractRole,
          buyerName: buyerName || '',
          buyerEmail,
          sellerName: sellerPartyName,
          sellerEmail: sellerPartyEmail,
          property: fieldValues.property_address || '',
          templateId,
          field_values: fieldValues,
          draft_id: currentDraftId,
          offer_id: fromOfferId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setSendError(data.error || 'Failed to send contract.'); return }
      if (data.embed_src) {
        setSigningTitle(fieldValues.property_address || 'New Contract')
        setSigningEmbedSrc(data.embed_src)
      } else {
        setSentInfo({ firstSignerName: data.firstSignerName || sellerPartyName || 'the seller' })
      }
    } catch {
      setSendError('Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  // ── Render: payment screen ──────────────────────────────────────
  if (payClientSecret && stripePromise) {
    return (
      <div className="p-4 lg:p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setPayClientSecret(null); setSending(false) }} className="flex items-center gap-1.5 text-[13px] text-[#737370] hover:text-[#1A1816] transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to contract
          </button>
        </div>
        <div className="max-w-[460px] mx-auto">
          <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E8E8E4] flex items-center gap-3">
              <div className="w-9 h-9 bg-[#D03839]/10 rounded flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-[#D03839]" /></div>
              <div>
                <h1 className="text-[16px] font-bold text-[#1A1816] leading-tight">Send contract</h1>
                <p className="text-[12px] text-[#737370]">Pay the one-time fee to send it for signature</p>
              </div>
            </div>
            <div className="px-5 py-4 border-b border-[#E8E8E4]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-[#1A1816]">Contract</p>
                  {fieldValues.property_address ? <p className="text-[12px] text-[#737370] mt-0.5">{fieldValues.property_address}</p> : null}
                </div>
                <p className="text-[14px] font-bold text-[#1A1816] whitespace-nowrap">{fmtFee(payAmount)}</p>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E8E8E4]">
                <span className="text-[13px] font-semibold text-[#1A1816]">Total due</span>
                <span className="text-[16px] font-bold text-[#1A1816]">{fmtFee(payAmount)}</span>
              </div>
            </div>
            <div className="p-5">
              <Elements stripe={stripePromise} options={{ clientSecret: payClientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#D03839' } } }}>
                <ContractPayForm amount={payAmount} onSuccess={() => { setPayClientSecret(null); doSend() }} />
              </Elements>
            </div>
            <div className="px-5 py-3.5 bg-[#FAFAF8] border-t border-[#E8E8E4] text-center">
              <span className="text-[12px] text-[#737370]">Secured by Stripe · One-time charge, no subscription</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: inline signing view ─────────────────────────────────
  if (signingEmbedSrc) {
    return (
      <div className="p-4 lg:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-[#D03839]/10 rounded flex items-center justify-center shrink-0"><PenLine className="w-4 h-4 text-[#D03839]" /></div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1816] leading-tight">{signingTitle}</h1>
            <p className="text-[13px] text-[#737370]">Review and sign below — the {L.buyer.toLowerCase()} gets a signing link once the {L.seller.toLowerCase()} signs.</p>
          </div>
        </div>
        <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
          <DocusealForm
            src={signingEmbedSrc}
            email={effectiveEmail || accountEmail}
            withTitle={false}
            withDownloadButton={false}
            customCss={`body { font-family: 'DM Sans', -apple-system, sans-serif !important; } .base-button { background: #D03839 !important; border-color: #D03839 !important; border-radius: 4px !important; } .base-button:hover { background: #E0493B !important; }`}
            onComplete={() => router.push('/contracts')}
          />
        </div>
      </div>
    )
  }

  // ── Render: sent (counterparty signs first) ─────────────────────
  if (sentInfo) {
    return (
      <div className="p-4 lg:p-6 max-w-[480px] mx-auto">
        <div className="bg-white border border-[#E8E8E4] rounded p-8 text-center">
          <div className="w-12 h-12 bg-[#E4F5EC] rounded-full flex items-center justify-center mx-auto mb-4"><Check className="w-6 h-6 text-[#0F6E56]" /></div>
          <h1 className="text-[18px] font-bold text-[#1A1816] mb-1.5">Contract sent</h1>
          <p className="text-[13px] text-[#737370] leading-relaxed">
            It's been sent to <span className="font-semibold text-[#1A1816]">{sentInfo.firstSignerName}</span> (the {L.seller.toLowerCase()}) to sign first.
            You'll get a signing link by email as soon as they do.
          </p>
          <button onClick={() => router.push('/contracts')} className="mt-6 h-10 px-5 inline-flex items-center gap-1.5 text-[13px] font-semibold bg-[#1A1816] text-white rounded hover:bg-black">Go to Contracts</button>
        </div>
      </div>
    )
  }

  // ── Render: wizard ──────────────────────────────────────────────
  const stepName = STEP_NAMES[step - 1]

  return (
    <div className="p-4 lg:p-6 pb-24 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-[#1A1816] truncate">
            New Contract <span className="text-[#A8A8A4] font-normal">— Step {step} of {NUM_STEPS} · {stepName}</span>
          </h1>
          <div className="mt-0.5">
            <SaveStatus autoSaving={autoSaving} lastSavedAt={lastSavedAt} dirty={dirty} error={autoSaveError} status="draft" />
          </div>
        </div>
      </div>

      <div className={step >= 2 ? 'grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-6 items-start' : ''}>
        <div className="min-w-0 space-y-4">

      <div className="flex items-center gap-1.5">
        {STEP_NAMES.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i + 1 <= step ? 'bg-[#D03839]' : 'bg-[#E8E8E4]'}`} />)}
      </div>

      <div className="bg-white border border-[#E8E8E4] rounded p-4 md:p-6">
        {step === 1 && <Step1Setup templates={templates} templatesLoading={templatesLoading} templateId={templateId} onSelectTemplate={(id) => { setTemplateId(String(id)); setDirty(true) }} contractRole={contractRole} onSelectRole={(r) => { setContractRole(r); setDirty(true) }} />}
        {step === 2 && <Step2Property properties={properties} propertiesLoading={propertiesLoading} propertyId={propertyId} onChange={handlePropertyChange} manualAddress={fieldValues.property_address} onManualAddressChange={(v) => setField('property_address', v)} />}
        {step === 3 && <StepPartyInfo party="buyer" L={L} isYou={contractRole === 'buyer'} name={buyerName} email={buyerEmail} address={fieldValues.buyer_address} coName={fieldValues.co_buyer_name} onName={(v) => { setBuyerName(v); setDirty(true) }} onEmail={(v) => { setBuyerEmail(v); setDirty(true) }} onAddress={v => setField('buyer_address', v)} onCoName={v => setField('co_buyer_name', v)} />}
        {step === 4 && <StepPartyInfo party="seller" L={L} isYou={contractRole === 'seller'} name={sellerPartyName} email={sellerPartyEmail} address={fieldValues.seller_address} coName={fieldValues.co_seller_name} onName={(v) => { setSellerPartyName(v); setDirty(true) }} onEmail={(v) => { setSellerPartyEmail(v); setDirty(true) }} onAddress={v => setField('seller_address', v)} onCoName={v => setField('co_seller_name', v)} />}
        {step === 5 && <Step5Terms values={fieldValues} onChange={setField} template={template} L={L} onPersistDefault={persistDefault} />}
        {step === 6 && <Step6Review template={template} L={L} fieldValues={fieldValues} buyerName={buyerName} buyerEmail={buyerEmail} sellerName={sellerPartyName} sellerEmail={sellerPartyEmail} contractRole={contractRole} selfDeal={selfDeal} onJump={setStep} />}
      </div>

      {sendError && (
        <div className="flex items-start gap-3 p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[#B82F30]">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium flex-1">{sendError}</p>
        </div>
      )}
        </div>

        {step >= 2 && (
          <div className="hidden lg:block lg:sticky lg:top-6">
            <LiveContractPreview isAssignment={isAssignment} L={L} contractRole={contractRole} buyerName={buyerName} sellerName={sellerPartyName} fieldValues={fieldValues} />
          </div>
        )}
      </div>

      <StickyActionBar>
        <button type="button" onClick={handleBack} className="h-9 px-4 border border-[#E8E8E4] text-[#444441] text-[13px] font-semibold rounded hover:border-[#1A1816] transition-colors flex items-center gap-1.5">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {step < NUM_STEPS ? (
          <button type="button" onClick={handleContinue} disabled={!canContinueFromStep(step)} className="flex items-center gap-1.5 h-9 px-5 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSend} disabled={sending || selfDeal || !buyerEmail || !sellerPartyEmail || !templateId} className="flex items-center gap-1.5 h-9 px-5 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {sending ? <><span className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send Contract</>}
          </button>
        )}
      </StickyActionBar>
    </div>
  )
}

function Step1Setup({ templates, templatesLoading, templateId, onSelectTemplate, contractRole, onSelectRole }) {
  const selectedTemplate = templates.find(t => String(t.id) === String(templateId))
  const L = roleLabels(selectedTemplate?.slug === 'assignment')
  if (templatesLoading) return <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-20 bg-[#FAFAF8] border border-[#E8E8E4] rounded animate-pulse" />)}</div>
  if (!templates.length) return <div className="text-center py-10 text-[13px] text-[#737370]"><p className="text-[14px] font-semibold text-[#1A1816] mb-1">No contract templates available</p><p>Contracts aren't available right now. Please try again later or contact support.</p></div>
  return (
    <div>
      <h2 className="text-[16px] font-bold text-[#1A1816] mb-1">What are you creating?</h2>
      <p className="text-[13px] text-[#737370] mb-4">Pick the contract that matches your deal.</p>
      <div className="space-y-2">
        {templates.map(t => {
          const selected = String(t.id) === String(templateId)
          return (
            <button key={t.id} type="button" onClick={() => onSelectTemplate(String(t.id))} className={`w-full text-left p-4 border rounded transition-colors ${selected ? 'border-[#D03839] bg-[#FEF0EF]/40' : 'border-[#E8E8E4] hover:border-[#1A1816]'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${selected ? 'bg-[#D03839] text-white' : 'bg-[#FAFAF8] text-[#737370] border border-[#E8E8E4]'}`}><FileText className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-[#1A1816]">{t.label || t.name}</p>
                  <p className="text-[12px] text-[#737370] mt-0.5">{t.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
      {templateId && (
        <div className="mt-6 pt-6 border-t border-[#E8E8E4]">
          <h2 className="text-[16px] font-bold text-[#1A1816] mb-1">Which side of this contract are you on?</h2>
          <p className="text-[13px] text-[#737370] mb-4">We'll pre-fill your details and send the contract to the other party. The {L.seller.toLowerCase()} always signs first.</p>
          <div className="grid grid-cols-2 gap-3">
            {[{ k: 'seller', label: `I'm the ${L.seller}` }, { k: 'buyer', label: `I'm the ${L.buyer}` }].map(opt => {
              const selected = contractRole === opt.k
              return (
                <button key={opt.k} type="button" onClick={() => onSelectRole(opt.k)} className={`p-4 border rounded text-left transition-colors ${selected ? 'border-[#D03839] bg-[#FEF0EF]/40' : 'border-[#E8E8E4] hover:border-[#1A1816]'}`}>
                  <div className={`w-9 h-9 rounded flex items-center justify-center mb-2 ${selected ? 'bg-[#D03839] text-white' : 'bg-[#FAFAF8] text-[#737370] border border-[#E8E8E4]'}`}>{opt.k === 'seller' ? <Home className="w-4 h-4" /> : <User className="w-4 h-4" />}</div>
                  <p className="text-[14px] font-bold text-[#1A1816]">{opt.label}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Step2Property({ properties, propertiesLoading, propertyId, onChange, manualAddress, onManualAddressChange }) {
  const isManual = propertyId === 'manual'
  return (
    <div>
      <h2 className="text-[16px] font-bold text-[#1A1816] mb-1">Pick the property</h2>
      <p className="text-[13px] text-[#737370] mb-4">We'll pre-fill the address on the contract. Don't see it? Enter the address manually.</p>
      <label className={LABEL_CLS}>Your listings</label>
      {propertiesLoading ? (
        <div className="h-10 bg-[#E8E8E4] rounded animate-pulse" />
      ) : (
        <select value={propertyId} onChange={e => onChange(e.target.value)} className={INPUT_CLS + ' bg-white'}>
          <option value="">— Select a property —</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.address || `Untitled (${String(p.id).slice(0, 8)})`}{p.price ? ` · ${fmtPrice(p.price)}` : ''}</option>)}
          <option value="manual">I'll enter the address manually</option>
        </select>
      )}
      {isManual && (
        <div className="mt-4">
          <label className={LABEL_CLS}>Property Address <span className="text-[#D03839]">*</span></label>
          <input type="text" value={manualAddress || ''} onChange={e => onManualAddressChange(e.target.value)} placeholder="123 Main St, Dallas, TX 75201" className={INPUT_CLS} />
        </div>
      )}
      {propertyId && propertyId !== 'manual' && (() => {
        const p = properties.find(pp => pp.id === propertyId)
        if (!p) return null
        return (
          <div className="mt-4 bg-[#FAFAF8] border border-[#E8E8E4] rounded p-3 flex items-start gap-3">
            <Home className="w-4 h-4 text-[#737370] mt-0.5 shrink-0" />
            <div className="text-[13px] text-[#1A1816] flex-1 min-w-0">
              <p className="font-semibold truncate">{p.address}</p>
              <p className="text-[12px] text-[#737370] mt-0.5">{p.price ? fmtPrice(p.price) : '—'}{p.bedrooms ? ` · ${p.bedrooms} bd` : ''}{p.bathrooms ? ` · ${p.bathrooms} ba` : ''}</p>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function StepPartyInfo({ party, L, isYou, name, email, address, coName, onName, onEmail, onAddress, onCoName }) {
  const roleLabel = party === 'buyer' ? L.buyer : L.seller
  const coLabel = party === 'buyer' ? 'co-buyer' : 'co-seller'
  const [coOpen, setCoOpen] = useState(!!coName)
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-[16px] font-bold text-[#1A1816]">{roleLabel} information</h2>
        {isYou && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#FEF3E2] text-[#B5620A]">You</span>}
      </div>
      <p className="text-[13px] text-[#737370] mb-4">{isYou ? `Your details — pre-filled from your account. Edit anything that's not right.` : `The ${roleLabel.toLowerCase()}'s details. They'll appear on the contract.`}</p>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLS}>{roleLabel} Full Name / LLC <span className="text-[#D03839]">*</span></label>
          <input type="text" value={name} onChange={e => onName(e.target.value)} placeholder="John Smith or Acme Holdings LLC" className={INPUT_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>{roleLabel} Email <span className="text-[#D03839]">*</span></label>
          <input type="email" value={email} onChange={e => onEmail(e.target.value)} placeholder={`${roleLabel.toLowerCase()}@example.com`} className={INPUT_CLS} required />
        </div>
        <div>
          <label className={LABEL_CLS}>{roleLabel} Mailing Address</label>
          <input type="text" value={address || ''} onChange={e => onAddress(e.target.value)} placeholder="123 Main St, City, ST 00000" className={INPUT_CLS} />
        </div>
      </div>
      <div className="mt-5 pt-5 border-t border-[#E8E8E4]">
        {!coOpen ? (
          <button type="button" onClick={() => setCoOpen(true)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#D03839] hover:text-[#B82F30]">+ Add {coLabel} (optional)</button>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[13px] font-semibold text-[#1A1816] capitalize">{coLabel}</p>
                <p className="text-[12px] text-[#737370]">For jointly-held deals. Their name prints on the contract.</p>
              </div>
              <button type="button" onClick={() => { onCoName(''); setCoOpen(false) }} className="text-[12px] text-[#737370] hover:text-[#1A1816]">Remove</button>
            </div>
            <label className={LABEL_CLS}>Co-Signer Full Name / LLC</label>
            <input type="text" value={coName || ''} onChange={e => onCoName(e.target.value)} placeholder="Jane Smith" className={INPUT_CLS} />
          </div>
        )}
      </div>
    </div>
  )
}

function FieldRow({ label, hint, children, span }) {
  return (
    <div className={span === 'full' ? 'md:col-span-2' : ''}>
      <label className={LABEL_CLS}>{label}{hint && <span className="text-[#A8A8A4] font-normal ml-1">{hint}</span>}</label>
      {children}
    </div>
  )
}

function Step5Terms({ values, onChange, template, L, onPersistDefault }) {
  const isAssignment = template?.slug === 'assignment'
  const todayISO = todayISOf()
  const changeAndSave = (key) => (e) => { const v = e.target.value; onChange(key, v); if (onPersistDefault) onPersistDefault(key, v) }
  return (
    <div>
      <h2 className="text-[16px] font-bold text-[#1A1816] mb-1">Deal terms</h2>
      <p className="text-[13px] text-[#737370] mb-4">Numbers and dates that pre-fill on the contract. Required fields are marked.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldRow label={isAssignment ? 'Agreed Purchase Price ($)' : 'Sale Price ($)'} hint="*">
          <input type="number" value={values.purchase_price || ''} onChange={e => onChange('purchase_price', e.target.value)} placeholder={isAssignment ? '15000' : '250000'} className={INPUT_CLS} />
        </FieldRow>
        <FieldRow label={isAssignment ? 'Nonrefundable Deposit ($)' : 'Earnest Money ($)'} hint="*">
          <input type="number" value={values.emd || ''} onChange={e => onChange('emd', e.target.value)} placeholder={isAssignment ? '1000' : '5000'} className={INPUT_CLS} />
        </FieldRow>
        {!isAssignment && (
          <FieldRow label="Due Diligence Period (days)" hint="default 14">
            <input type="number" value={values.due_diligence_days || ''} onChange={e => onChange('due_diligence_days', e.target.value)} placeholder="14" className={INPUT_CLS} />
          </FieldRow>
        )}
        <FieldRow label="Closing Date" hint="*">
          <input type="date" min={todayISO} value={values.closing_date || ''} onChange={e => onChange('closing_date', e.target.value)} className={`${INPUT_CLS} ${values.closing_date && values.closing_date < todayISO ? 'border-[#D03839] focus:border-[#D03839]' : ''}`} />
          {values.closing_date && values.closing_date < todayISO && <p className="text-[11px] text-[#D03839] mt-1">Closing date can't be in the past.</p>}
        </FieldRow>
        {!isAssignment && (
          <FieldRow label="Source of Financing" hint="cash or financing">
            <select value={values.financing_type || ''} onChange={e => onChange('financing_type', e.target.value)} className={INPUT_CLS + ' bg-white'}>
              <option value="">— Select —</option>
              <option value="cash">Cash</option>
              <option value="financing">Financing</option>
            </select>
          </FieldRow>
        )}
        {!isAssignment && (
          <FieldRow label={`${L.seller} Acceptance Deadline`} hint="default 3 days from today">
            <input type="date" min={todayISO} value={values.acceptance_deadline || ''} onChange={e => onChange('acceptance_deadline', e.target.value)} className={`${INPUT_CLS} ${values.acceptance_deadline && values.acceptance_deadline < todayISO ? 'border-[#D03839] focus:border-[#D03839]' : ''}`} />
            {values.acceptance_deadline && values.acceptance_deadline < todayISO && <p className="text-[11px] text-[#D03839] mt-1">Acceptance deadline can't be in the past.</p>}
          </FieldRow>
        )}
      </div>

      {!isAssignment && (
        <div className="mt-6">
          <p className="text-[11px] font-bold text-[#A8A8A4] uppercase tracking-wide mb-3">Closing details <span className="font-normal normal-case">(optional)</span></p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldRow label="Title Company / Escrow Agent" hint="who holds the earnest money"><input type="text" value={values.emd_escrow || ''} onChange={changeAndSave('emd_escrow')} placeholder="e.g. Stewart Title of Texas" className={INPUT_CLS} /></FieldRow>
            <FieldRow label="Closing Location" hint="usually title company address"><input type="text" value={values.closing_location || ''} onChange={changeAndSave('closing_location')} placeholder="Same as escrow holder if not sure" className={INPUT_CLS} /></FieldRow>
            <FieldRow label="Property Tax ID(s)"><input type="text" value={values.property_tax_id || ''} onChange={e => onChange('property_tax_id', e.target.value)} placeholder="Parcel / APN" className={INPUT_CLS} /></FieldRow>
            <FieldRow label="Other Description" hint="optional"><input type="text" value={values.other_description || ''} onChange={e => onChange('other_description', e.target.value)} placeholder="e.g. includes adjacent lot 4B" className={INPUT_CLS} /></FieldRow>
          </div>
        </div>
      )}

      {isAssignment && (
        <div className="mt-6">
          <p className="text-[11px] font-bold text-[#A8A8A4] uppercase tracking-wide mb-3">Underlying Purchase Contract</p>
          <p className="text-[12px] text-[#737370] mb-3">Reference the original Purchase Contract you're assigning.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldRow label="Original Seller Name" hint="* property owner from the original Purchase Contract"><input type="text" value={values.original_seller_name || ''} onChange={e => onChange('original_seller_name', e.target.value)} placeholder="Jane Doe" className={INPUT_CLS} /></FieldRow>
            <FieldRow label="Original Purchase Contract Signed Date" hint="* already signed — today or earlier">
              <input type="date" max={todayISO} value={values.original_psa_date || ''} onChange={e => onChange('original_psa_date', e.target.value)} className={`${INPUT_CLS} ${values.original_psa_date && values.original_psa_date > todayISO ? 'border-[#D03839] focus:border-[#D03839]' : ''}`} />
              {values.original_psa_date && values.original_psa_date > todayISO && <p className="text-[11px] text-[#D03839] mt-1">This contract was already signed — the date can&rsquo;t be in the future.</p>}
            </FieldRow>
          </div>
        </div>
      )}

      <div className="mt-6">
        <FieldRow label="Additional Terms" hint={isAssignment ? 'one per line (up to 6 lines)' : 'optional'}>
          <textarea value={values.special_terms || ''} onChange={e => onChange('special_terms', e.target.value)} rows={isAssignment ? 6 : 4} placeholder={isAssignment ? 'Each line becomes one of the 6 numbered lines on the contract.' : 'Any other deal-specific terms…'} className="w-full p-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#D03839] focus:ring-1 focus:ring-[#D03839]/20 resize-none" />
        </FieldRow>
      </div>
    </div>
  )
}

// ── Live contract preview — mirrors the real signed document, fills in live ──
function Fill({ value }) {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    return <span className="font-semibold text-[#1A1816]">{value}</span>
  }
  return <span className="inline-block align-baseline bg-[#FEF9E7] border-b border-[#E0B100] rounded-[1px]" style={{ minWidth: '64px', height: '0.95em' }}>&#8203;</span>
}
function LiveContractPreview({ isAssignment, buyerName, sellerName, fieldValues: fv }) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const money = (v) => (v !== '' && v != null && !Number.isNaN(Number(v))) ? `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
  const longDate = (v) => v ? (() => { try { return new Date(v).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) } catch { return v } })() : null
  const funds = fv.financing_type ? (fv.financing_type === 'cash' ? 'Cash' : 'Financing') : null
  return (
    <div className="bg-white border border-[#E8E8E4] rounded shadow-sm overflow-hidden">
      <div className="px-4 py-2 bg-[#FAFAF8] border-b border-[#E8E8E4] flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-[#737370]" />
        <span className="text-[11px] font-semibold text-[#737370] uppercase tracking-wide" style={{ fontFamily: 'DM Sans, sans-serif' }}>Live preview · the actual contract, filling in as you type</span>
      </div>
      <div className="px-6 py-5 max-h-[74vh] overflow-y-auto text-[11px] leading-[1.55] text-[#1A1816]" style={{ fontFamily: 'Georgia, "Times New Roman", serif', textAlign: 'justify' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-[12px] font-bold uppercase tracking-wide">{isAssignment ? 'Assignment of Sale Contract Agreement' : 'Contract to Purchase Real Estate'}</h3>
          <span className="text-[11px] font-extrabold text-[#D03839] shrink-0" style={{ fontFamily: 'DM Sans, sans-serif' }}>DeelMap</span>
        </div>

        {isAssignment ? (
          <>
            <p className="mb-1">Property Address: <Fill value={fv.property_address} /></p>
            <p className="mb-2">This agreement is made this <Fill value={today} />, by and between <Fill value={sellerName} /> (Assignor) and <Fill value={buyerName} /> (Assignee) regarding the sale of the above referenced property.</p>
            <p className="mb-1.5">Whereas <Fill value={sellerName} /> (Assignor) has entered into a Purchase and Sale Contract with <Fill value={fv.original_seller_name} /> (Seller) on <Fill value={longDate(fv.original_psa_date)} /> for the purchase of subject property.</p>
            <p className="mb-1.5 text-[#444441]">Whereas, Assignor wishes to assign its rights, interests and obligations in the Purchase and Sale Contract to Assignee for the final purchase of subject property.</p>
            <p className="mb-1.5">Now therefore, it is hereby agreed between Assignor and Assignee as follows:</p>
            <p className="mb-1.5"><b>1) ASSIGNMENT FEE:</b> Assignee shall pay Assignor an assignment fee of <Fill value={money(fv.purchase_price)} /> of which <Fill value={money(fv.emd)} /> shall be paid upon execution and shall represent a nonrefundable deposit. The balance shall be payable to Assignor at time of closing.</p>
            <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">2) INSPECTION PERIOD:</b> Assignee waives any inspection period contained in the attached contract. All inspections have been completed prior to the execution of this agreement.</p>
            <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">3) OWNERSHIP &amp; PROPERTY ACCESS ACKNOWLEDGMENT:</b> Assignee acknowledges that Assignor does not authorize Assignee to enter the Subject Property without Assignor&rsquo;s direct authorization, and holds Assignor harmless from related liability.</p>
            <p className="mb-1.5 text-[#444441]">Assignee agrees and accepts all terms and conditions of the subject contract for Purchase and Sale between Buyer and Seller in its entirety.</p>
            <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">4) LIMITATION OF ASSIGNMENT:</b> This Agreement and the subject contract are not assignable by Assignee without the written consent of the Assignor.</p>
            <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">5) DISCLOSURES &amp; ACKNOWLEDGMENT:</b> Assignor makes no warranty regarding inspection or other reports. Assignee is dealing directly with Assignor, is not represented by a real estate agent, and acknowledges receipt of the original Purchase and Sale Contract and all addendums.</p>
            <p className="mb-1.5"><b>6) CLOSING DATE:</b> The closing date of the subject transaction shall be <Fill value={longDate(fv.closing_date)} />.</p>
            <p className="mb-3"><b>7) ADDITIONAL TERMS:</b> <Fill value={fv.special_terms} /></p>
            <p className="mb-3 text-[#444441]">All other terms and conditions of the Subject Purchase and Sale Contract not specifically amended hereby or inconsistent herewith shall remain in full force and effect.</p>
            <p className="font-bold mb-2">AGREED AND ACCEPTED</p>
            <div className="space-y-1.5 pt-2 border-t border-[#E8E8E4]">
              <p>Assignor: <Fill value={null} /> &nbsp;&nbsp; Date: <Fill value={null} /></p>
              <p>Print Name: <Fill value={sellerName} /></p>
              <p className="pt-1">Assignee: <Fill value={null} /> &nbsp;&nbsp; Date: <Fill value={null} /></p>
              <p>Print Name: <Fill value={buyerName} /></p>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2">This contract dated: <Fill value={today} /> in which Buyer: <Fill value={buyerName} /> whose address is <Fill value={fv.buyer_address} /> and/or assigns (the &ldquo;BUYER&rdquo;) and Seller: <Fill value={sellerName} /> whose address is <Fill value={fv.seller_address} /> (the &ldquo;SELLER&rdquo;) hereby agree that the SELLER will sell and BUYER will buy the following described real estate:</p>
            <p className="mb-1">ADDRESS(s): <Fill value={fv.property_address} /></p>
            <p className="mb-1">PROPERTY TAX ID(s): <Fill value={fv.property_tax_id} /></p>
            <p className="mb-2">OTHER DESCRIPTION (if applicable): <Fill value={fv.other_description} /></p>
            <p className="mb-2 text-[#444441]">together with all fixtures, all electrical, mechanical, plumbing, HVAC, and any other systems as are currently installed or attached thereto, together with all the improvements thereon and all appurtenances thereto, all being hereinafter collectively referred to as the &ldquo;Property.&rdquo;</p>
            <p className="font-bold underline mb-1.5">SELLER AGREES:</p>
            <p className="mb-1.5"><b>1) SALE PRICE:</b> <Fill value={money(fv.purchase_price)} />, <b>SOURCE OF FUNDS</b> (cash/financing): <Fill value={funds} /></p>
            <p className="mb-1.5"><b>2) DEPOSIT:</b> Upon acceptance Buyer will submit an earnest money deposit of <Fill value={money(fv.emd)} /> to <Fill value={fv.emd_escrow} /> which will be credited to the BUYER when sale closes. This deposit will be returned to the BUYER if the title does not transfer in accordance with this agreement.</p>
            <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">3) CLOSING COSTS &amp; TAXES:</b> BUYER pays all closing costs, deed prep, and title insurance. Current year taxes are prorated at closing; any previous year&rsquo;s taxes and/or transfer tax to be paid by SELLER.</p>
            <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">4) RENTS &amp; DEPOSITS (if applicable):</b> Rents are prorated at closing and transfer to the BUYER. Tenant deposits per the existing lease also transfer to the BUYER at closing.</p>
            <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">5) TITLE &amp; JUDGMENTS:</b> Seller warrants there are no judgments threatening the equity in the property and no bankruptcy pending. Title is to be free, clear, and unencumbered; all liens shall be paid at closing by the seller.</p>
            <p className="mb-1.5"><b>6) DUE DILIGENCE PERIOD:</b> BUYER has <Fill value={fv.due_diligence_days} /> days to perform due diligence following the SELLER&rsquo;s acceptance. The BUYER may cancel for any reason during this period and receive a full return of earnest money.</p>
            <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">7) CONDITION:</b> Property is sold &ldquo;AS-IS&rdquo; with no warranties by the SELLER, who will disclose any known material defects. Appliances remain with the property unless otherwise stated.</p>
            <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">8) POSSESSION:</b> Possession and occupancy, with all keys and openers, will be delivered to the BUYER when title transfers.</p>
            <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">9) ASSIGNABILITY:</b> This purchase contract IS assignable. SELLER agrees the buyer may place signs and market the property immediately upon acceptance by both parties.</p>
            <p className="mb-1.5"><b>10) ACCEPTANCE:</b> This instrument becomes binding when accepted by the Seller and signed by both parties. If it is not accepted and signed by the Seller on or prior to <Fill value={longDate(fv.acceptance_deadline)} />, this contract shall be void.</p>
            <p className="mb-1.5"><b>11) CLOSING:</b> Closing will take place on or before <Fill value={longDate(fv.closing_date)} /> subject to a 90-day period to clear any title problems. Closing will take place at <Fill value={fv.closing_location} />.</p>
            <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">12) TIME IS OF THE ESSENCE:</b> Time is of the essence; relevant time periods are calculated in business days.</p>
            <p className="mb-3"><b>13) ADDITIONAL TERMS (if applicable):</b> <Fill value={fv.special_terms} /></p>
            <div className="space-y-2 pt-2 border-t border-[#E8E8E4]">
              <p>BUYER Print: <Fill value={buyerName} /> &nbsp;&nbsp; Sign/Date: <Fill value={null} /></p>
              <p>SELLER Print: <Fill value={sellerName} /> &nbsp;&nbsp; Sign/Date: <Fill value={null} /></p>
              {fv.co_seller_name ? <p>SELLER Print: <Fill value={fv.co_seller_name} /> &nbsp;&nbsp; Sign/Date: <Fill value={null} /></p> : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Step6Review({ template, L, fieldValues, buyerName, buyerEmail, sellerName, sellerEmail, contractRole, selfDeal, onJump }) {
  const isAssignment = template?.slug === 'assignment'
  const youTag = (role) => contractRole === role ? ' (you)' : ''
  const termsItems = isAssignment
    ? [
        { label: 'Agreed Purchase Price', value: fmtPrice(fieldValues.purchase_price) },
        { label: 'Nonrefundable Deposit', value: fmtPrice(fieldValues.emd) },
        { label: 'Closing Date',          value: fmtDate(fieldValues.closing_date) },
        { label: 'Original Seller',       value: fieldValues.original_seller_name || '—' },
        { label: 'Original Purchase Contract Date', value: fmtDate(fieldValues.original_psa_date) },
        { label: 'Additional Terms',      value: fieldValues.special_terms || '—' },
      ]
    : [
        { label: 'Sale Price',            value: fmtPrice(fieldValues.purchase_price) },
        { label: 'Earnest Money',         value: fmtPrice(fieldValues.emd) },
        { label: 'Due Diligence',         value: fieldValues.due_diligence_days ? `${fieldValues.due_diligence_days} days` : '—' },
        { label: 'Closing Date',          value: fmtDate(fieldValues.closing_date) },
        { label: 'Source of Financing',   value: fieldValues.financing_type ? (fieldValues.financing_type === 'cash' ? 'Cash' : 'Financing') : '—' },
        { label: `${L.seller} Acceptance Deadline`, value: fmtDate(fieldValues.acceptance_deadline) },
        { label: 'Title Company / Escrow Agent', value: fieldValues.emd_escrow || '—' },
        { label: 'Closing Location',      value: fieldValues.closing_location || '—' },
        { label: 'Property Tax ID',       value: fieldValues.property_tax_id || '—' },
        { label: 'Other Description',     value: fieldValues.other_description || '—' },
        { label: 'Additional Terms',      value: fieldValues.special_terms || '—' },
      ]
  const rows = [
    { section: 'Property', step: 2, items: [{ label: 'Address', value: fieldValues.property_address || '—' }] },
    { section: `${L.buyer}`, step: 3, items: [
        { label: `${L.buyer} Name${youTag('buyer')}`, value: buyerName || '—' },
        { label: 'Email', value: buyerEmail || '—' },
        { label: 'Mailing Address', value: fieldValues.buyer_address || '—' },
        ...(fieldValues.co_buyer_name ? [{ label: `Co-${L.buyer}`, value: fieldValues.co_buyer_name }] : []),
      ] },
    { section: `${L.seller}`, step: 4, items: [
        { label: `${L.seller} Name${youTag('seller')}`, value: sellerName || '—' },
        { label: 'Email', value: sellerEmail || '—' },
        { label: 'Mailing Address', value: fieldValues.seller_address || '—' },
        ...(fieldValues.co_seller_name ? [{ label: `Co-${L.seller}`, value: fieldValues.co_seller_name }] : []),
      ] },
    { section: 'Terms', step: 5, items: termsItems },
  ]
  return (
    <div>
      <h2 className="text-[16px] font-bold text-[#1A1816] mb-1">Review &amp; send</h2>
      <p className="text-[13px] text-[#737370] mb-4">Double-check everything. The {L.seller.toLowerCase()} signs first; the {L.buyer.toLowerCase()} gets a signing link after.</p>
      {selfDeal && <div className="mb-4 p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[12px] text-[#D03839]">The {L.buyer.toLowerCase()} and {L.seller.toLowerCase()} have the same email. Use different emails to send.</div>}
      <div className="space-y-4">
        {rows.map(group => (
          <div key={group.section} className="border border-[#E8E8E4] rounded">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E8E8E4] bg-[#FAFAF8]">
              <p className="text-[12px] font-bold text-[#1A1816] uppercase tracking-wide">{group.section}</p>
              <button type="button" onClick={() => onJump(group.step)} className="text-[12px] text-[#D03839] hover:underline font-semibold">Edit</button>
            </div>
            <div className="divide-y divide-[#F0F0EC]">
              {group.items.map((item, i) => (
                <div key={i} className="flex items-start gap-4 px-4 py-2.5">
                  <p className="text-[12px] text-[#737370] w-[200px] shrink-0">{item.label}</p>
                  <p className="text-[13px] text-[#1A1816] flex-1 break-words">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
