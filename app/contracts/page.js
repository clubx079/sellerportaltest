'use client'

import { FileText, PenLine, ShieldCheck, Clock } from 'lucide-react'

const COMING_FEATURES = [
  {
    icon: FileText,
    title: 'Contract templates',
    description: 'Pre-built wholesale assignment contracts, purchase agreements, and JV agreements — ready to send without drafting from scratch.',
  },
  {
    icon: PenLine,
    title: 'E-signatures',
    description: 'Send contracts for digital signature directly through DeelMap. Both parties sign electronically — no printing, scanning, or email chains.',
  },
  {
    icon: ShieldCheck,
    title: 'Legally binding documents',
    description: 'All signed contracts are stored securely and are legally binding. Every document is timestamped and accessible from your dashboard.',
  },
  {
    icon: Clock,
    title: 'Deal status tracking',
    description: 'See exactly where each deal stands — draft, sent, signed, or closed. Track every contract tied to your active listings in one place.',
  },
]

export default function ContractsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 h-7 px-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D03839]" />
          <span className="text-[11px] font-semibold text-[#D03839] uppercase tracking-[1.5px]">Coming Soon</span>
        </div>
        <h1 className="text-3xl font-bold text-[#1A1816] mb-2">Contracts</h1>
        <p className="text-[15px] text-[#737370] leading-relaxed max-w-xl">
          A fully integrated contracts and e-signature experience is coming to your seller dashboard — so you can go from deal listed to deal signed without leaving DeelMap.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {COMING_FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <div key={feature.title} className="bg-white border border-[#E8E8E4] rounded p-6">
              <div className="w-9 h-9 bg-[#D03839]/10 rounded flex items-center justify-center mb-4">
                <Icon className="w-4 h-4 text-[#D03839]" />
              </div>
              <h3 className="text-[15px] font-bold text-[#1A1816] mb-1.5">{feature.title}</h3>
              <p className="text-[13px] text-[#444441] leading-relaxed">{feature.description}</p>
            </div>
          )
        })}
      </div>

      {/* Status banner */}
      <div className="bg-[#1A1816] rounded p-6 sm:p-8">
        <p className="text-[11px] font-semibold text-[#737370] uppercase tracking-[1.5px] mb-3">IN DEVELOPMENT</p>
        <h2 className="text-[20px] font-bold text-white mb-2">Contracts are actively being built</h2>
        <p className="text-[14px] text-[#737370] leading-relaxed">
          Our contracts feature is powered by DocuSeal and is in active development. When it launches, you'll manage every document for every deal directly from this dashboard.
        </p>
      </div>
    </div>
  )
}
