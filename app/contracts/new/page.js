'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DocusealForm } from '@docuseal/react'
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

const STEPS = [
  { id: 1, name: 'Contract Type' },
  { id: 2, name: 'Property' },
  { id: 3, name: 'Buyer Info' },
  { id: 4, name: 'Terms' },
  { id: 5, name: 'Review & Send' },
]

const FINANCING_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'loan', label: 'Loan' },
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
    buyer_address:       savedDefaults.buyer_address || '',
    seller_address:      '',
    property_tax_id:     '',
    other_description:   '',
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

  // ── Identity bootstrap ──────────────────────────────────────────
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('seller_user') : null
    if (!raw) return
    const u = JSON.parse(raw)
    setUserId(u.id)
    setSellerEmail(u.email)
    const myName = u.name || u.full_name || u.first_name || ''
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

  // ── Load seller's properties for the dropdown ───────────────────
  useEffect(() => {
    if (!effectiveSellerId) return
    setPropertiesLoading(true)
    supabase
      .from('properties')
      .select('id, address, price, bedrooms, bathrooms, floor_area, slug, status')
      .eq('seller_id', effectiveSellerId)
      .in('status', ['active', 'draft', 'under_review'])
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
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    }
    if (s === 4) return true // Terms are all optional in v1.
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

  // ── Send Contract (step 5) ─────────────────────────────────────
  async function handleSend() {
    if (!effectiveSellerId) return
    if (!templateId) { setSendError('Pick a contract type first.'); setStep(1); return }
    if (!buyerEmail) { setSendError('Buyer email is required.'); setStep(3); return }

    setSending(true)
    setSendError(null)

    // Flush any pending auto-save first so the draft row is current.
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
        if (json?.id) setCurrentDraftId(json.id)
      }
    } catch { /* non-fatal — proceed to DocuSeal */ }

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
              New Contract <span className="text-[#A8A8A4] font-normal">— Step {step} of 5 · {currentStepMeta.name}</span>
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
            onBuyerNameChange={(v) => { setBuyerName(v); setDirty(true) }}
            onBuyerEmailChange={(v) => { setBuyerEmail(v); setDirty(true) }}
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

function Step3Buyer({ buyerName, buyerEmail, onBuyerNameChange, onBuyerEmailChange }) {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[16px] font-bold text-[#1A1816] mb-1">Buyer info</h2>
        <p className="text-[13px] text-[#737370]">Who's signing on the buyer side?</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Buyer Full Name</label>
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
            Buyer Email <span className="text-[#D03839]">*</span>
          </label>
          <input
            type="email"
            value={buyerEmail}
            onChange={e => onBuyerEmailChange(e.target.value)}
            placeholder="buyer@example.com"
            className="w-full h-10 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816]"
            required
          />
          <p className="text-[12px] text-[#A8A8A4] mt-1.5">
            The buyer will only get a signing link after you sign first.
          </p>
        </div>
      </div>
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

      {/* ── Universal: price + EMD + closing date + (financing if purchase) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldRow label={isAssignment ? 'Assignment Fee ($)' : 'Sale Price ($)'} hint="*">
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
          <FieldRow label="Source of Funds">
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
            <FieldRow label="Your Address (Buyer)">
              <input
                type="text"
                value={values.buyer_address || ''}
                onChange={e => onChange('buyer_address', e.target.value)}
                placeholder="123 Your St, City, ST 00000"
                className={INPUT_CLS}
              />
              <SavedAsDefault fieldKey="buyer_address" />
            </FieldRow>
            <FieldRow label="Seller's Address" hint="property owner">
              <input
                type="text"
                value={values.seller_address || ''}
                onChange={e => onChange('seller_address', e.target.value)}
                placeholder="Where to send paperwork"
                className={INPUT_CLS}
              />
            </FieldRow>
          </div>

          <div className="mt-6 mb-3">
            <p className="text-[11px] font-bold text-[#A8A8A4] uppercase tracking-wide">Escrow &amp; Closing</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldRow label="EMD Escrow Holder" hint="title company / closing attorney">
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
            <FieldRow label="Original Seller Name" hint="* property owner from the PSA">
              <input
                type="text"
                value={values.original_seller_name || ''}
                onChange={e => onChange('original_seller_name', e.target.value)}
                placeholder="Jane Doe"
                className={INPUT_CLS}
              />
            </FieldRow>
            <FieldRow label="Original PSA Signed Date" hint="*">
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
        <FieldRow label={isAssignment ? 'Additional Terms' : 'Special Terms'} hint={isAssignment ? 'one per line (up to 6 lines)' : 'optional'}>
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
  const counterpartyLabel = isAssignment ? 'Assignee (end buyer)' : 'Seller (property owner)'
  const userRoleLabel     = isAssignment ? 'Assignor (you)'       : 'Buyer (you)'

  const termsItems = isAssignment
    ? [
        { label: 'Assignment Fee',      value: fmtPrice(fieldValues.purchase_price) },
        { label: 'Nonrefundable Deposit', value: fmtPrice(fieldValues.emd) },
        { label: 'Closing Date',        value: fmtDate(fieldValues.closing_date) },
        { label: 'Original Seller',     value: fieldValues.original_seller_name || '—' },
        { label: 'Original PSA Date',   value: fmtDate(fieldValues.original_psa_date) },
        { label: 'Additional Terms',    value: fieldValues.special_terms || '—' },
      ]
    : [
        { label: 'Sale Price',          value: fmtPrice(fieldValues.purchase_price) },
        { label: 'Earnest Money',       value: fmtPrice(fieldValues.emd) },
        { label: 'EMD Escrow',          value: fieldValues.emd_escrow || '—' },
        { label: 'Source of Funds',     value: fieldValues.financing_type ? (fieldValues.financing_type === 'cash' ? 'Cash' : 'Loan') : '—' },
        { label: 'Due Diligence',       value: fieldValues.due_diligence_days ? `${fieldValues.due_diligence_days} days` : '—' },
        { label: 'Acceptance Deadline', value: fmtDate(fieldValues.acceptance_deadline) },
        { label: 'Closing Date',        value: fmtDate(fieldValues.closing_date) },
        { label: 'Closing Location',    value: fieldValues.closing_location || '—' },
        { label: 'Property Tax ID',     value: fieldValues.property_tax_id || '—' },
        { label: 'Other Description',   value: fieldValues.other_description || '—' },
        { label: 'Your Address',        value: fieldValues.buyer_address || '—' },
        { label: 'Seller Address',      value: fieldValues.seller_address || '—' },
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
