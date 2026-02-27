'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { LogIn, Mail, Lock, AlertCircle, Eye, EyeOff, MapPin, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const InitialLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#f9fafb]">
    <div
      className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-primary animate-spin"
      aria-hidden
    />
  </div>
)

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [errorShake, setErrorShake] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [logoErrorLeft, setLogoErrorLeft] = useState(false) // left panel (dark bg) uses white logo

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
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: application, error: appError } = await supabase
        .from('seller_applications')
        .select('*')
        .eq('email', formData.email)
        .eq('password', formData.password)
        .single()

      if (appError || !application) {
        setError('Invalid email or password')
        setErrorShake(true)
        setTimeout(() => setErrorShake(false), 500)
        setLoading(false)
        return
      }

      if (application.status === 'pending') {
        setError('Your application is pending review. Please wait for approval.')
        setErrorShake(true)
        setTimeout(() => setErrorShake(false), 500)
        setLoading(false)
        return
      }

      if (application.status === 'under_review') {
        setError('Your application is under review. We will notify you once approved.')
        setErrorShake(true)
        setTimeout(() => setErrorShake(false), 500)
        setLoading(false)
        return
      }

      if (application.status === 'on_hold') {
        setError('Your application is on hold. Please contact support for more information.')
        setErrorShake(true)
        setTimeout(() => setErrorShake(false), 500)
        setLoading(false)
        return
      }

      if (application.status === 'requires_info') {
        setError('Your application requires additional information. Please check your email.')
        setErrorShake(true)
        setTimeout(() => setErrorShake(false), 500)
        setLoading(false)
        return
      }

      if (application.status === 'rejected') {
        setError('Your application has been rejected. Please contact support for more information.')
        setErrorShake(true)
        setTimeout(() => setErrorShake(false), 500)
        setLoading(false)
        return
      }

      if (application.status !== 'approved') {
        setError('Your application status does not allow login. Please contact support.')
        setErrorShake(true)
        setTimeout(() => setErrorShake(false), 500)
        setLoading(false)
        return
      }

      const userData = {
        id: application.id,
        email: application.email,
        businessName: application.business_name,
        contactPersonName: application.contact_person_name,
        phone: application.phone,
        businessType: application.business_type
      }

      localStorage.setItem('seller_user', JSON.stringify(userData))
      router.push('/dashboard')
    } catch {
      setError('An error occurred. Please try again.')
      setErrorShake(true)
      setTimeout(() => setErrorShake(false), 500)
      setLoading(false)
    }
  }

  if (isCheckingAuth) {
    return <InitialLoader />
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left: Brand panel (desktop) - Deelmap buyer colors */}
      <div
        className="hidden lg:flex lg:w-[48%] xl:w-[52%] flex-col justify-between p-10 xl:p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(165deg, #022b41 0%, #034060 50%, #022b41 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #fff 1px, transparent 1px),
              linear-gradient(to bottom, #fff 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px',
          }}
        />
        <div
          className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #b29578 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #b29578 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex items-center gap-2">
          <div className="flex items-center justify-start h-10 w-[130px] shrink-0">
            {!logoErrorLeft ? (
              <Image
                src="/assets/logo.webp"
                alt="DeelMap"
                width={130}
                height={40}
                className="h-10 w-auto object-contain object-left"
                priority
                onError={() => setLogoErrorLeft(true)}
              />
            ) : (
              <div className="w-11 h-11 bg-brandRed rounded-xl flex items-center justify-center shadow-lg shadow-brandRed/25">
                <MapPin className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
          <span className="text-lg font-semibold text-white tracking-wide uppercase">Seller</span>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl xl:text-4xl font-normal text-white leading-tight">
            List deals. Reach buyers.
            <br />
            <span className="text-secondary font-medium">Grow your business.</span>
          </h2>
          <p className="mt-4 text-slate-400 text-base leading-relaxed font-normal">
            Sign in to manage your wholesale listings, track performance, and connect with verified buyers on the platform.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-slate-500 text-sm">
          <Shield className="w-4 h-4 text-slate-500" />
          <span>Secure seller sign-in</span>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen relative px-4 sm:px-6 py-10 lg:py-12">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 50% 0%, rgba(2, 43, 65, 0.04) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 80%, rgba(0, 0, 0, 0.02) 0%, transparent 50%),
              #f9fafb
            `,
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.4]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(0 0 0 / 0.03) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="lg:hidden flex items-center justify-center gap-2 mb-8 relative z-10">
          <div className="h-9 w-[120px] flex items-center justify-center shrink-0">
            {!logoError ? (
              <Image
                src="/assets/logo copy.png"
                alt="DeelMap"
                width={120}
                height={36}
                className="h-9 w-auto object-contain"
                priority
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-10 h-10 bg-brandRed rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
          <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Seller</span>
        </div>

        <div className="w-full max-w-[480px] animate-fade-in-up relative z-10">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-normal text-slate-900">Welcome back</h1>
            <p className="text-slate-600 mt-2 text-base sm:text-lg font-normal">Sign in to your seller account</p>
          </div>

          <div
            className={`login-card bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 transition-shadow ${errorShake ? 'animate-shake' : ''}`}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-base"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-base font-medium text-slate-700 mb-2.5">
                  Email address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors pointer-events-none" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="email"
                    className="w-full pl-12 pr-4 py-3.5 sm:py-4 rounded-xl border border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary focus:bg-white transition-all duration-200"
                    placeholder="you@company.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-base font-medium text-slate-700 mb-2.5">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    className="w-full pl-12 pr-12 py-3.5 sm:py-4 rounded-xl border border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary focus:bg-white transition-all duration-200"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-primary text-white text-base font-medium flex items-center justify-center gap-3 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <span
                      className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"
                      aria-hidden
                    />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Sign in
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 pt-6 border-t border-slate-100 text-center text-base text-slate-600">
              New to Deelmap?{' '}
              <button
                type="button"
                onClick={() => router.push('/apply')}
                className="font-medium text-primary hover:text-secondary hover:underline transition-colors"
              >
                Create a seller account
              </button>
            </p>
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            © {new Date().getFullYear()} Deelmap. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
