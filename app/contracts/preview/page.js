'use client'
import { useEffect, useState } from 'react'
import { X, FileText } from 'lucide-react'
import LiveContractPreview from '@/components/contracts/LiveContractPreview'

export default function ContractPreviewPage() {
  const [data, setData] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('deelmap_contract_preview') || sessionStorage.getItem('deelmap_contract_preview')
      if (raw) setData(JSON.parse(raw))
    } catch {}
    setLoaded(true)
  }, [])

  if (loaded && !data) {
    return (
      <div className="min-h-screen bg-tint-2 flex items-center justify-center px-4">
        <div className="text-center">
          <FileText className="w-8 h-8 text-mist mx-auto mb-3" />
          <p className="font-display text-[15px] font-semibold text-body mb-1">Nothing to preview</p>
          <p className="text-[13px] text-muted">Open this from the contract&apos;s review step using the &ldquo;Preview full contract&rdquo; button.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-tint-2 py-8 px-4">
      {/* Toolbar */}
      <div className="max-w-[820px] mx-auto mb-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
          <FileText className="w-3.5 h-3.5" />
          <span>Contract preview · for review only — not yet signed</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.close()} className="h-9 px-4 flex items-center gap-1.5 text-[13px] font-semibold bg-ink text-white border-[1.5px] border-ink rounded-[10px] shadow-soft-3 hover:bg-smoke-2 transition-all duration-120">
            <X className="w-4 h-4" /> Close
          </button>
        </div>
      </div>

      {/* Paper sheet */}
      <div className="max-w-[820px] mx-auto bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 overflow-hidden">
        {data && <LiveContractPreview fullPage {...data} />}
      </div>

      <p className="max-w-[820px] mx-auto mt-4 font-mono text-[11px] text-mist text-center print:hidden">
        Highlighted blanks are fields still to be completed. This matches the document that will be sent for e-signature.
      </p>
    </div>
  )
}
