'use client'
import { useState, useEffect } from 'react'
import { Gift, Copy, Check, Loader2, AlertCircle, DollarSign, Users, TrendingUp } from 'lucide-react'

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function ReferralPage() {
  const [sellerId, setSellerId] = useState(null)
  const [referral, setReferral] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (userStr) {
      const id = JSON.parse(userStr).id
      setSellerId(id)
      loadReferral(id)
    } else {
      setLoading(false)
    }
  }, [])

  const loadReferral = async (id) => {
    setLoading(true)
    try {
      const res = await fetch('/api/referral', { headers: { 'x-seller-id': id } })
      const data = await res.json()
      setReferral(data.referral || null)
    } catch {
      setError('Failed to load referral info.')
    } finally {
      setLoading(false)
    }
  }

  const generateCode = async () => {
    if (!sellerId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'x-seller-id': sellerId, 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate code')
      setReferral(data.referral)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const copyCode = () => {
    if (!referral?.promo_code) return
    navigator.clipboard.writeText(referral.promo_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareMessage = referral
    ? `Use my DeelMap referral code ${referral.promo_code} to get 20% off your listing fee! https://deelmap.com`
    : ''

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-[#737370] text-[13px]">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      <div>
        <h1 className="text-[20px] font-bold text-[#1A1816] tracking-tight">Referral Program</h1>
        <p className="text-[13px] text-[#737370] mt-0.5">Share DeelMap and earn 20% of every listing fee your referrals pay.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[13px] text-[#D03839]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* How it works */}
      <div className="bg-white border border-[#E8E8E4] rounded p-5 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8A8A4]">How it works</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Get your code', desc: 'Generate your unique referral code below.' },
            { step: '2', title: 'Share it', desc: 'Send your code to wholesalers, agents, or investors.' },
            { step: '3', title: 'Earn 20%', desc: 'You get 20% of their listing fee — paid out monthly.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[#1A1816] text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0">{step}</div>
              <div>
                <p className="text-[13px] font-semibold text-[#1A1816]">{title}</p>
                <p className="text-[12px] text-[#737370] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-[#FAFAF8] border border-[#E8E8E4] rounded px-4 py-3 text-[12px] text-[#444441]">
          Your referrals also get <span className="font-semibold text-[#1A1816]">20% off</span> their first listing fee — a win for both sides.
          Payouts are processed via Stripe at the end of each month.
        </div>
      </div>

      {/* Code section */}
      {!referral ? (
        <div className="bg-white border border-[#E8E8E4] rounded p-6 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#FAFAF8] border border-[#E8E8E4] flex items-center justify-center">
            <Gift className="w-6 h-6 text-[#737370]" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#1A1816]">You don't have a referral code yet</p>
            <p className="text-[13px] text-[#737370] mt-1">Click below to generate your unique code instantly.</p>
          </div>
          <button
            onClick={generateCode}
            disabled={generating}
            className="h-[42px] px-6 bg-[#1A1816] hover:bg-[#2d2d2a] text-white text-[13px] font-semibold rounded transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Get my referral code'}
          </button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Users, label: 'Times used', value: referral.times_redeemed ?? 0 },
              { icon: DollarSign, label: 'Est. earnings', value: referral.estimated_earnings > 0 ? formatCents(referral.estimated_earnings) : '$0.00' },
              { icon: TrendingUp, label: 'Payout rate', value: '20%' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white border border-[#E8E8E4] rounded p-4">
                <Icon className="w-4 h-4 text-[#A8A8A4] mb-2" />
                <p className="text-[18px] font-bold text-[#1A1816]">{value}</p>
                <p className="text-[11px] text-[#737370] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Code display */}
          <div className="bg-white border border-[#E8E8E4] rounded p-5 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8A8A4]">Your referral code</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#FAFAF8] border border-[#E8E8E4] rounded px-4 py-3">
                <span className="text-[22px] font-bold tracking-widest text-[#1A1816]">{referral.promo_code}</span>
              </div>
              <button
                onClick={copyCode}
                className="h-[46px] px-4 border border-[#E8E8E4] rounded hover:bg-[#FAFAF8] text-[13px] font-medium text-[#444441] flex items-center gap-2 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-[#0F6E56]" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[12px] text-[#737370]">Share via</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`sms:?body=${encodeURIComponent(shareMessage)}`}
                  className="px-3 py-1.5 text-[12px] font-medium border border-[#E8E8E4] rounded hover:bg-[#FAFAF8] text-[#444441] transition-colors"
                >
                  SMS
                </a>
                <a
                  href={`mailto:?subject=Get 20% off on DeelMap&body=${encodeURIComponent(shareMessage)}`}
                  className="px-3 py-1.5 text-[12px] font-medium border border-[#E8E8E4] rounded hover:bg-[#FAFAF8] text-[#444441] transition-colors"
                >
                  Email
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-[12px] font-medium border border-[#E8E8E4] rounded hover:bg-[#FAFAF8] text-[#444441] transition-colors"
                >
                  WhatsApp
                </a>
                <button
                  onClick={copyCode}
                  className="px-3 py-1.5 text-[12px] font-medium border border-[#E8E8E4] rounded hover:bg-[#FAFAF8] text-[#444441] transition-colors"
                >
                  Copy link
                </button>
              </div>
            </div>
          </div>

          <p className="text-[12px] text-[#A8A8A4]">
            Payouts are calculated at the end of each month and sent via Stripe. Estimated earnings shown above are based on completed transactions using your code.
          </p>
        </>
      )}
    </div>
  )
}
