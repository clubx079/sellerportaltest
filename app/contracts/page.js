'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, CheckCircle, Plus, Download, Trash2, ChevronLeft, PenLine, Pencil } from 'lucide-react'
import { DocusealForm } from '@docuseal/react'

// Status is value-encoded, never hue: signed/complete = ink fill, pending/sent
// = muted fill, declined = white + ink outline, draft = line-2 outline.
const CHIP_BASE = 'inline-flex items-center h-5 px-2.5 rounded-pill font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] shrink-0'
const STATUS = {
  completed:    { label: 'Completed',            cls: 'bg-ink text-white border-[1.5px] border-ink' },
  awaiting_you: { label: 'Needs your signature', cls: 'bg-muted text-white border-[1.5px] border-muted' },
  viewed:       { label: 'Viewed · not signed',  cls: 'bg-muted text-white border-[1.5px] border-muted' },
  awaiting:     { label: 'Awaiting signature',   cls: 'bg-muted text-white border-[1.5px] border-muted' },
  sent:         { label: 'Sent',                 cls: 'bg-muted text-white border-[1.5px] border-muted' },
  declined:     { label: 'Declined',             cls: 'bg-white text-ink border-[1.5px] border-ink' },
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
  return STATUS[key] || { label: key ?? 'Unknown', cls: 'bg-white text-muted border-[1.5px] border-line-2' }
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
  const [confirmDelete, setConfirmDelete] = useState(null)
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
    setConfirmDelete(null)
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
            className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-ink transition-colors duration-120"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Contracts
          </button>
        </div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-tint border-[1.5px] border-ink rounded-[10px] flex items-center justify-center shrink-0">
            <PenLine className="w-4 h-4 text-ink" />
          </div>
          <div>
            <h1 className="font-display text-[18px] font-bold text-body tracking-[-0.01em] leading-tight">{signingTitle}</h1>
            <p className="text-[13px] text-muted">Review and sign below</p>
          </div>
        </div>
        <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 overflow-hidden">
          <DocusealForm
            src={signingEmbedSrc}
            email={email}
            withTitle={false}
            withDownloadButton={false}
            customCss={`
              body { font-family: 'Instrument Sans', -apple-system, sans-serif !important; }
              .base-button { background: #111111 !important; border-color: #111111 !important; border-radius: 4px !important; }
              .base-button:hover { background: #444444 !important; }
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
        <div className="h-7 bg-hairline rounded-[8px] w-36" />
        <div className="h-4 bg-hairline rounded-[8px] w-56" />
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-hairline rounded-[12px]" />)}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      {showBetaPopup && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={dismissBeta}>
          <div className="bg-white border-[1.5px] border-ink rounded-[14px] shadow-offset-6 w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-2 flex items-start gap-3">
              <div className="w-10 h-10 bg-tint border-[1.5px] border-ink rounded-[10px] flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-ink" /></div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display text-[17px] font-bold text-body tracking-[-0.01em]">Contracts is in beta</h2>
                  <span className={`${CHIP_BASE} bg-white text-ink border-[1.5px] border-line-2`}>Beta</span>
                </div>
                <p className="text-[13px] text-muted leading-relaxed">We're beta-testing contract sharing. Try it out and let us know what you think — your feedback shapes it.</p>
              </div>
            </div>
            <div className="px-4 py-3 mx-6 my-3 bg-tint-3 border-[1.5px] border-line rounded-[10px] flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-smoke-2">Cost per contract</span>
              <span className="font-mono text-[15px] font-bold text-ink">$2.99</span>
            </div>
            <div className="px-6 pb-6 pt-2">
              <button onClick={dismissBeta} className="w-full h-10 bg-ink hover:bg-smoke-2 text-white text-[14px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 transition-all duration-120">Got it</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-[24px] font-bold text-body tracking-[-0.02em] mb-1 flex items-center gap-2">
            Contracts
            <span className={`${CHIP_BASE} bg-white text-ink border-[1.5px] border-line-2`}>Beta</span>
          </h1>
          <p className="text-[14px] text-muted">Send and manage e-signature contracts with buyers.</p>
        </div>
        {canCreateContract && (
          <button
            onClick={() => router.push('/contracts/new')}
            className="flex items-center gap-1.5 h-9 px-4 bg-ink hover:bg-smoke-2 text-white text-[13px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 transition-all duration-120 shrink-0"
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {cards.map(card => (
              <div key={card.key} className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-3 p-3">
                <div className="font-display text-[22px] font-bold text-body leading-none">{counts[card.key] || 0}</div>
                <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted mt-1.5">{card.label}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Drafts section — In Progress, shown below the status cards */}
      {drafts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">In Progress</h2>
            <span className="font-mono text-[11px] text-mist">{drafts.length} draft{drafts.length === 1 ? '' : 's'}</span>
          </div>
          <div className="space-y-2">
            {drafts.map(d => {
              const tplLabel = String(d.template_id) === '3801788' || String(d.template_id) === '3802120' ? 'Purchase Contract'
                              : String(d.template_id) === '3706747' || String(d.template_id) === '3759339' ? 'Assignment Contract'
                              : 'Contract'
              const address = d.field_values?.property_address || `Untitled ${tplLabel}`
              // The "other party" is whoever the creator is NOT. If they created
              // this as the seller, the other party is the buyer, and vice-versa.
              const counterparty = d.field_values?.__contract_role === 'buyer'
                ? (d.field_values?.__seller_name || d.field_values?.__seller_email || 'Other party not set')
                : (d.buyer_name || d.buyer_email || 'Other party not set')
              return (
                <div key={d.id} className="bg-white border-[1.5px] border-dashed border-line rounded-[12px] p-4 flex items-center gap-4">
                  <div className="w-9 h-9 bg-tint-3 border-[1.5px] border-line rounded-[10px] flex items-center justify-center shrink-0">
                    <Pencil className="w-4 h-4 text-mist" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[14px] font-semibold text-body truncate">
                        {address}
                      </span>
                      <span className={`${CHIP_BASE} bg-white text-muted border-[1.5px] border-line-2`}>
                        Draft
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11.5px] text-muted flex-wrap">
                      <span>Last updated {fmtDate(d.updated_at)}</span>
                      <span>Other party: {counterparty}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/contracts/new?draft_id=${d.id}`)}
                      className="h-8 px-4 bg-ink hover:bg-smoke-2 text-white text-[13px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 transition-all duration-120"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => handleDeleteDraft(d.id)}
                      disabled={deletingDraftId === d.id}
                      className="h-8 w-8 flex items-center justify-center bg-white border-[1.5px] border-line hover:border-ink hover:text-ink text-mist rounded-[8px] transition-colors duration-120 disabled:opacity-50"
                    >
                      {deletingDraftId === d.id
                        ? <span className="w-3.5 h-3.5 border-2 border-mist border-t-transparent rounded-full animate-spin" />
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
        <div className="bg-white border-[1.5px] border-ink rounded-[14px] shadow-offset-4 p-12 text-center">
          <div className="w-12 h-12 bg-tint border-[1.5px] border-ink rounded-[10px] flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-ink" />
          </div>
          <h3 className="font-display text-[16.5px] font-semibold tracking-[-0.01em] text-body mb-1">No contracts yet</h3>
          <p className="text-[13px] text-muted max-w-[300px] mx-auto leading-relaxed mb-4">
            Send your first contract to a buyer to get started.
          </p>
          {canCreateContract && (
            <button onClick={() => router.push('/contracts/new')}
              className="inline-flex items-center gap-1.5 h-9 px-4 bg-ink hover:bg-smoke-2 text-white text-[13px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 transition-all duration-120">
              <Plus className="w-4 h-4" /> New Contract
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.length > 0 && (
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink mb-2">Sent</h2>
          )}
          {contracts.map(c => {
            const statusKey = deriveStatus(c, email)
            const { label, cls } = badge(statusKey)
            const mySubmitter = c.submitters?.find(s => s.email?.toLowerCase() === email?.toLowerCase())
            const canSign = mySubmitter && mySubmitter.status !== 'completed' && mySubmitter.status !== 'declined'
            const others = c.submitters?.filter(s => s.email?.toLowerCase() !== email?.toLowerCase() && !s.email?.includes('@noreply.deelmap.com')) ?? []
            const property = c.name

            return (
              <div key={c.id} className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-3 p-4 flex items-center gap-4">
                <div className="w-9 h-9 bg-tint-3 border-[1.5px] border-line rounded-[10px] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-muted" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[14px] font-semibold text-body truncate">
                      {property || c.template?.name || `Contract #${c.id}`}
                    </span>
                    <span className={`${CHIP_BASE} ${cls}`}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11.5px] text-muted flex-wrap">
                    <span>{fmtDate(c.created_at)}</span>
                    {others.length > 0 && (
                      <span>Other party: {others.map(s => s.name || s.email).join(', ')}</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {c.status === 'completed' ? (
                    <>
                      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Signed
                      </span>
                      <button
                        onClick={() => handleDownload(c.id)}
                        disabled={downloadingId === c.id}
                        className="h-8 px-3 bg-white border-[1.5px] border-ink hover:bg-tint text-ink text-[12px] font-semibold rounded-[10px] shadow-offset-2 transition-colors duration-120 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {downloadingId === c.id
                          ? <span className="w-3.5 h-3.5 border-2 border-mist border-t-transparent rounded-full animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                        Download
                      </button>
                    </>
                  ) : canSign ? (
                    <button
                      onClick={() => handleSignInline(c)}
                      className="h-8 px-4 bg-ink hover:bg-smoke-2 text-white text-[13px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 transition-all duration-120 flex items-center gap-1.5"
                    >
                      <PenLine className="w-3.5 h-3.5" /> Sign Now
                    </button>
                  ) : (
                    <span className="font-mono text-[11px] text-muted">
                      {statusKey === 'viewed' ? 'Viewed · not signed' : 'Awaiting other party'}
                    </span>
                  )}
                  <button
                    onClick={() => setConfirmDelete({ id: c.id, title: property || c.template?.name || `Contract #${c.id}`, completed: statusKey === 'completed' })}
                    disabled={deletingId === c.id}
                    className="h-8 w-8 flex items-center justify-center bg-white border-[1.5px] border-line hover:border-ink hover:text-ink text-mist rounded-[8px] transition-colors duration-120 disabled:opacity-50"
                  >
                    {deletingId === c.id
                      ? <span className="w-3.5 h-3.5 border-2 border-mist border-t-transparent rounded-full animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 px-4" onClick={() => deletingId == null && setConfirmDelete(null)}>
          <div className="w-full max-w-[420px] bg-white border-[1.5px] border-ink rounded-[14px] shadow-offset-6 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-2">
              <div className="w-10 h-10 bg-tint border-[1.5px] border-ink rounded-[10px] flex items-center justify-center mb-4">
                <Trash2 className="w-5 h-5 text-ink" />
              </div>
              <h3 className="font-display text-[17px] font-bold text-body tracking-[-0.01em]">Delete this contract?</h3>
              <p className="text-[13px] text-muted mt-2 leading-relaxed">
                You're about to delete <span className="font-semibold text-smoke-2">{confirmDelete.title}</span>. This permanently removes it from your contracts and can't be undone.
              </p>
              {confirmDelete.completed && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-tint border-[1.5px] border-ink rounded-[10px]">
                  <span className="text-[13px] text-ink font-semibold leading-snug">
                    This contract is completed and signed. Deleting it removes the signed PDF — make sure you've downloaded a copy first.
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId != null}
                className="h-9 px-4 bg-white border-[1.5px] border-ink hover:bg-tint text-ink text-[13px] font-semibold rounded-[10px] shadow-offset-2 transition-colors duration-120 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                disabled={deletingId != null}
                className="h-9 px-4 bg-ink hover:bg-smoke-2 text-white text-[13px] font-semibold border-[1.5px] border-ink rounded-[10px] shadow-soft-3 transition-all duration-120 flex items-center gap-1.5 disabled:opacity-60"
              >
                {deletingId != null
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" /> Deleting…</>
                  : 'Delete contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
