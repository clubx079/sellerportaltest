'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Shield } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

const InitialLoader = () => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink" aria-hidden />
  </div>
)

function LoginForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user')
    if (userStr) {
      router.push('/dashboard')
    } else {
      setIsCheckingAuth(false)
    }
  }, [router])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error || 'Invalid email or password')
        setLoading(false)
        return
      }
      localStorage.setItem('seller_user', JSON.stringify(json.user))
      router.push('/dashboard')
    } catch {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (isCheckingAuth) {
    return <InitialLoader />
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden flex flex-col">
      {/* Striped brand backdrop */}
      <div className="absolute inset-0 bg-stripes-backdrop" aria-hidden />
      <div className="absolute inset-0 bg-[rgba(250,250,250,0.55)]" aria-hidden />

      {/* Logo – top-left */}
      <Link
        href="/"
        className="absolute top-5 left-4 sm:left-8 z-20 inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        <Logo size="header" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Seller Portal</span>
      </Link>

      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 sm:gap-10 lg:gap-16 pt-20 sm:pt-24 lg:pt-12 pb-8 sm:pb-12 lg:pb-20 px-4 sm:px-6 lg:px-12 xl:px-16 relative z-10 max-w-7xl mx-auto w-full">
        {/* Left (desktop) / below card (mobile): brand hero */}
        <div className="w-full lg:max-w-md xl:max-w-lg flex-shrink-0 text-center lg:text-left order-2 lg:order-1">
          <p className="font-mono font-semibold text-[11px] uppercase tracking-[0.14em] text-ink mb-3">
            Seller Portal
          </p>
          <h2 className="font-display font-bold text-[29px] sm:text-[34px] xl:text-[44px] leading-[1.08] tracking-[-0.025em] text-body">
            <span className="block">List deals. Reach buyers.</span>
            <span className="mt-1 block">
              <span className="text-stroke-ink-sm sm:hidden">Grow your business.</span>
              <span className="text-stroke-ink hidden sm:inline">Grow your business.</span>
            </span>
          </h2>
          <p className="mt-3 sm:mt-4 text-smoke-2 text-sm sm:text-base leading-relaxed max-w-md mx-auto lg:mx-0">
            Sign in to manage your wholesale listings, track performance, and connect with verified buyers on the platform.
          </p>
          <div className="mt-4 sm:mt-6 lg:mt-8 inline-flex items-center justify-center lg:justify-start gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink">
            <Shield className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Secure seller sign-in</span>
          </div>
        </div>

        {/* Right (desktop) / First on mobile: brand auth card */}
        <div className="w-full max-w-[520px] flex-shrink-0 order-1 lg:order-2">
          <div className="bg-white border-[1.5px] border-ink rounded-2xl shadow-offset-6 overflow-hidden">
            {/* Card header bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-tint-2 border-b-[1.5px] border-ink">
              <div className="flex items-center gap-2.5">
                <Logo size="header" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Seller Portal</span>
              </div>
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">Log in</span>
            </div>

            <div className="p-6 sm:p-7">
              <h1 className="font-display font-bold text-[26px] tracking-[-0.025em] text-body mb-1.5">
                Welcome back
              </h1>
              <p className="text-smoke-2 text-sm mb-5 sm:mb-6">
                Sign in to your seller account to continue
              </p>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-[13px] font-semibold text-body mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="email"
                    required
                    className="block w-full border-[1.5px] border-line rounded-[9px] px-3.5 py-3 bg-white text-[14px] text-body placeholder:text-mist focus:outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-120"
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-[13px] font-semibold text-body mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleChange}
                      autoComplete="current-password"
                      required
                      className="block w-full border-[1.5px] border-line rounded-[9px] px-3.5 py-3 pr-12 bg-white text-[14px] text-body placeholder:text-mist focus:outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-120"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-mist hover:text-smoke-2 transition-colors duration-120 p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-tint border-[1.5px] border-ink rounded-[9px] px-4 py-3 text-sm font-semibold text-ink">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-ink text-white border-[1.5px] border-ink rounded-[10px] px-[22px] py-3 text-[15px] font-semibold shadow-soft-3 hover:bg-smoke-2 disabled:opacity-50 transition-all duration-120 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              {/* OR divider */}
              <div className="flex items-center gap-3 my-5">
                <span className="flex-1 h-px bg-hairline" />
                <span className="font-mono text-[10px] font-semibold text-mist">OR</span>
                <span className="flex-1 h-px bg-hairline" />
              </div>

              {/* Forgot password + Create account */}
              <div className="flex flex-col items-center gap-3">
                <Link
                  href="/forgot-password"
                  className="text-[13px] font-semibold text-ink underline hover:text-muted transition-colors duration-120 inline-block"
                >
                  Forgot Password?
                </Link>
                <p className="text-[13.5px] text-smoke-4">
                  Don&apos;t have an account?{' '}
                  <Link
                    href="/onboarding"
                    className="font-semibold text-ink underline hover:text-muted transition-colors duration-120"
                  >
                    Create Account
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
