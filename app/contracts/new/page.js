'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DocusealForm } from '@docuseal/react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  FileText,
  Home,
  PenLine,
  Send,
  Check,
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
        {processing
          ? <>Processing…</>
          : `Pay ${fmtFee(amount)} & send contract`}
      </button>
    </form>
  )
}

const STEPS = [
  { id: 1, name: 'Contract Type' },
  { id: 2, name: 'Property' },
  { id: 3, name: 'Buyer Info' },
  { id: 4, name: 'Terms' },
  { id: 5, name: 'Review & Send' },
]

const FINANCING_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'financing', label: 'Financing' },
]

function fmtPrice(v) {
  if (v === '' || v == null) return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtDate(v) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return String(v) }
}

export default function NewContractWizardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeDraftId = searchParams.get('draft_id')

  // ── Identity / workspace context ────────────────────────────────
  const [userId, setUserId] = useState(null)
  const [sellerEmail, setSellerEmail] = useState(null)
  const [sellerName, setSellerName] = useState('')
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
  const [propertyId, setPropertyId] = useState('') // '' | 'manual' | <uuid>
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  // Smart defaults for date-aware fields. Computed once on mount.
  const todayISO = new Date().toISOString().slice(0, 10)
  const acceptanceDefaultISO = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().slice(0, 10)
  })()

  // Profile defaults — saved in localStorage when the seller ticks "Save as default".
  // These pre-fill on every new contract; the seller can still edit per-contract.
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
    // Universal
    property_address:    '',
    purchase_price:      '',
    emd:                 '',
    closing_date:        '',
    special_terms:       '',
    // Purchase-only
    financing_type:      '',
    seller_address:      savedDefaults.seller_address || savedDefaults.buyer_address || '',
    buyer_address:       '',
    property_tax_id:     '',
    other_description:   '',
    co_seller_name:      '',
    emd_escrow:          savedDefaults.emd_escrow || '',
    due_diligence_days:  '14',
    acceptance_deadline: acceptanceDefaultISO,
    closing_location:    savedDefaults.closing_location || '',
    // Assignment-only
    original_seller_name: '',
    original_psa_date:    '',
  })

  // ── Auto-save state (mirrors edit-page pattern) ─────────────────
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

  // Contract-fee payment
  const [payClientSecret, setPayClientSecret] = useState(null)
  const [payAmount, setPayAmount] = useState(299)

  // ── Identity bootstrap ──────────────────────────────────────────
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('seller_user') : null
    if (!raw) return
    const u = JSON.parse(raw)
    setUserId(u.id)
    setSellerEmail(u.email)
    const myName = u.contactPersonName || u.businessName || u.name || u.full_name || u.first_name || ''
    setSellerName(myName)
    setEffectiveEmail(u.email)
    setEffectiveName(myName)
    setEffectiveSellerId(u.id)

    // Resolve workspace (team-member sellers act on behalf of owner)
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

  // ── Load templates ──────────────────────────────────────────────
  useEffect(() => {
    setTemplatesLoading(true)
    fetch('/api/contracts?type=templates')
      .then(r => r.json())
      .then(raw => setTemplates(decorateTemplates(raw)))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false))
  }, [])

  // Drafts can outlive a template if we archive one in DocuSeal. If the resumed
  // templateId isn't in the live list, drop it and send the user back to step 1
  // so we don't pass `template={undefined}` into the Step 4 / Step 5 components.
  useEffect(() => {
    if (templatesLoading) return
    if (!templateId) return
    if (templates.length === 0) return
    const stillExists = templates.some(t => String(t.id) === String(templateId))
    if (!stillExists) {
      setTemplateId('')
      setStep(1)
    }
  }, [templates, templatesLoading, templateId])

  // ── Load seller's properties for the dropdown ───────────────────
  useEffect(() => {
    if (!effectiveSellerId) return
    setPropertiesLoading(true)
    supabase
      .from('properties')
      .select('id, address, price, bedrooms, bathrooms, floor_area, slug, status')
      .eq('seller_id', effectiveSellerId)
      .in('status', ['active', 'inactive'])
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setProperties(data)
      })
      .finally(() => setPropertiesLoading(false))
  }, [effectiveSellerId])

  // ── Resume an existing draft (when ?draft_id=… is present) ──────
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
          setFieldValues(prev => ({ ...prev, ...d.field_values }))
        }
        // If buyer info already filled, jump them past step 1 so they don't have to re-confirm everything.
        // We jump to the earliest step with missing data.
        if (!d.template_id) setStep(1)
        else if (!d.property_id && !d.field_values?.property_address) setStep(2)
        else if (!d.buyer_email) setStep(3)
        else setStep(4)
      })
      .catch(() => {})
  }, [resumeDraftId])

  // ── Prefill from an accepted offer (when ?from_offer=… is present) ──
  // Lands the seller on Step 5 (Review) with every known value filled in, so
  // "accept offer → send contract" becomes a confirm-and-sign action. The
  // normalized field keys are template-agnostic, so the same values map to the
  // correct labels whether they keep Purchase or switch to Assignment.
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

        // A wholesaler accepting an investor's offer ASSIGNS their deal to that
        // investor → default to the Assignment of Contract (our user = Assignor,
        // the investor who offered = Assignee). The seller can still switch to a
        // Purchase contract on Step 1 if they double-close instead of assigning.
        const assignment = templates.find(t => t.slug === 'assignment') || templates[0]
        if (assignment) setTemplateId(String(assignment.id))

        // Property: use the matching listing if we have it; else manual entry with
        // the address resolved server-side.
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

        // Contract only distinguishes cash vs financing; map any non-cash offer to financing.
        if (o.financing_type) next.financing_type = /cash/i.test(String(o.financing_type)) ? 'cash' : 'financing'

        // Inspection period → due diligence days, only if it parses to a number.
        const insp = String(o.inspection_period ?? '').match(/\d+/)
        if (insp) next.due_diligence_days = insp[0]

        // closing_timeline is free text ("30 days", "Flexible"), not a date. If it's
        // a day count, compute a default closing date the seller can adjust; always
        // keep the buyer's stated timeline as a note so nothing is silently dropped.
        const noteLines = []
        if (o.closing_timeline) {
          const days = String(o.closing_timeline).match(/\d+/)
          if (days) {
            const d = new Date()
            d.setDate(d.getDate() + parseInt(days[0], 10))
            next.closing_date = d.toISOString().slice(0, 10)
          }
          noteLines.push(`Buyer's requested closing timeline: ${o.closing_timeline}`)
        }
        if (o.notes) noteLines.push(String(o.notes))
        if (noteLines.length) next.special_terms = noteLines.join('\n')

        setFieldValues(prev => ({ ...prev, ...next }))
        setDirty(true)
        setStep(5)
      } catch {
        appliedOfferRef.current = false
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromOfferId, effectiveSellerId, templatesLoading, templates, propertiesLoading, properties, userId])

  // ── Property selection → auto-fill property_address ─────────────
  function handlePropertyChange(value) {
    setPropertyId(value)
    setDirty(true)
    if (value === '' || value === 'manual') {
      // Don't wipe what the user typed; just let them type freely.
      return
    }
    const p = properties.find(pp => pp.id === value)
    if (p) {
      setFieldValues(prev => ({ ...prev, property_address: p.address || '' }))
    }
  }

  function setField(key, value) {
    setFieldValues(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  // ── Build the auto-save payload ─────────────────────────────────
  function buildDraftPayload() {
    return {
      seller_id: effectiveSellerId,
      template_id: templateId || '',
      property_id: propertyId && propertyId !== 'manual' ? propertyId : null,
      buyer_name: buyerName || null,
      buyer_email: buyerEmail || null,
      field_values: fieldValues || {},
    }
  }

  // Enable auto-save only once we have an identity AND the user has actually
  // picked something (template) — we don't want to create empty rows just from
  // visiting the page.
  useEffect(() => {
    if (effectiveSellerId && templateId && !readyForAutoSave) {
      setReadyForAutoSave(true)
    }
  }, [effectiveSellerId, templateId, readyForAutoSave])

  // ── Debounced auto-save: 2s after last edit ─────────────────────
  useEffect(() => {
    if (!readyForAutoSave || !dirty) return
    if (autoSaving || inFlightSaveRef.current) return
    if (!effectiveSellerId || !templateId) return

    const timer = setTimeout(async () => {
      inFlightSaveRef.current = true
      setAutoSaving(true)
      setAutoSaveError(null)
      try {
        const payload = buildDraftPayload()
        if (currentDraftId) {
          const res = await fetch(`/api/contracts/drafts/${currentDraftId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const json = await res.json()
          if (!res.ok || json.error) throw new Error(json.error || 'Save failed')
        } else {
          // Only create a NEW draft row once the user has filled in at least a
          // property or buyer email — otherwise just picking a template would
          // litter the drafts list with empty rows.
          const hasMeaningfulInput =
            !!payload.property_id ||
            !!(payload.field_values && payload.field_values.property_address) ||
            !!payload.buyer_name ||
            !!payload.buyer_email
          if (!hasMeaningfulInput) {
            setDirty(false)
            return
          }
          const res = await fetch('/api/contracts/drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const json = await res.json()
          if (!res.ok || json.error || !json.id) throw new Error(json.error || 'Save failed')
          setCurrentDraftId(json.id)
        }
        setLastSavedAt(new Date())
        setDirty(false)
      } catch (e) {
        setAutoSaveError(e?.message || "Couldn't save")
      } finally {
        setAutoSaving(false)
        inFlightSaveRef.current = false
      }
    }, 2000)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, readyForAutoSave, templateId, propertyId, buyerName, buyerEmail, fieldValues, currentDraftId, autoSaving])

  // ── Step validation: gate Continue button ───────────────────────
  function canContinueFromStep(s) {
    if (s === 1) return !!templateId
    if (s === 2) {
      // Must either pick a property OR choose manual + supply an address.
      if (propertyId && propertyId !== 'manual') return true
      if (propertyId === 'manual' && (fieldValues.property_address || '').trim().length > 0) return true
      return false
    }
    if (s === 3) {
      // Buyer email is required; name is nice-to-have.
      const email = (buyerEmail || '').trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false
      // Can't send a contract to yourself.
      const mine = (effectiveEmail || sellerEmail || '').trim().toLowerCase()
      if (mine && email.toLowerCase() === mine) return false
      return true
    }
    if (s === 4) {
      // Required deal terms must be filled so nothing lands as a blank,
      // editable field on the DocuSeal signing form (Roland's "why is it still
      // fillable"). The contract terms are locked read-only in DocuSeal, so any
      // value we don't pre-fill here would otherwise show up empty at signing.
      const tpl = templates.find(t => String(t.id) === String(templateId))
      const isAssignment = tpl?.slug === 'assignment'
      const filled = k => String(fieldValues[k] ?? '').trim().length > 0
      if (!filled('purchase_price') || !filled('emd') || !filled('closing_date')) return false
      if (isAssignment && (!filled('original_seller_name') || !filled('original_psa_date'))) return false
      return true
    }
    if (s === 5) return true
    return false
  }

  function handleContinue() {
    if (!canContinueFromStep(step)) return
    setStep(s => Math.min(5, s + 1))
  }
  function handleBack() {
    if (step === 1) {
      router.push('/contracts')
      return
    }
    setStep(s => Math.max(1, s - 1))
  }

  // ── Send Contract (step 5) — payment gate, then send ────────────
  async function handleSend() {
    if (!effectiveSellerId) return
    if (!templateId) { setSendError('Pick a contract type first.'); setStep(1); return }
    if (!buyerEmail) { setSendError('Buyer email is required.'); setStep(3); return }

    // Self-deal guard: the counterparty can't be the seller themselves, or the
    // two signers collide on one email and the sign order breaks.
    const myEmail = (effectiveEmail || sellerEmail || '').trim().toLowerCase()
    if (myEmail && buyerEmail.trim().toLowerCase() === myEmail) {
      setSendError("The buyer's email can't be the same as your own."); setStep(3); return
    }

    // Required deal terms must all be filled before paying/sending. The "accept
    // offer" shortcut jumps straight to Review, so enforce it here too — not
    // just on the Step 4 Continue button — so nothing reaches signing blank.
    if (!canContinueFromStep(4)) {
      setSendError('Please fill in all required deal terms before sending.'); setStep(4); return
    }

    setSending(true)
    setSendError(null)

    // Flush any pending auto-save first so the draft row is current.
    let draftId = currentDraftId
    try {
      const payload = buildDraftPayload()
      if (currentDraftId) {
        await fetch(`/api/contracts/drafts/${currentDraftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        const res = await fetch('/api/contracts/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (json?.id) { draftId = json.id; setCurrentDraftId(json.id) }
      }
    } catch { /* non-fatal — proceed */ }

    // Payment gate: free for this seller → send; otherwise collect the fee first.
    try {
      const payRes = await fetch('/api/contracts/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userId}` },
        body: JSON.stringify({ seller_id: effectiveSellerId, draft_id: draftId }),
      })
      const payData = await payRes.json().catch(() => ({}))
      if (!payRes.ok) { setSendError(payData.error || 'Payment could not be started.'); setSending(false); return }

      if (payData.free || payData.paid) {
        await doSend()
        return
      }
      if (payData.clientSecret) {
        setPayAmount(payData.amount || 299)
        setPayClientSecret(payData.clientSecret)
        setSending(false)
        return
      }
      setSendError('Payment could not be started. Please try again.')
      setSending(false)
    } catch {
      setSendError('Payment could not be started. Please try again.')
      setSending(false)
    }
  }

  // Create the DocuSeal submission + inline signing view. Called once payment clears.
  async function doSend() {
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: buyerName || '',
          buyerEmail,
          property: fieldValues.property_address || '',
          sellerEmail: effectiveEmail || sellerEmail,
          sellerName: effectiveName || sellerName,
          templateId,
          field_values: fieldValues,
          draft_id: currentDraftId,
          offer_id: fromOfferId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setSendError(data.error || 'Failed to send contract.')
        return
      }
      if (data.embed_src) {
        setSigningTitle(fieldValues.property_address || 'New Contract')
        setSigningEmbedSrc(data.embed_src)
      } else {
        router.push('/contracts')
      }
    } catch {
      setSendError('Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  // ── Render: payment screen (shown before the contract is sent) ──
  if (payClientSecret && stripePromise) {
    return (
      <div className="p-4 lg:p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setPayClientSecret(null); setSending(false) }}
            className="flex items-center gap-1.5 text-[13px] text-[#737370] hover:text-[#1A1816] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to contract
          </button>
        </div>
        <div className="max-w-[460px] mx-auto">
          <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#E8E8E4] flex items-center gap-3">
              <div className="w-9 h-9 bg-[#D03839]/10 rounded flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-[#D03839]" />
              </div>
              <div>
                <h1 className="text-[16px] font-bold text-[#1A1816] leading-tight">Send contract</h1>
                <p className="text-[12px] text-[#737370]">Pay the one-time fee to send it for signature</p>
              </div>
            </div>
            {/* Order summary */}
            <div className="px-5 py-4 border-b border-[#E8E8E4]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-[#1A1816]">Contract — 1 envelope</p>
                  {fieldValues.property_address ? (
                    <p className="text-[12px] text-[#737370] mt-0.5">{fieldValues.property_address}</p>
                  ) : null}
                </div>
                <p className="text-[14px] font-bold text-[#1A1816] whitespace-nowrap">{fmtFee(payAmount)}</p>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E8E8E4]">
                <span className="text-[13px] font-semibold text-[#1A1816]">Total due</span>
                <span className="text-[16px] font-bold text-[#1A1816]">{fmtFee(payAmount)}</span>
              </div>
            </div>
            {/* Payment form */}
            <div className="p-5">
              <Elements stripe={stripePromise} options={{ clientSecret: payClientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#D03839' } } }}>
                <ContractPayForm amount={payAmount} onSuccess={() => { setPayClientSecret(null); doSend() }} />
              </Elements>
            </div>
            {/* Secure footer */}
            <div className="px-5 py-3.5 bg-[#FAFAF8] border-t border-[#E8E8E4] text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <svg className="w-3 h-3 text-[#737370]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span className="text-[12px] text-[#737370]">Secured by Stripe</span>
              </div>
              <p className="text-[11px] text-[#A8A8A4]">One-time charge · No subscription · No auto-renewal</p>
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
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/contracts')}
            className="flex items-center gap-1.5 text-[13px] text-[#737370] hover:text-[#1A1816] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Contracts
          </button>
        </div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-[#D03839]/10 rounded flex items-center justify-center shrink-0">
            <PenLine className="w-4 h-4 text-[#D03839]" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1816] leading-tight">{signingTitle}</h1>
            <p className="text-[13px] text-[#737370]">Review and sign below</p>
          </div>
        </div>
        <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
          <DocusealForm
            src={signingEmbedSrc}
            email={sellerEmail}
            withTitle={false}
            withDownloadButton={false}
            customCss={`
              body { font-family: 'DM Sans', -apple-system, sans-serif !important; }
              .base-button { background: #D03839 !important; border-color: #D03839 !important; border-radius: 4px !important; }
              .base-button:hover { background: #E0493B !important; }
            `}
            onComplete={() => router.push('/contracts')}
          />
        </div>
      </div>
    )
  }

  // ── Render: wizard ──────────────────────────────────────────────
  const currentStepMeta = STEPS.find(s => s.id === step) || STEPS[0]
  // Step 3 collects the counterparty — that's the "Assignee" on an Assignment
  // and the "Buyer" on a Purchase, so the step title adapts to the chosen type.
  const activeTemplate = templates.find(t => String(t.id) === String(templateId))
  const stepName = step === 3
    ? (activeTemplate?.slug === 'assignment' ? 'Assignee Info' : 'Buyer Info')
    : currentStepMeta.name

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/contracts')}
            className="p-2 rounded hover:bg-[#FAFAF8] transition-colors shrink-0"
            aria-label="Back to contracts"
          >
            <ArrowLeft size={20} className="text-[#737370]" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-[#1A1816] truncate">
              New Contract <span className="text-[#A8A8A4] font-normal">— Step {step} of 5 · {stepName}</span>
            </h1>
            <div className="mt-0.5">
              <SaveStatus
                autoSaving={autoSaving}
                lastSavedAt={lastSavedAt}
                dirty={dirty}
                error={autoSaveError}
                status="draft"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step pill indicator */}
      <div className="flex items-center gap-1.5">
        {STEPS.map(s => (
          <div
            key={s.id}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s.id < step ? 'bg-[#D03839]'
              : s.id === step ? 'bg-[#D03839]'
              : 'bg-[#E8E8E4]'
            }`}
          />
        ))}
      </div>

      {/* Step body */}
      <div className="bg-white border border-[#E8E8E4] rounded p-4 md:p-6">
        {step === 1 && (
          <Step1ContractType
            templates={templates}
            templatesLoading={templatesLoading}
            templateId={templateId}
            onSelect={(id) => { setTemplateId(String(id)); setDirty(true) }}
          />
        )}
        {step === 2 && (
          <Step2Property
            properties={properties}
            propertiesLoading={propertiesLoading}
            propertyId={propertyId}
            onChange={handlePropertyChange}
            manualAddress={fieldValues.property_address}
            onManualAddressChange={(v) => setField('property_address', v)}
          />
        )}
        {step === 3 && (
          <Step3Buyer
            buyerName={buyerName}
            buyerEmail={buyerEmail}
            sellerEmail={effectiveEmail || sellerEmail}
            onBuyerNameChange={(v) => { setBuyerName(v); setDirty(true) }}
            onBuyerEmailChange={(v) => { setBuyerEmail(v); setDirty(true) }}
            template={templates.find(t => String(t.id) === String(templateId))}
            coSellerName={fieldValues.co_seller_name}
            onCoSellerNameChange={v => { setFieldValues(prev => ({ ...prev, co_seller_name: v })); setDirty(true) }}
          />
        )}
        {step === 4 && (
          <Step4Terms
            values={fieldValues}
            onChange={setField}
            template={templates.find(t => String(t.id) === String(templateId))}
            onPersistDefault={persistDefault}
            savedDefaults={savedDefaults}
          />
        )}
        {step === 5 && (
          <Step5Review
            template={templates.find(t => String(t.id) === String(templateId))}
            propertyId={propertyId}
            property={properties.find(p => p.id === propertyId)}
            buyerName={buyerName}
            buyerEmail={buyerEmail}
            fieldValues={fieldValues}
            sellerName={effectiveName || sellerName}
            sellerEmail={effectiveEmail || sellerEmail}
            onJump={setStep}
          />
        )}
      </div>

      {sendError && (
        <div className="flex items-start gap-3 p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[#B82F30]">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium flex-1">{sendError}</p>
        </div>
      )}

      {/* Sticky footer */}
      <StickyActionBar>
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="h-9 px-4 border border-[#E8E8E4] text-[#444441] text-[13px] font-semibold rounded hover:border-[#1A1816] transition-colors flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <SaveStatus
            autoSaving={autoSaving}
            lastSavedAt={lastSavedAt}
            dirty={dirty}
            error={autoSaveError}
            status="draft"
          />
        </div>
        {step < 5 ? (
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinueFromStep(step)}
            className="flex items-center gap-1.5 h-9 px-5 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !buyerEmail || !templateId}
            className="flex items-center gap-1.5 h-9 px-5 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Send Contract
              </>
            )}
          </button>
        )}
      </StickyActionBar>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Step components
// ─────────────────────────────────────────────────────────────────

function Step1ContractType({ templates, templatesLoading, templateId, onSelect }) {
  if (templatesLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 bg-[#E8E8E4] rounded w-48" />
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-[#E8E8E4] rounded" />)}
      </div>
    )
  }
  if (!templates.length) {
    return (
      <div className="text-center py-8">
        <FileText className="w-10 h-10 text-[#A8A8A4] mx-auto mb-3" />
        <p className="text-[14px] font-semibold text-[#1A1816] mb-1">No contract templates available</p>
        <p className="text-[13px] text-[#737370]">Set up templates in DocuSeal to enable contracts.</p>
      </div>
    )
  }
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[16px] font-bold text-[#1A1816] mb-1">Pick a contract type</h2>
        <p className="text-[13px] text-[#737370]">Choose the template that matches the deal you're sending.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {templates.map(t => {
          const selected = String(t.id) === String(templateId)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`text-left p-4 rounded border-2 transition-all flex items-start gap-3 ${
                selected
                  ? 'border-[#D03839] bg-[#FEF0EF]'
                  : 'border-[#E8E8E4] bg-white hover:border-[#1A1816]'
              }`}
            >
              <div className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${selected ? 'bg-[#D03839]/10' : 'bg-[#FAFAF8]'}`}>
                <FileText className={`w-4 h-4 ${selected ? 'text-[#D03839]' : 'text-[#737370]'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[14px] font-semibold mb-0.5 ${selected ? 'text-[#D03839]' : 'text-[#1A1816]'}`}>{t.label}</p>
                <p className="text-[12px] text-[#737370] leading-relaxed">{t.description}</p>
              </div>
              {selected && <Check className="w-4 h-4 text-[#D03839] shrink-0 mt-1" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Step2Property({ properties, propertiesLoading, propertyId, onChange, manualAddress, onManualAddressChange }) {
  const isManual = propertyId === 'manual'
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[16px] font-bold text-[#1A1816] mb-1">Pick the property</h2>
        <p className="text-[13px] text-[#737370]">We'll pre-fill the address on the contract. Don't see it? Enter the address manually.</p>
      </div>

      <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Your listings</label>
      {propertiesLoading ? (
        <div className="h-10 bg-[#E8E8E4] rounded animate-pulse" />
      ) : (
        <select
          value={propertyId}
          onChange={e => onChange(e.target.value)}
          className="w-full h-10 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] bg-white focus:outline-none focus:border-[#1A1816]"
        >
          <option value="">— Select a property —</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>
              {p.address || `Untitled (${p.id.slice(0, 8)})`}
              {p.price ? ` · ${fmtPrice(p.price)}` : ''}
            </option>
          ))}
          <option value="manual">I'll enter the address manually</option>
        </select>
      )}

      {isManual && (
        <div className="mt-4">
          <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">
            Property Address <span className="text-[#D03839]">*</span>
          </label>
          <input
            type="text"
            value={manualAddress || ''}
            onChange={e => onManualAddressChange(e.target.value)}
            placeholder="123 Main St, Dallas, TX 75201"
            className="w-full h-10 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816]"
          />
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
              <p className="text-[12px] text-[#737370] mt-0.5">
                {p.price ? fmtPrice(p.price) : '—'}
                {p.bedrooms ? ` · ${p.bedrooms} bd` : ''}
                {p.bathrooms ? ` · ${p.bathrooms} ba` : ''}
                {p.floor_area ? ` · ${Number(p.floor_area).toLocaleString()} sqft` : ''}
              </p>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function Step3Buyer({ buyerName, buyerEmail, sellerEmail, onBuyerNameChange, onBuyerEmailChange, template, coSellerName, onCoSellerNameChange }) {
  const isSelfDeal = !!buyerEmail.trim() && !!sellerEmail &&
    buyerEmail.trim().toLowerCase() === sellerEmail.trim().toLowerCase()
  const isAssignment = template?.slug === 'assignment'
  // Match the form labels to the exact verbiage in the rendered contract so
  // there's no mental translation. Assignment → the counterparty is the
  // "Assignee" (end buyer). Purchase & Sale → you sign as the Seller, so the
  // counterparty is the "Buyer".
  const partyLabel  = isAssignment ? 'Assignee' : 'Buyer'
  const partyDescription = isAssignment
    ? "The party you're assigning the contract to. They'll receive a copy to sign once you finish."
    : "The buyer you're selling to. They'll receive a copy to sign once you finish."
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[16px] font-bold text-[#1A1816] mb-1">{partyLabel} info</h2>
        <p className="text-[13px] text-[#737370]">{partyDescription}</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">{partyLabel} Full Name</label>
          <input
            type="text"
            value={buyerName}
            onChange={e => onBuyerNameChange(e.target.value)}
            placeholder="John Smith"
            className="w-full h-10 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816]"
          />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">
            {partyLabel} Email <span className="text-[#D03839]">*</span>
          </label>
          <input
            type="email"
            value={buyerEmail}
            onChange={e => onBuyerEmailChange(e.target.value)}
            placeholder="buyer@example.com"
            className="w-full h-10 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816]"
            required
          />
          {isSelfDeal ? (
            <p className="text-[12px] text-[#D03839] mt-1.5">
              This is your own email — the {partyLabel.toLowerCase()} must be a different person.
            </p>
          ) : (
            <p className="text-[12px] text-[#A8A8A4] mt-1.5">
              The {partyLabel.toLowerCase()} will only get a signing link after you sign first.
            </p>
          )}
        </div>
      </div>

      {template?.slug === 'purchase' && (
        <CoSellerField name={coSellerName} onChange={onCoSellerNameChange} />
      )}
    </div>
  )
}

// Optional co-seller for jointly-owned properties (e.g. spouses).
// Pre-fills the contract's seller2_print_name slot only — the co-seller signs
// by hand on the printed copy.
function CoSellerField({ name, onChange }) {
  const [open, setOpen] = useState(!!name)
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 inline-flex items-center gap-1 text-[12px] font-semibold text-[#D03839] hover:text-[#B82F30]"
      >
        + Add co-seller (optional)
      </button>
    )
  }
  return (
    <div className="mt-5 pt-5 border-t border-[#E8E8E4]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[13px] font-semibold text-[#1A1816]">Co-seller</p>
          <p className="text-[12px] text-[#737370]">For jointly-owned properties (e.g. spouses). Their name will print on the contract; they'll sign by hand on the printed copy.</p>
        </div>
        <button
          type="button"
          onClick={() => { onChange(''); setOpen(false); }}
          className="text-[12px] text-[#737370] hover:text-[#1A1816]"
        >
          Remove
        </button>
      </div>
      <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Co-seller Full Name</label>
      <input
        type="text"
        value={name}
        onChange={e => onChange(e.target.value)}
        placeholder="Jane Smith"
        className="w-full h-10 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816]"
      />
    </div>
  )
}

// ── Reusable input building blocks ─────────────────────────────────────
const INPUT_CLS = 'w-full h-10 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816]'
const LABEL_CLS = 'block text-[12px] font-semibold text-[#444441] mb-1.5'

function FieldRow({ label, hint, children, span }) {
  return (
    <div className={span === 'full' ? 'md:col-span-2' : ''}>
      <label className={LABEL_CLS}>{label}{hint && <span className="text-[#A8A8A4] font-normal ml-1">{hint}</span>}</label>
      {children}
    </div>
  )
}

function Step4Terms({ values, onChange, template, onPersistDefault, savedDefaults }) {
  const slug = template?.slug
  const isAssignment = slug === 'assignment'

  // "Save as default" toggle below selected fields — updates localStorage on toggle.
  const SavedAsDefault = ({ fieldKey }) => {
    const current = values[fieldKey] || ''
    const saved = savedDefaults?.[fieldKey] || ''
    const isSaved = !!saved && saved === current
    if (!current.trim()) return null
    return (
      <button
        type="button"
        onClick={() => {
          if (isSaved) { onPersistDefault?.(fieldKey, ''); }
          else { onPersistDefault?.(fieldKey, current); }
          // Force re-render via a tiny formData touch
          onChange(fieldKey, current)
        }}
        className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${isSaved ? 'text-[#0F6E56]' : 'text-[#737370] hover:text-[#1A1816]'}`}
        title={isSaved ? 'This is saved as your default for future contracts. Click to unset.' : 'Save this value as the default for future contracts.'}
      >
        <span className={`w-3 h-3 rounded border ${isSaved ? 'bg-[#0F6E56] border-[#0F6E56]' : 'border-[#A8A8A4]'} inline-flex items-center justify-center`}>
          {isSaved && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
        </span>
        {isSaved ? 'Saved as default' : 'Save as default'}
      </button>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[16px] font-bold text-[#1A1816] mb-1">Deal terms</h2>
        <p className="text-[13px] text-[#737370]">
          {isAssignment
            ? 'Numbers and dates that pre-fill on the assignment contract. Required fields are marked.'
            : 'Numbers, dates, and parties that pre-fill on the purchase contract. Required fields are marked.'}
        </p>
      </div>

      {/* ── Universal: price + earnest money + closing date + (financing if purchase) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldRow label={isAssignment ? 'Assignment Fee ($)' : 'Agreed Sale Price ($)'} hint="*">
          <input
            type="number"
            value={values.purchase_price || ''}
            onChange={e => onChange('purchase_price', e.target.value)}
            placeholder={isAssignment ? '15000' : '250000'}
            className={INPUT_CLS}
          />
        </FieldRow>

        <FieldRow label={isAssignment ? 'Nonrefundable Deposit ($)' : 'Earnest Money Deposit ($)'} hint="*">
          <input
            type="number"
            value={values.emd || ''}
            onChange={e => onChange('emd', e.target.value)}
            placeholder={isAssignment ? '1000' : '5000'}
            className={INPUT_CLS}
          />
        </FieldRow>

        <FieldRow label="Closing Date" hint="*">
          <input
            type="date"
            value={values.closing_date || ''}
            onChange={e => onChange('closing_date', e.target.value)}
            className={INPUT_CLS}
          />
        </FieldRow>

        {!isAssignment && (
          <FieldRow label="Buyer's Source of Funds" hint="cash or financing">
            <div className="flex items-center gap-2">
              {FINANCING_OPTIONS.map(opt => {
                const selected = values.financing_type === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange('financing_type', selected ? '' : opt.value)}
                    className={`flex-1 h-10 px-3 rounded border-2 text-[13px] font-semibold transition-colors ${
                      selected ? 'border-[#D03839] bg-[#FEF0EF] text-[#D03839]' : 'border-[#E8E8E4] bg-white text-[#444441] hover:border-[#1A1816]'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </FieldRow>
        )}
      </div>

      {/* ── Purchase Contract specific ─────────────────────────── */}
      {!isAssignment && (
        <>
          <div className="mt-6 mb-3">
            <p className="text-[11px] font-bold text-[#A8A8A4] uppercase tracking-wide">Property Details</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldRow label="Property Tax ID(s)">
              <input
                type="text"
                value={values.property_tax_id || ''}
                onChange={e => onChange('property_tax_id', e.target.value)}
                placeholder="Parcel / APN"
                className={INPUT_CLS}
              />
            </FieldRow>
            <FieldRow label="Other Description" hint="optional">
              <input
                type="text"
                value={values.other_description || ''}
                onChange={e => onChange('other_description', e.target.value)}
                placeholder="e.g. includes adjacent lot 4B"
                className={INPUT_CLS}
              />
            </FieldRow>
          </div>

          <div className="mt-6 mb-3">
            <p className="text-[11px] font-bold text-[#A8A8A4] uppercase tracking-wide">Parties' Addresses</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldRow label="Your Address (Seller)">
              <input
                type="text"
                value={values.seller_address || ''}
                onChange={e => onChange('seller_address', e.target.value)}
                placeholder="123 Your St, City, ST 00000"
                className={INPUT_CLS}
              />
              <SavedAsDefault fieldKey="seller_address" />
            </FieldRow>
            <FieldRow label="Buyer's Address" hint="counterparty">
              <input
                type="text"
                value={values.buyer_address || ''}
                onChange={e => onChange('buyer_address', e.target.value)}
                placeholder="Where to send paperwork"
                className={INPUT_CLS}
              />
            </FieldRow>
          </div>

          <div className="mt-6 mb-3">
            <p className="text-[11px] font-bold text-[#A8A8A4] uppercase tracking-wide">Escrow &amp; Closing</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldRow label="Title Company / Escrow Agent" hint="who holds the earnest money">
              <input
                type="text"
                value={values.emd_escrow || ''}
                onChange={e => onChange('emd_escrow', e.target.value)}
                placeholder="e.g. Stewart Title of Texas"
                className={INPUT_CLS}
              />
              <SavedAsDefault fieldKey="emd_escrow" />
            </FieldRow>
            <FieldRow label="Closing Location" hint="usually title company address">
              <input
                type="text"
                value={values.closing_location || ''}
                onChange={e => onChange('closing_location', e.target.value)}
                placeholder="Same as escrow holder if not sure"
                className={INPUT_CLS}
              />
              <SavedAsDefault fieldKey="closing_location" />
            </FieldRow>
          </div>

          <div className="mt-6 mb-3">
            <p className="text-[11px] font-bold text-[#A8A8A4] uppercase tracking-wide">Inspection &amp; Acceptance</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldRow label="Due Diligence Period (days)" hint="default 14">
              <input
                type="number"
                value={values.due_diligence_days || ''}
                onChange={e => onChange('due_diligence_days', e.target.value)}
                placeholder="14"
                className={INPUT_CLS}
              />
            </FieldRow>
            <FieldRow label="Seller's Acceptance Deadline" hint="default 3 days from today">
              <input
                type="date"
                value={values.acceptance_deadline || ''}
                onChange={e => onChange('acceptance_deadline', e.target.value)}
                className={INPUT_CLS}
              />
            </FieldRow>
          </div>
        </>
      )}

      {/* ── Assignment Contract specific ──────────────────────── */}
      {isAssignment && (
        <>
          <div className="mt-6 mb-3">
            <p className="text-[11px] font-bold text-[#A8A8A4] uppercase tracking-wide">Underlying Purchase Contract</p>
            <p className="text-[12px] text-[#737370] mt-1">
              Reference the original Purchase &amp; Sale Contract you're assigning. Who the seller is and when you signed it both appear in the Whereas clause.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldRow label="Original Seller Name" hint="* property owner from the original Purchase Contract">
              <input
                type="text"
                value={values.original_seller_name || ''}
                onChange={e => onChange('original_seller_name', e.target.value)}
                placeholder="Jane Doe"
                className={INPUT_CLS}
              />
            </FieldRow>
            <FieldRow label="Original Purchase Contract Signed Date" hint="*">
              <input
                type="date"
                value={values.original_psa_date || ''}
                onChange={e => onChange('original_psa_date', e.target.value)}
                className={INPUT_CLS}
              />
            </FieldRow>
          </div>
        </>
      )}

      {/* ── Special Terms (universal, last) ──────────────────── */}
      <div className="mt-6">
        <FieldRow label={'Additional Terms'} hint={isAssignment ? 'one per line (up to 6 lines)' : 'optional'}>
          <textarea
            value={values.special_terms || ''}
            onChange={e => onChange('special_terms', e.target.value)}
            rows={isAssignment ? 6 : 4}
            placeholder={isAssignment
              ? 'Each line becomes one of the 6 numbered lines on the contract.'
              : 'Contingencies, repairs, included items, anything extra…'}
            className="w-full px-3 py-2 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816] resize-y"
          />
        </FieldRow>
      </div>
    </div>
  )
}

function Step5Review({ template, propertyId, property, buyerName, buyerEmail, fieldValues, sellerName, sellerEmail, onJump }) {
  const isAssignment = template?.slug === 'assignment'
  const counterpartyLabel = isAssignment ? 'Assignee' : 'Buyer'
  const userRoleLabel     = isAssignment ? 'Assignor (you)' : 'Seller (you)'

  const termsItems = isAssignment
    ? [
        { label: 'Assignment Fee', value: fmtPrice(fieldValues.purchase_price) },
        { label: 'Nonrefundable Deposit', value: fmtPrice(fieldValues.emd) },
        { label: 'Closing Date',        value: fmtDate(fieldValues.closing_date) },
        { label: 'Original Seller',     value: fieldValues.original_seller_name || '—' },
        { label: 'Original Purchase Contract Date', value: fmtDate(fieldValues.original_psa_date) },
        { label: 'Additional Terms',    value: fieldValues.special_terms || '—' },
      ]
    : [
        { label: 'Agreed Sale Price',   value: fmtPrice(fieldValues.purchase_price) },
        { label: 'Earnest Money',       value: fmtPrice(fieldValues.emd) },
        { label: 'Title Company / Escrow Agent', value: fieldValues.emd_escrow || '—' },
        { label: "Buyer's Source of Funds", value: fieldValues.financing_type ? (fieldValues.financing_type === 'cash' ? 'Cash' : 'Financing') : '—' },
        { label: 'Due Diligence',       value: fieldValues.due_diligence_days ? `${fieldValues.due_diligence_days} days` : '—' },
        { label: 'Acceptance Deadline', value: fmtDate(fieldValues.acceptance_deadline) },
        { label: 'Closing Date',        value: fmtDate(fieldValues.closing_date) },
        { label: 'Closing Location',    value: fieldValues.closing_location || '—' },
        { label: 'Property Tax ID',     value: fieldValues.property_tax_id || '—' },
        { label: 'Other Description',   value: fieldValues.other_description || '—' },
        { label: 'Your Address (Seller)', value: fieldValues.seller_address || '—' },
        { label: 'Buyer Address',         value: fieldValues.buyer_address || '—' },
        { label: 'Special Terms',       value: fieldValues.special_terms || '—' },
      ]

  const rows = [
    {
      section: 'Contract Type',
      step: 1,
      items: [
        { label: 'Template', value: template?.label || template?.name || '—' },
      ],
    },
    {
      section: 'Property',
      step: 2,
      items: [
        { label: 'Source',  value: propertyId === 'manual' ? 'Manual entry' : (property ? 'From your listings' : '—') },
        { label: 'Address', value: fieldValues.property_address || '—' },
      ],
    },
    {
      section: 'Parties',
      step: 3,
      items: [
        { label: userRoleLabel,     value: `${sellerName || '—'} (${sellerEmail || '—'})` },
        ...(fieldValues.co_seller_name ? [{ label: 'Co-seller', value: fieldValues.co_seller_name }] : []),
        { label: counterpartyLabel, value: `${buyerName || '—'} (${buyerEmail || '—'})` },
      ],
    },
    {
      section: 'Terms',
      step: 4,
      items: termsItems,
    },
  ]

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[16px] font-bold text-[#1A1816] mb-1">Review & send</h2>
        <p className="text-[13px] text-[#737370]">
          Double-check everything below. Hit Send Contract and you'll be taken to sign your part — the buyer gets their link after you finish.
        </p>
      </div>
      <div className="space-y-4">
        {rows.map(group => (
          <div key={group.section} className="border border-[#E8E8E4] rounded">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E8E8E4] bg-[#FAFAF8]">
              <p className="text-[12px] font-bold text-[#1A1816] uppercase tracking-wide">{group.section}</p>
              <button
                type="button"
                onClick={() => onJump(group.step)}
                className="text-[12px] text-[#D03839] hover:underline font-semibold"
              >
                Edit
              </button>
            </div>
            <div className="divide-y divide-[#F0F0EC]">
              {group.items.map(item => (
                <div key={item.label} className="flex items-start gap-3 px-4 py-2.5">
                  <p className="text-[12px] text-[#737370] w-32 shrink-0">{item.label}</p>
                  <p className="text-[13px] text-[#1A1816] flex-1 min-w-0 whitespace-pre-wrap break-words">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
