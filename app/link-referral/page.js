'use client'
import { useState, useEffect } from 'react'
import { Link2, Copy, Check, Loader2, AlertCircle, DollarSign, Users, Share2, Mail, MessageSquare, Cookie } from 'lucide-react'

function formatCents(cents) {
  if (!cents) return '$0.00'
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const BASE_URL = 'https://sell.deelmap.com'

export default function LinkReferralPage() {
  const [sellerId, setSellerId] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (userStr) {
      const id = JSON.parse(userStr).id
      setSellerId(id)
      loadData(id)
    } else {
      setLoading(false)
    }
  }, [])

  const loadData = async (id) => {
    setLoading(true)
    try {
      const res = await fetch('/api/referral/link', { headers: { 'x-seller-id': id } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const referralLink = data ? `${BASE_URL}?ref=${data.ref_code}` : ''
  const shareMessage = data
    ? `Hey, check out DeelMap — a marketplace for wholesale real estate deals. Join here: ${referralLink}`
    : ''

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 flex items-center gap-2 text-[#737370] text-[14px]" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-5" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[13px] text-[#D03839]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Hero */}
      <div className="rounded bg-[#1A1816] px-6 py-8 lg:py-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded px-3 py-1.5 mb-4">
            <Link2 className="w-3.5 h-3.5 text-[#D03839]" />
            <span className="text-[11px] font-semibold text-white uppercase tracking-[0.1em]">Link Referral Program</span>
          </div>
          <h1 className="text-[24px] lg:text-[28px] font-bold text-white leading-tight tracking-tight">
            Share a link.<br />Earn on every payment.
          </h1>
          <p className="text-[14px] text-white/60 mt-2 max-w-md">
            Anyone who signs up through your link is tied to you — you earn 20% commission on every listing fee they ever pay. No code needed for them.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
          <div className="bg-white/10 rounded px-5 py-4 text-center min-w-[140px]">
            <p className="text-[28px] font-bold text-white">20%</p>
            <p className="text-[11px] text-white/50 mt-0.5 uppercase tracking-[0.08em]">Per payment</p>
          </div>
          <div className="bg-white/10 rounded px-5 py-4 text-center min-w-[140px]">
            <p className="text-[28px] font-bold text-[#D03839]">30 days</p>
            <p className="text-[11px] text-white/50 mt-0.5 uppercase tracking-[0.08em]">Cookie window</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Users, label: 'Signed Up Via Link', value: data.signups_count },
            { icon: DollarSign, label: 'Total Earned', value: formatCents(data.total_earned_cents) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white border border-[#E8E8E4] rounded p-4 lg:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded bg-[#FAFAF8] border border-[#E8E8E4] flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-[#737370]" />
                </div>
                <p className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[0.09em]">{label}</p>
              </div>
              <p className="text-[20px] lg:text-[24px] font-bold text-[#1A1816] tracking-tight">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <div className="lg:col-span-2 space-y-4">

          {/* Link card */}
          {data && (
            <div className="bg-white border border-[#E8E8E4] rounded p-5 lg:p-6 space-y-5">
              <div>
                <p className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[0.09em] mb-3">Your Referral Link</p>
                <div className="flex items-stretch gap-2">
                  <div className="flex-1 bg-[#FAFAF8] border border-[#E8E8E4] rounded px-4 py-3 flex items-center overflow-hidden">
                    <span className="text-[13px] font-medium text-[#444441] truncate">{referralLink}</span>
                  </div>
                  <button
                    onClick={copyLink}
                    className={`px-5 rounded border text-[13px] font-semibold flex items-center gap-2 transition-all duration-200 whitespace-nowrap ${
                      copied
                        ? 'bg-[#E4F5EC] border-[#9FDBB8] text-[#0F6E56]'
                        : 'bg-white border-[#E8E8E4] text-[#444441] hover:bg-[#FAFAF8]'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy link'}</span>
                  </button>
                </div>
                <p className="text-[12px] text-[#A8A8A4] mt-2">
                  Anyone who opens this link has your referral stored in their browser for 30 days — even if they sign up later.
                </p>
              </div>

              <div className="border-t border-[#F3F3F0] pt-4">
                <p className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[0.09em] mb-3">Share Via</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <a
                    href={`sms:?body=${encodeURIComponent(shareMessage)}`}
                    className="flex items-center justify-center gap-2 h-[42px] bg-[#FAFAF8] hover:bg-[#F3F3F0] border border-[#E8E8E4] rounded text-[13px] font-medium text-[#444441] transition-colors duration-200"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#737370]" /> SMS
                  </a>
                  <a
                    href={`mailto:?subject=Check out DeelMap&body=${encodeURIComponent(shareMessage)}`}
                    className="flex items-center justify-center gap-2 h-[42px] bg-[#FAFAF8] hover:bg-[#F3F3F0] border border-[#E8E8E4] rounded text-[13px] font-medium text-[#444441] transition-colors duration-200"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#737370]" /> Email
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 h-[42px] bg-[#FAFAF8] hover:bg-[#F3F3F0] border border-[#E8E8E4] rounded text-[13px] font-medium text-[#444441] transition-colors duration-200"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[#737370]" /> WhatsApp
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Commission history */}
          {data?.commissions?.length > 0 && (
            <div className="bg-white border border-[#E8E8E4] rounded overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E8E8E4]">
                <p className="text-[13px] font-semibold text-[#1A1816]">Commission History</p>
              </div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#FAFAF8] border-b border-[#E8E8E4]">
                    {['Date', 'Commission'].map(h => (
                      <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[0.09em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.commissions.map((c, i) => (
                    <tr key={c.stripe_payment_intent_id || i} className={i < data.commissions.length - 1 ? 'border-b border-[#F3F3F0]' : ''}>
                      <td className="px-5 py-3 text-[#737370]">{formatDate(c.created_at)}</td>
                      <td className="px-5 py-3 font-semibold text-[#0F6E56]">{formatCents(c.amount_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E8E8E4] rounded p-5">
            <p className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[0.09em] mb-5">How It Works</p>
            <div className="space-y-0">
              {[
                { step: '1', title: 'Copy your link', desc: 'Your unique link has your referral code embedded in it.' },
                { step: '2', title: 'Share it anywhere', desc: 'Post in real estate groups, LinkedIn, WhatsApp — anyone who clicks it gets your referral stored in their browser for 30 days.' },
                { step: '3', title: 'They sign up — you get credit', desc: 'Even if they sign up days later, you still get credit automatically. No code for them to remember.' },
                { step: '4', title: 'Earn on every payment', desc: 'You earn 20% commission on every listing fee that person ever pays — not just their first one.' },
              ].map(({ step, title, desc }, i, arr) => (
                <div key={step} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-[#1A1816] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                      {step}
                    </div>
                    {i < arr.length - 1 && <div className="w-px flex-1 bg-[#E8E8E4] my-1.5" />}
                  </div>
                  <div className={i < arr.length - 1 ? 'pb-5' : 'pb-0'}>
                    <p className="text-[13px] font-semibold text-[#1A1816]">{title}</p>
                    <p className="text-[12px] text-[#737370] mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#FAFAF8] border border-[#E8E8E4] rounded p-4 flex gap-3">
            <Cookie className="w-4 h-4 text-[#737370] flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#737370] leading-relaxed">
              The referral is stored in the visitor's browser cookies for <strong className="text-[#444441]">30 days</strong>. If they clear cookies or sign up after 30 days, the attribution won't be recorded.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
