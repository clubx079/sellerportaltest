'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'

function AcceptContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [info, setInfo]           = useState(null)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [form, setForm]           = useState({ name: '', password: '', confirm: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]           = useState(false)

  useEffect(() => {
    if (!token) { setError('Invalid invitation link.'); setLoading(false); return }
    fetch(`/api/team/accept?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setInfo(data)
        setForm(f => ({ ...f, name: data.member?.name || '' }))
      })
      .catch(() => setError('Failed to load invitation.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    const isLogin = info?.hasExistingAccount
    if (!isLogin && form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (!isLogin && form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/team/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: form.name, password: form.password, isLogin }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'Failed to accept invitation'); return }
      localStorage.setItem('seller_user', JSON.stringify({
        id: data.seller_id,
        email: data.email,
        name: data.name,
        plan: data.plan || null,
      }))
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 text-[#737370] animate-spin" />
      </div>
    )
  }

  const isLogin = info?.hasExistingAccount

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <Image src="/assets/logo-seller-portal.svg" alt="DeelMap Seller Portal" width={140} height={66} className="mx-auto mb-6" />
        </div>

        <div className="bg-white border border-[#E8E8E4] rounded-lg p-8 shadow-sm">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle className="w-10 h-10 text-[#16A34A] mx-auto mb-3" />
              <h2 className="text-[18px] font-bold text-[#1A1816] mb-1">You're in!</h2>
              <p className="text-[13px] text-[#737370]">Redirecting you to the dashboard…</p>
            </div>
          ) : error && !info ? (
            <div className="text-center py-4">
              <AlertCircle className="w-10 h-10 text-[#D03839] mx-auto mb-3" />
              <h2 className="text-[16px] font-bold text-[#1A1816] mb-1">Invalid Invitation</h2>
              <p className="text-[13px] text-[#737370]">{error}</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-[20px] font-bold text-[#1A1816] mb-1">
                  {isLogin ? 'Join Team' : 'Accept Invitation'}
                </h1>
                <p className="text-[13px] text-[#737370]">
                  You've been invited to join <strong>{info?.orgName || 'a team'}</strong> on DeelMap.
                  {isLogin && ' Log in with your existing account to accept.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Your Name</label>
                    <input
                      type="text"
                      placeholder="Jane Smith"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full h-9 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Email</label>
                  <input
                    type="email"
                    value={info?.member?.email || ''}
                    disabled
                    className="w-full h-9 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#A8A8A4] bg-[#FAFAF8]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">
                    Password <span className="text-[#D03839]">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder={isLogin ? 'Your account password' : 'Min. 8 characters'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full h-9 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816]"
                    required
                  />
                </div>

                {!isLogin && (
                  <div>
                    <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">
                      Confirm Password <span className="text-[#D03839]">*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Repeat password"
                      value={form.confirm}
                      onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                      className="w-full h-9 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816]"
                      required
                    />
                  </div>
                )}

                {error && <p className="text-[12px] text-[#D03839]">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-9 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? (isLogin ? 'Joining team…' : 'Creating account…')
                    : (isLogin ? 'Log In & Join Team' : 'Create Account & Join Team')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AcceptPage() {
  return (
    <Suspense>
      <AcceptContent />
    </Suspense>
  )
}
