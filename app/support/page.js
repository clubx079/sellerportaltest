'use client'

import { useState, useEffect } from 'react'
import { LifeBuoy, Check, AlertCircle, Loader2, ChevronDown } from 'lucide-react'

const CATEGORIES = ['General question', 'Listing help', 'Offers & contracts', 'Billing & plans', 'Bug / something broken', 'Feedback', 'Other']

export default function SupportPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: 'General question', message: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill name + email from the logged-in seller.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('seller_user')
      if (raw) {
        const u = JSON.parse(raw)
        setForm(prev => ({
          ...prev,
          name: u.contact_person_name || u.business_name || prev.name,
          email: u.email || prev.email,
        }))
      }
    } catch {}
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Please fill in your name, email and message.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Something went wrong. Please try again.')
        return
      }
      setSuccess(true)
      setForm(prev => ({ ...prev, subject: 'General question', message: '' }))
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-[#E8E8E4] rounded text-[14px] text-[#1A1816] placeholder-[#A8A8A4] focus:outline-none focus:border-[#D03839] focus:ring-1 focus:ring-[#D03839]/20 transition-colors'

  return (
    <div className="p-4 lg:p-6" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded bg-[#FEF0EF] flex items-center justify-center shrink-0">
          <LifeBuoy className="w-4.5 h-4.5 text-[#D03839]" />
        </div>
        <h1 className="text-[22px] font-bold text-[#1A1816] tracking-[-0.44px]">Contact Us</h1>
      </div>
      <p className="text-[14px] text-[#737370] mb-6 ml-12">Have a question or hit a snag? Send us a message and our team will get back to you.</p>

      {success ? (
        <div className="bg-white border border-[#E8E8E4] rounded p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#E4F5EC] flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-[#0F6E56]" strokeWidth={2.5} />
          </div>
          <h2 className="text-[18px] font-bold text-[#1A1816] mb-1">Message sent</h2>
          <p className="text-[14px] text-[#737370] mb-5 max-w-[360px] mx-auto">Thanks for reaching out — our team has your message and will follow up at the email you provided.</p>
          <button onClick={() => setSuccess(false)} className="px-4 py-2 text-[13px] font-semibold text-white bg-[#D03839] hover:bg-[#E0493B] rounded transition-colors">
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-[#E8E8E4] rounded p-5 lg:p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#D03839] flex-shrink-0" />
              <p className="text-[13px] text-[#D03839]">{error}</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" className={inputCls} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Topic</label>
            <div className="relative">
              <select
                value={form.subject}
                onChange={(e) => setForm(p => ({ ...p, subject: e.target.value }))}
                className={`${inputCls} appearance-none pr-10 cursor-pointer bg-white`}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-[#737370] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Message</label>
            <textarea value={form.message} onChange={(e) => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Tell us what's going on…" rows={6} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-semibold text-white bg-[#D03839] hover:bg-[#E0493B] rounded transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
