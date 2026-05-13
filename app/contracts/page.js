'use client'
import { useState, useEffect } from 'react'
import { FileText, CheckCircle, ExternalLink } from 'lucide-react'

const STATUS = {
  completed: { label: 'Completed', cls: 'text-[#16A34A] bg-[#DCFCE7]' },
  pending: { label: 'Pending Signature', cls: 'text-[#D97706] bg-[#FEF3C7]' },
  declined: { label: 'Declined', cls: 'text-[#D03839] bg-[#FEF0EF]' },
}

function badge(status) {
  return STATUS[status] || { label: status ?? 'Unknown', cls: 'text-[#737370] bg-[#F5F5F3]' }
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState(null)

  useEffect(() => {
    const raw = localStorage.getItem('seller_user')
    if (raw) setEmail(JSON.parse(raw).email)
    else setLoading(false)
  }, [])

  useEffect(() => {
    if (!email) return
    fetch(`/api/contracts?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(setContracts)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [email])

  function signUrl(contract) {
    const sub = contract.submitters?.find(s => s.email?.toLowerCase() === email?.toLowerCase())
    if (!sub || sub.status === 'completed' || sub.status === 'declined') return null
    return `https://docuseal.com/s/${sub.slug}`
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-3 animate-pulse">
        <div className="h-7 bg-[#E8E8E4] rounded w-36" />
        <div className="h-4 bg-[#E8E8E4] rounded w-56" />
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[#E8E8E4] rounded" />)}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-[#1A1816] mb-1">Contracts</h1>
        <p className="text-[14px] text-[#737370]">
          E-signature documents tied to your listings.
        </p>
      </div>

      {contracts.length === 0 ? (
        <div className="border border-[#E8E8E4] rounded bg-white p-12 text-center">
          <div className="w-12 h-12 bg-[#D03839]/10 rounded flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-[#D03839]" />
          </div>
          <h3 className="text-[15px] font-semibold text-[#1A1816] mb-1">No contracts yet</h3>
          <p className="text-[13px] text-[#737370] max-w-[300px] mx-auto leading-relaxed">
            Contracts will appear here when a buyer initiates a deal on one of your listings.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map(c => {
            const { label, cls } = badge(c.status)
            const url = signUrl(c)
            const others = c.submitters?.filter(s => s.email?.toLowerCase() !== email?.toLowerCase()) ?? []

            return (
              <div key={c.id} className="bg-white border border-[#E8E8E4] rounded p-4 flex items-center gap-4">
                <div className="w-9 h-9 bg-[#FAFAF8] border border-[#E8E8E4] rounded flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-[#737370]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[14px] font-semibold text-[#1A1816] truncate">
                      {c.template?.name || `Contract #${c.id}`}
                    </span>
                    <span className={`inline-flex h-5 px-2 rounded text-[11px] font-semibold shrink-0 items-center ${cls}`}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-[#737370] flex-wrap">
                    <span>{fmtDate(c.created_at)}</span>
                    {others.length > 0 && (
                      <span>With: {others.map(s => s.name || s.email).join(', ')}</span>
                    )}
                  </div>
                </div>

                {c.status === 'completed' ? (
                  <span className="shrink-0 text-[12px] text-[#16A34A] font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Signed
                  </span>
                ) : url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 h-8 px-4 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded transition-colors flex items-center gap-1.5"
                  >
                    Sign Now <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
