'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, CheckCircle, Plus, Download, Trash2, ChevronLeft, PenLine, Pencil } from 'lucide-react'
import { DocusealForm } from '@docuseal/react'

const STATUS = {
  completed:    { label: 'Completed',         cls: 'text-[#16A34A] bg-[#DCFCE7]' },
  awaiting_you: { label: 'Needs your signature', cls: 'text-[#D03839] bg-[#FEF0EF]' },
  viewed:       { label: 'Viewed · not signed', cls: 'text-[#D97706] bg-[#FEF3C7]' },
  awaiting:     { label: 'Awaiting signature', cls: 'text-[#D97706] bg-[#FEF3C7]' },
  sent:         { label: 'Sent',              cls: 'text-[#2563EB] bg-[#DBEAFE]' },
  declined:     { label: 'Declined',          cls: 'text-[#D03839] bg-[#FEF0EF]' },
}

const isPlaceholder = e => !e || e.includes('@noreply.deelmap.com')

// Derive a granular status for the whole contract from the per-signer states.
// DocuSeal submitter.status is one of: sent | opened | completed | declined (or
// null before the invite goes out). Returns one of the STATUS keys above.
function deriveStatus(c, myEmail) {
  const subs = c.submitters || []
  if (c.status === 'declined' || subs.some(s => s.status === 'declined')) return 'declined'
  if (c.status === 'completed' || (subs.length > 0 && subs.every(s => s.status === 'completed'))) return 'completed'

  const me = subs.find(s => s.email?.toLowerCase() === myEmail?.toLowerCase())
  // Our turn first: the seller signs inline before the counterparty is invited.
  if (me && me.status !== 'completed' && me.status !== 'declined') return 'awaiting_you'

  // We've signed — read the counterparty's progress.
  const other = subs.find(s => s !== me && !isPlaceholder(s.email)) || subs.find(s => s !== me)
  if (other) {
    if (other.status === 'completed') return 'completed'
    if (other.status === 'opened') return 'viewed'
  }
  return 'awaiting'
}

