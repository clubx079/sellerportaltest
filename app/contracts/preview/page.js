'use client'
import { useEffect, useState } from 'react'
import { Printer, X, FileText } from 'lucide-react'
import LiveContractPreview from '@/components/contracts/LiveContractPreview'

export default function ContractPreviewPage() {
  const [data, setData] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('deelmap_contract_preview')
      if (raw) setData(JSON.parse(raw))
    } catch {}
    setLoaded(true)
  }, [])

  if (loaded && !data) {
    return (
      <div className="min-h-screen bg-[#F2F1ED] flex items-center justify-center px-4">
        <div className="text-center">
          <FileText className="w-8 h-8 text-[#A8A8A4] mx-auto mb-3" />
          <p className="text-[15px] font-semibold text-[#1A1816] mb-1">Nothing to preview</p>
          <p className="text-[13px] text-[#737370]">Open this from the contract&apos;s review step using the &ldquo;Preview full contract&rdquo; button.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2F1ED] py-8 px-4">
      {/* Toolbar */}
      <div className="max-w-[820px] mx-auto mb-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 text-[12px] text-[#737370]">
          <FileText className="w-3.5 h-3.5" />
          <span>Contract preview · for review only — not yet signed</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="h-9 px-4 flex items-center gap-1.5 text-[13px] font-semibold bg-white border border-[#E8E8E4] text-[#1A1816] rounded hover:bg-[#FAFAF8]">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={() => window.close()} className="h-9 px-4 flex items-center gap-1.5 text-[13px] font-semibold bg-[#1A1816] text-white rounded hover:bg-black">
            <X className="w-4 h-4" /> Close
          </button>
        </div>
      </div>

      {/* Paper sheet */}
      <div className="max-w-[820px] mx-auto bg-white shadow-md rounded border border-[#E8E8E4] overflow-hidden">
        {data && <LiveContractPreview fullPage {...data} />}
      </div>

      <p className="max-w-[820px] mx-auto mt-4 text-[11px] text-[#A8A8A4] text-center print:hidden">
        Highlighted blanks are fields still to be completed. This matches the document that will be sent for e-signature.
      </p>
    </div>
  )
}
