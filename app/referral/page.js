'use client'
import { useState, useEffect } from 'react'
import { Gift, Copy, Check, Loader2, AlertCircle, DollarSign, Users, Share2, Mail, MessageSquare, Link2, Landmark, CheckCircle, Clock, ExternalLink } from 'lucide-react'

function formatCents(cents) {
  if (!cents) return '$0.00'
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ReferralPage() {
  const [sellerId, setSellerId] = useState(null)
  const [referral, setReferral] = useState(null)
  const [payouts, setPayouts] = useState([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (userStr) {
      const id = JSON.parse(userStr).id
      setSellerId(id)
      loadAll(id)
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connect') === 'success' && sellerId) {
      checkConnect(sellerId)
      window.history.replaceState({}, '', '/referral')
    }
  }, [sellerId])

  const loadAll = async (id) => {
    setLoading(true)
    try {
      const headers = { 'x-seller-id': id }
      const [referralRes, payoutsRes, connectRes] = await Promise.all([
        fetch('/api/referral', { headers }),
        fetch('/api/referral/payouts', { headers }),
        fetch('/api/referral/connect', { headers }),
      ])
      const [referralData, payoutsData, connectData] = await Promise.all([
        referralRes.json(), payoutsRes.json(), connectRes.json(),
      ])
      // U15: auto-generate the referral code on first load so the seller never
      // has to click "Get my code" — they see their shareable code immediately.
      let ref = referralData.referral || null
      if (!ref) {
        try {
          const genRes = await fetch('/api/referral', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } })
          const genData = await genRes.json()
          if (genRes.ok && genData.referral) ref = genData.referral
        } catch {}
      }
      setReferral(ref)
      setPayouts(payoutsData.payouts || [])
      setConnected(connectData.connected || false)
    } catch {
      setError('Failed to load referral info.')
    } finally {
      setLoading(false)
    }
  }

  const checkConnect = async (id) => {
    try {
      const res = await fetch('/api/referral/connect', { headers: { 'x-seller-id': id } })
      const data = await res.json()
      setConnected(data.connected || false)
    } catch {}
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

  const connectBank = async () => {
    if (!sellerId) return
    setConnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/referral/connect', {
        method: 'POST',
        headers: { 'x-seller-id': sellerId },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setConnecting(false)
    }
  }

  const copyCode = () => {
    if (!referral?.promo_code) return
    navigator.clipboard.writeText(referral.promo_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyLink = () => {
    const msg = `Use my DeelMap referral code ${referral.promo_code} to get 20% off your listing fee! https://deelmap.com`
    navigator.clipboard.writeText(msg)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const shareMessage = referral
    ? `Use my DeelMap referral code ${referral.promo_code} to get 20% off your listing fee! https://deelmap.com`
    : ''

  const totalPaid = payouts.reduce((s, p) => s + p.amount, 0)
  const totalEarned = referral?.estimated_earnings || 0
  const heldEarnings = referral?.held_earnings || 0
  const pendingBalance = Math.max(0, totalEarned - totalPaid)

  if (loading) {
    return (
      <div className="p-4 lg:p-6 flex items-center gap-2 text-muted text-[14px] font-sans">
        <Loader2 className="w-4 h-4 motion-safe:animate-spin" /> Loading...
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 font-sans">

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 bg-tint border-[1.5px] border-ink rounded-[9px] text-[13px] font-semibold text-ink">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Hero banner — black card on paper */}
      <div className="rounded-2xl bg-coal text-white border-2 border-ink shadow-grey-7 px-6 py-8 lg:py-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-coal-line rounded-pill px-3 py-1.5 mb-4">
            <Gift className="w-3.5 h-3.5 text-white" />
            <span className="font-mono text-[11px] font-semibold text-white uppercase tracking-[0.14em]">Referral Program</span>
          </div>
          <h1 className="font-display font-bold text-[24px] lg:text-[28px] text-white leading-tight tracking-[-0.025em]">
            Share DeelMap.<br />Earn real money.
          </h1>
          <p className="text-[14px] text-mist mt-2 max-w-md">
            Give your network 20% off their first listing — and earn 20% of every fee they pay. Paid out automatically after a 30-day hold.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
          <div className="bg-white/10 border border-coal-line rounded-[12px] px-5 py-4 text-center min-w-[120px]">
            <p className="font-display text-[28px] font-bold text-white">20%</p>
            <p className="font-mono text-[11px] text-mist mt-0.5 uppercase tracking-[0.08em]">You earn</p>
          </div>
          <div className="bg-white/10 border border-coal-line rounded-[12px] px-5 py-4 text-center min-w-[120px]">
            <p className="font-display text-[28px] font-bold text-white">20%</p>
            <p className="font-mono text-[11px] text-mist mt-0.5 uppercase tracking-[0.08em]">They save</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {referral && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Users, label: 'Times Used', value: referral.times_redeemed ?? 0 },
            { icon: DollarSign, label: 'Total Earned', value: formatCents(totalEarned), sub: 'From completed payments' },
            { icon: CheckCircle, label: 'Total Paid Out', value: formatCents(totalPaid) },
            { icon: Clock, label: 'Pending Balance', value: formatCents(pendingBalance), sub: heldEarnings > 0 ? `${formatCents(heldEarnings)} maturing (30-day hold)` : 'Ready for next payout' },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 p-4 lg:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-[8px] bg-tint border border-hairline flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-ink" />
                </div>
                <p className="font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.14em]">{label}</p>
              </div>
              <p className="font-display text-[20px] lg:text-[24px] font-bold text-body tracking-[-0.01em]">{value}</p>
              {sub && <p className="text-[11px] text-mist mt-1">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <div className="lg:col-span-2 space-y-4">
          {!referral ? (
            <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 p-8 flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-tint border-[1.5px] border-ink flex items-center justify-center">
                <Gift className="w-7 h-7 text-ink" />
              </div>
              <div>
                <p className="font-display font-semibold text-[16.5px] tracking-[-0.01em] text-body">You don't have a referral code yet</p>
                <p className="text-[13px] text-muted mt-1.5 max-w-sm mx-auto">
                  Generate your unique code and start earning 20% every time someone uses it to post a listing.
                </p>
              </div>
              <button
                onClick={generateCode}
                disabled={generating}
                className="h-[46px] px-8 bg-ink border-[1.5px] border-ink hover:bg-smoke-2 active:translate-x-[2px] active:translate-y-[2px] text-white text-[14px] font-semibold rounded-[10px] shadow-soft-3 transition-all duration-120 flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {generating ? <Loader2 className="w-4 h-4 motion-safe:animate-spin" /> : <Gift className="w-4 h-4" />}
                {generating ? 'Generating...' : 'Get my referral code'}
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 p-5 lg:p-6 space-y-5">
                <div>
                  <p className="font-mono font-semibold text-[11px] uppercase tracking-[0.14em] text-ink mb-3">Your Referral Code</p>
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1 bg-tint border-[1.5px] border-ink rounded-[10px] px-5 py-4 flex items-center">
                      <span className="font-mono text-[24px] lg:text-[28px] font-bold tracking-[0.04em] text-ink">
                        {referral.promo_code}
                      </span>
                    </div>
                    <button
                      onClick={copyCode}
                      className={`px-5 rounded-[10px] border-[1.5px] border-ink shadow-offset-3 text-[13px] font-semibold flex items-center gap-2 transition-all duration-120 whitespace-nowrap ${
                        copied
                          ? 'bg-ink text-white'
                          : 'bg-white text-ink hover:bg-tint'
                      }`}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy code'}</span>
                    </button>
                  </div>
                  <p className="text-[12px] text-mist mt-2">
                    Share this code with anyone — they'll get 20% off their first listing fee on DeelMap.
                  </p>
                </div>

                <div className="border-t border-hairline pt-4">
                  <p className="font-mono font-semibold text-[11px] uppercase tracking-[0.14em] text-ink mb-3">Share Via</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <a
                      href={`sms:?body=${encodeURIComponent(shareMessage)}`}
                      className="flex items-center justify-center gap-2 h-[42px] bg-white hover:bg-tint border-[1.5px] border-line rounded-[9px] text-[13px] font-semibold text-ink transition-colors duration-120"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-muted" /> SMS
                    </a>
                    <a
                      href={`mailto:?subject=Get 20% off on DeelMap&body=${encodeURIComponent(shareMessage)}`}
                      className="flex items-center justify-center gap-2 h-[42px] bg-white hover:bg-tint border-[1.5px] border-line rounded-[9px] text-[13px] font-semibold text-ink transition-colors duration-120"
                    >
                      <Mail className="w-3.5 h-3.5 text-muted" /> Email
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 h-[42px] bg-white hover:bg-tint border-[1.5px] border-line rounded-[9px] text-[13px] font-semibold text-ink transition-colors duration-120"
                    >
                      <Share2 className="w-3.5 h-3.5 text-muted" /> WhatsApp
                    </a>
                    <button
                      onClick={copyLink}
                      className={`flex items-center justify-center gap-2 h-[42px] border-[1.5px] rounded-[9px] text-[13px] font-semibold transition-colors duration-120 ${
                        copiedLink
                          ? 'bg-ink border-ink text-white'
                          : 'bg-white hover:bg-tint border-line text-ink'
                      }`}
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5 text-muted" />}
                      {copiedLink ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Connect bank */}
              <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0 ${connected ? 'bg-ink' : 'bg-tint border border-hairline'}`}>
                    <Landmark className={`w-4 h-4 ${connected ? 'text-white' : 'text-muted'}`} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-body">
                      {connected ? 'Bank account connected' : 'Connect your bank account'}
                    </p>
                    <p className="text-[12px] text-muted mt-0.5">
                      {connected
                        ? 'Your earnings will be sent here automatically once they clear a 30-day hold.'
                        : 'Required to receive your payouts automatically.'}
                    </p>
                  </div>
                </div>
                {connected ? (
                  <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-ink flex-shrink-0">
                    <CheckCircle className="w-4 h-4" /> Connected
                  </span>
                ) : (
                  <button
                    onClick={connectBank}
                    disabled={connecting}
                    className="h-9 px-4 bg-ink border-[1.5px] border-ink hover:bg-smoke-2 text-white text-[13px] font-semibold rounded-[10px] shadow-soft-3 flex items-center gap-2 flex-shrink-0 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {connecting ? <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                    {connecting ? 'Redirecting...' : 'Connect'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: How it works */}
        <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 p-5">
          <p className="font-mono font-semibold text-[11px] uppercase tracking-[0.14em] text-ink mb-5">How It Works</p>
          <div className="space-y-0">
            {[
              { step: '1', title: 'Get your code', desc: 'Generate your personal referral code — it\'s unique to you.' },
              { step: '2', title: 'Share with anyone', desc: 'Send it to agents, wholesalers, or investors in your network.' },
              { step: '3', title: 'They save 20%', desc: 'They use your code at checkout and get 20% off their listing fee.' },
              { step: '4', title: 'You earn 20%', desc: '20% of every listing fee paid through your code goes directly to you — automatically, after a 30-day hold.' },
            ].map(({ step, title, desc }, i, arr) => (
              <div key={step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-ink text-white font-mono text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                    {step}
                  </div>
                  {i < arr.length - 1 && <div className="w-px flex-1 bg-hairline my-1.5" />}
                </div>
                <div className={`${i < arr.length - 1 ? 'pb-5' : 'pb-0'}`}>
                  <p className="text-[13px] font-semibold text-body">{title}</p>
                  <p className="text-[12px] text-muted mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-hairline">
            <p className="text-[11px] text-mist leading-relaxed">
              Payouts are released automatically once earnings clear a 30-day hold. Earnings based on 20% of the original listing fee before discount.
            </p>
          </div>
        </div>

      </div>

      {/* Payout history */}
      {payouts.length > 0 && (
        <div className="bg-white border-[1.5px] border-ink rounded-[12px] shadow-offset-4 overflow-hidden">
          <div className="px-5 py-4 border-b border-hairline">
            <p className="font-display font-semibold text-[15px] tracking-[-0.01em] text-body">Payout History</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-tint-3 border-b border-hairline">
                  {['Period', 'Amount', 'Date'].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.14em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payouts.map((p, i) => (
                  <tr key={p.id} className={`${i < payouts.length - 1 ? 'border-b border-hairline-2' : ''}`}>
                    <td className="px-5 py-3 font-mono text-[12px] text-smoke-2">
                      {p.period_start && p.period_end
                        ? `${formatDate(p.period_start)} – ${formatDate(p.period_end)}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-[12.5px] font-bold text-ink">{formatCents(p.amount)}</td>
                    <td className="px-5 py-3 font-mono text-[12px] text-muted">{formatDate(p.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