function badge(key) {
  return STATUS[key] || { label: key ?? 'Unknown', cls: 'text-[#737370] bg-[#F5F5F3]' }
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ContractsPage() {
  const router = useRouter()
  const [contracts, setContracts] = useState([])
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState(null)
  const [userId, setUserId] = useState(null)
  const [effectiveSellerId, setEffectiveSellerId] = useState(null)
  const [canCreateContract, setCanCreateContract] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deletingDraftId, setDeletingDraftId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  // Signing view
  const [signingEmbedSrc, setSigningEmbedSrc] = useState(null)
  const [signingTitle, setSigningTitle] = useState('')

  // Beta intro popup — shown once per browser
  const [showBetaPopup, setShowBetaPopup] = useState(false)
  useEffect(() => {
    try { if (!localStorage.getItem('deelmap_contracts_beta_seen')) setShowBetaPopup(true) } catch {}
  }, [])
  const dismissBeta = () => { setShowBetaPopup(false); try { localStorage.setItem('deelmap_contracts_beta_seen', '1') } catch {} }

  useEffect(() => {
    const raw = localStorage.getItem('seller_user')
    if (raw) {
      const u = JSON.parse(raw)
      setEmail(u.email)
      setUserId(u.id)
      setEffectiveSellerId(u.id)
      fetch('/api/team/workspaces', { headers: { Authorization: `Bearer ${u.id}` } })
        .then(r => r.json())
        .then(ws => {
          const isOwner = !ws?.current?.id || ws?.current?.role === 'admin'
          setCanCreateContract(isOwner || !!ws?.current?.permissions?.contracts_create)
          if (ws?.current?.effectiveSellerId) setEffectiveSellerId(ws.current.effectiveSellerId)
        })
        .catch(() => setCanCreateContract(false))
    } else setLoading(false)
  }, [])

  useEffect(() => {
    if (!email) return
    fetchContracts()
  }, [email])

  useEffect(() => {
    if (!effectiveSellerId) return
    fetchDrafts()
  }, [effectiveSellerId])

  function fetchContracts() {
    setLoading(true)
    fetch(`/api/contracts?email=${encodeURIComponent(email)}`, {
      headers: userId ? { Authorization: `Bearer ${userId}` } : {},
    })
      .then(r => r.json())
      .then(setContracts)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  function fetchDrafts() {
    fetch(`/api/contracts/drafts?seller_id=${encodeURIComponent(effectiveSellerId)}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setDrafts(data) : setDrafts([]))
      .catch(() => setDrafts([]))
  }

  function handleSignInline(contract) {
    const sub = contract.submitters?.find(s => s.email?.toLowerCase() === email?.toLowerCase())
    if (!sub || sub.status === 'completed' || sub.status === 'declined') return
    setSigningTitle(contract.name || contract.template?.name || `Contract #${contract.id}`)
    setSigningEmbedSrc(`https://docuseal.com/s/${sub.slug}`)
  }

  function handleSigningComplete() {
    setSigningEmbedSrc(null)
    setSigningTitle('')
    fetchContracts()
  }

  async function handleDelete(id) {
    setDeletingId(id)
    await fetch('/api/contracts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setContracts(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  async function handleDeleteDraft(id) {
    setDeletingDraftId(id)
    await fetch(`/api/contracts/drafts/${id}`, { method: 'DELETE' })
    setDrafts(prev => prev.filter(d => d.id !== id))
    setDeletingDraftId(null)
  }

  async function handleDownload(contractId) {
    setDownloadingId(contractId)
    try {
      const res = await fetch(`/api/contracts?type=document&id=${contractId}`)
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
    } finally {
      setDownloadingId(null)
    }
  }

  // ── Inline signing view ─────────────────────────────────────────
  if (signingEmbedSrc) {
    return (
      <div className="p-4 lg:p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setSigningEmbedSrc(null); fetchContracts() }}
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
            email={email}
            withTitle={false}
            withDownloadButton={false}
            customCss={`
              body { font-family: 'DM Sans', -apple-system, sans-serif !important; }
              .base-button { background: #D03839 !important; border-color: #D03839 !important; border-radius: 4px !important; }
              .base-button:hover { background: #E0493B !important; }
            `}
            onComplete={handleSigningComplete}
          />
        </div>
      </div>
    )
  }

  // ── Main list view ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-3 animate-pulse">
        <div className="h-7 bg-[#E8E8E4] rounded w-36" />
        <div className="h-4 bg-[#E8E8E4] rounded w-56" />
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[#E8E8E4] rounded" />)}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      {showBetaPopup && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={dismissBeta}>
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-2 flex items-start gap-3">
              <div className="w-10 h-10 bg-[#FEF3E2] rounded-full flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-[#B5620A]" /></div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-[17px] font-bold text-[#1A1816]">Contracts is in beta</h2>
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#FEF3E2] text-[#B5620A]">Beta</span>
                </div>
                <p className="text-[13px] text-[#737370] leading-relaxed">We're beta-testing contract sharing. Try it out and let us know what you think — your feedback shapes it.</p>
              </div>
            </div>
            <div className="px-4 py-3 mx-6 my-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded flex items-center justify-between">
              <span className="text-[13px] text-[#444441]">Cost per contract</span>
              <span className="text-[15px] font-bold text-[#1A1816]">$2.99</span>
            </div>
            <div className="px-6 pb-6 pt-2">
              <button onClick={dismissBeta} className="w-full h-10 bg-[#D03839] hover:bg-[#E0493B] text-white text-[14px] font-semibold rounded transition-colors">Got it</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-[#1A1816] mb-1 flex items-center gap-2">
            Contracts
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-[#FEF3E2] text-[#B5620A]">Beta</span>
          </h1>
          <p className="text-[14px] text-[#737370]">Send and manage e-signature contracts with buyers.</p>
        </div>
        {canCreateContract && (
          <button
            onClick={() => router.push('/contracts/new')}
            className="flex items-center gap-1.5 h-9 px-4 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> New Contract
          </button>
        )}
      </div>

      {/* Status summary — a quick dashboard of where every sent contract stands */}
      {contracts.length > 0 && (() => {
        const counts = contracts.reduce((acc, c) => {
          const k = deriveStatus(c, email)
          acc[k] = (acc[k] || 0) + 1
          return acc
        }, {})
        const cards = [
          { key: 'sent', label: 'Sent' },
          { key: 'viewed', label: 'Viewed' },
          { key: 'awaiting', label: 'Awaiting signature' },
          { key: 'completed', label: 'Completed' },
        ]
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            {cards.map(card => (
              <div key={card.key} className="bg-white border border-[#E8E8E4] rounded p-3">
                <div className="text-[22px] font-bold text-[#1A1816] leading-none">{counts[card.key] || 0}</div>
                <div className="text-[12px] text-[#737370] mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Drafts section — In Progress, shown below the status cards */}
      {drafts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[13px] font-bold text-[#1A1816] uppercase tracking-wide">In Progress</h2>
            <span className="text-[12px] text-[#A8A8A4]">{drafts.length} draft{drafts.length === 1 ? '' : 's'}</span>
          </div>
          <div className="space-y-2">
            {drafts.map(d => {
              const tplLabel = String(d.template_id) === '3801788' || String(d.template_id) === '3802120' ? 'Purchase Contract'
                              : String(d.template_id) === '3706747' || String(d.template_id) === '3759339' ? 'Assignment Contract'
                              : 'Contract'
              const address = d.field_values?.property_address || `Untitled ${tplLabel}`
              const buyer = d.buyer_name || d.buyer_email || 'Other party not set'
              return (
                <div key={d.id} className="bg-white border border-dashed border-[#E8E8E4] rounded p-4 flex items-center gap-4">
                  <div className="w-9 h-9 bg-[#FAFAF8] border border-[#E8E8E4] rounded flex items-center justify-center shrink-0">
                    <Pencil className="w-4 h-4 text-[#A8A8A4]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[14px] font-semibold text-[#1A1816] truncate">
                        {address}
                      </span>
                      <span className="inline-flex h-5 px-2 rounded text-[11px] font-semibold shrink-0 items-center text-[#737370] bg-[#F5F5F3]">
                        Draft
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-[#737370] flex-wrap">
                      <span>Last updated {fmtDate(d.updated_at)}</span>
                      <span>Buyer: {buyer}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/contracts/new?draft_id=${d.id}`)}
                      className="h-8 px-4 bg-[#1A1816] hover:bg-[#000] text-white text-[13px] font-semibold rounded transition-colors"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => handleDeleteDraft(d.id)}
                      disabled={deletingDraftId === d.id}
                      className="h-8 w-8 flex items-center justify-center border border-[#E8E8E4] hover:border-[#D03839] hover:text-[#D03839] text-[#A8A8A4] rounded transition-colors disabled:opacity-50"
                    >
                      {deletingDraftId === d.id
                        ? <span className="w-3.5 h-3.5 border-2 border-[#A8A8A4] border-t-transparent rounded-full animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {contracts.length === 0 && drafts.length === 0 ? (
        <div className="border border-[#E8E8E4] rounded bg-white p-12 text-center">
          <div className="w-12 h-12 bg-[#D03839]/10 rounded flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-[#D03839]" />
          </div>
          <h3 className="text-[15px] font-semibold text-[#1A1816] mb-1">No contracts yet</h3>
          <p className="text-[13px] text-[#737370] max-w-[300px] mx-auto leading-relaxed mb-4">
            Send your first contract to a buyer to get started.
          </p>
          {canCreateContract && (
            <button onClick={() => router.push('/contracts/new')}
              className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors">
              <Plus className="w-4 h-4" /> New Contract
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.length > 0 && (
            <h2 className="text-[13px] font-bold text-[#1A1816] uppercase tracking-wide mb-1">Sent</h2>
          )}
          {contracts.map(c => {
            const statusKey = deriveStatus(c, email)
            const { label, cls } = badge(statusKey)
            const mySubmitter = c.submitters?.find(s => s.email?.toLowerCase() === email?.toLowerCase())
            const canSign = mySubmitter && mySubmitter.status !== 'completed' && mySubmitter.status !== 'declined'
            const others = c.submitters?.filter(s => s.email?.toLowerCase() !== email?.toLowerCase() && !s.email?.includes('@noreply.deelmap.com')) ?? []
            const property = c.name

            return (
              <div key={c.id} className="bg-white border border-[#E8E8E4] rounded p-4 flex items-center gap-4">
                <div className="w-9 h-9 bg-[#FAFAF8] border border-[#E8E8E4] rounded flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-[#737370]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[14px] font-semibold text-[#1A1816] truncate">
                      {property || c.template?.name || `Contract #${c.id}`}
                    </span>
                    <span className={`inline-flex h-5 px-2 rounded text-[11px] font-semibold shrink-0 items-center ${cls}`}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-[#737370] flex-wrap">
                    <span>{fmtDate(c.created_at)}</span>
                    {others.length > 0 && (
                      <span>Other party: {others.map(s => s.name || s.email).join(', ')}</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {c.status === 'completed' ? (
                    <>
                      <span className="text-[12px] text-[#16A34A] font-medium flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Signed
                      </span>
                      <button
                        onClick={() => handleDownload(c.id)}
                        disabled={downloadingId === c.id}
                        className="h-8 px-3 border border-[#E8E8E4] hover:bg-[#FAFAF8] text-[#444441] text-[12px] font-semibold rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {downloadingId === c.id
                          ? <span className="w-3.5 h-3.5 border-2 border-[#A8A8A4] border-t-transparent rounded-full animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                        Download
                      </button>
                    </>
                  ) : canSign ? (
                    <button
                      onClick={() => handleSignInline(c)}
                      className="h-8 px-4 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors flex items-center gap-1.5"
                    >
                      <PenLine className="w-3.5 h-3.5" /> Sign Now
                    </button>
                  ) : (
                    <span className="text-[12px] text-[#737370]">
                      {statusKey === 'viewed' ? 'Viewed · not signed' : 'Awaiting other party'}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                    className="h-8 w-8 flex items-center justify-center border border-[#E8E8E4] hover:border-[#D03839] hover:text-[#D03839] text-[#A8A8A4] rounded transition-colors disabled:opacity-50"
                  >
                    {deletingId === c.id
                      ? <span className="w-3.5 h-3.5 border-2 border-[#A8A8A4] border-t-transparent rounded-full animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
