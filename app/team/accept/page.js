'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)

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
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
      </div>
    )
  }

  const isLogin = info?.hasExistingAccount

  const inputCls = 'w-full border-[1.5px] border-line rounded-[9px] px-3.5 py-3 bg-white text-[14px] text-body placeholder:text-mist focus:outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-120'
  const labelCls = 'block text-[13px] font-semibold text-body mb-1.5'

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Striped brand backdrop */}
      <div className="absolute inset-0 bg-stripes-backdrop" aria-hidden />
      <div className="absolute inset-0 bg-[rgba(250,250,250,0.55)]" aria-hidden />

      <div className="w-full max-w-[520px] relative z-10">
        <div className="bg-white border-[1.5px] border-ink rounded-2xl shadow-offset-6 overflow-hidden">
          {/* Card header bar */}
          <div className="flex items-center justify-between px-6 py-4 bg-tint-2 border-b-[1.5px] border-ink">
            <div className="flex items-center gap-2.5">
              <Logo size="header" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Seller Portal</span>
            </div>
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">Team invite</span>
          </div>

          <div className="p-6 sm:p-7">
            {done ? (
              <div className="text-center py-4">
                <span className="inline-flex w-14 h-14 rounded-full bg-ink text-white items-center justify-center mx-auto mb-4" aria-hidden>
                  <svg width="20" height="15" viewBox="0 0 20 15" fill="none"><path d="M2 7.5L7.4 12.7L18 2" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <h2 className="font-display font-bold text-[22px] tracking-[-0.025em] text-body mb-1">You&apos;re in!</h2>
                <p className="text-[13px] text-smoke-4">Redirecting you to the dashboard…</p>
              </div>
            ) : error && !info ? (
              <div className="text-center py-4">
                <AlertCircle className="w-10 h-10 text-ink mx-auto mb-3" />
                <h2 className="font-display font-bold text-[20px] tracking-[-0.025em] text-body mb-1">Invalid Invitation</h2>
                <p className="text-[13px] font-semibold text-ink">{error}</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h1 className="font-display font-bold text-[26px] tracking-[-0.025em] text-body mb-1.5">
                    {isLogin ? 'Join Team' : 'Accept Invitation'}
                  </h1>
                  <p className="text-[13.5px] text-smoke-4">
                    You&apos;ve been invited to join <strong className="text-body">{info?.orgName || 'a team'}</strong> on DeelMap.
                    {isLogin && ' Log in with your existing account to accept.'}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div>
                      <label className={labelCls}>Your Name</label>
                      <input
                        type="text"
                        placeholder="Jane Smith"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      type="email"
                      value={info?.member?.email || ''}
                      disabled
                      className="w-full border-[1.5px] border-line rounded-[9px] px-3.5 py-3 text-[14px] text-mist bg-tint-3"
                    />
                  </div>

                  <div>
                    <label className={labelCls}>
                      Password <span className="text-muted">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder={isLogin ? 'Your account password' : 'Min. 8 characters'}
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        className={`${inputCls} pr-11`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-mist hover:text-smoke-2 transition-colors duration-120"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {isLogin && (
                      <div className="mt-1.5 text-right">
                        <Link
                          href={`/forgot-password${info?.member?.email ? `?email=${encodeURIComponent(info.member.email)}` : ''}`}
                          className="text-[12px] font-semibold text-ink underline hover:text-muted transition-colors duration-120"
                        >
                          Forgot password?
                        </Link>
                      </div>
                    )}
                  </div>

                  {!isLogin && (
                    <div>
                      <label className={labelCls}>
                        Confirm Password <span className="text-muted">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          placeholder="Repeat password"
                          value={form.confirm}
                          onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                          className={`${inputCls} pr-11`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-mist hover:text-smoke-2 transition-colors duration-120"
                          aria-label={showConfirm ? 'Hide password' : 'Show password'}
                        >
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="bg-tint border-[1.5px] border-ink rounded-[9px] px-3.5 py-2.5 text-[13px] font-semibold text-ink">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-ink text-white border-[1.5px] border-ink rounded-[10px] px-[22px] py-3 text-[15px] font-semibold shadow-soft-3 hover:bg-smoke-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-120"
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
