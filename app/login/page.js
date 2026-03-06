'use client'

import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, MapPin, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const InitialLoader = () => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" aria-hidden />
  </div>
)

function LoginForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [logoError, setLogoError] = useState(false)

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
      const { data: application, error: appError } = await supabase
        .from('seller_applications')
        .select('*')
        .eq('email', formData.email)
        .eq('password', formData.password)
        .single()

      if (appError || !application) {
        setError('Invalid email or password')
        setLoading(false)
        return
      }

      if (application.status === 'pending') {
        setError('Your application is pending review. Please wait for approval.')
        setLoading(false)
        return
      }

      if (application.status === 'under_review') {
        setError('Your application is under review. We will notify you once approved.')
        setLoading(false)
        return
      }

      if (application.status === 'on_hold') {
        setError('Your application is on hold. Please contact support for more information.')
        setLoading(false)
        return
      }

      if (application.status === 'requires_info') {
        setError('Your application requires additional information. Please check your email.')
        setLoading(false)
        return
      }

      if (application.status === 'rejected') {
        setError('Your application has been rejected. Please contact support for more information.')
        setLoading(false)
        return
      }

      if (application.status !== 'approved') {
        setError('Your application status does not allow login. Please contact support.')
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
      setLoading(false)
    }
  }

  if (isCheckingAuth) {
    return <InitialLoader />
  }

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      {/* Logo – animated entrance */}
      <Link
        href="/"
        className="login-logo-enter absolute top-6 left-6 sm:left-8 z-20 flex items-center gap-1 transition-opacity hover:opacity-80"
      >
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
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
          )}
        </div>
        <span className="text-xl font-bold text-slate-900 tracking-wide -translate-y-1">Seller</span>
      </Link>

      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-16 py-12 px-4 sm:px-6 lg:px-12 xl:px-16 relative z-10 pb-20">
        {/* Left (desktop) / Top (mobile): tagline and supporting text – white background, animated */}
        <div className="w-full lg:max-w-md xl:max-w-lg flex-shrink-0 text-center lg:text-left">
          <h2 className="text-2xl sm:text-3xl xl:text-4xl font-normal text-slate-900 leading-tight">
            <span className="login-hero-line1 block ">List deals. Reach buyers.</span>
            <span className="login-hero-line2 mt-1 block">
              <span className="font-bold text-red-600">Grow your business.</span>
            </span>
          </h2>
          <p className="login-hero-p mt-4 text-slate-600 text-base leading-relaxed max-w-md mx-auto lg:mx-0">
            Sign in to manage your wholesale listings, track performance, and connect with verified buyers on the platform.
          </p>
          <div className="login-hero-footer mt-6 lg:mt-8 flex items-center justify-center lg:justify-start gap-2 text-slate-500 text-sm">
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span>Secure seller sign-in</span>
          </div>
        </div>

        {/* Right: form – animated column */}
        <div className="login-form-enter w-full max-w-md">
          {/* Header */}
          <div className="login-form-header-enter text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome Back
            </h1>
            <p className="text-slate-600">
              Sign in to your seller account to continue
            </p>
          </div>

          {/* Form Card – scale-in + hover lift */}
          <div className="login-card-enter bg-white border-2 border-slate-200 rounded-xl p-8 shadow-lg relative z-10 transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-0.5">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
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
                  className="block w-full h-12 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all duration-200"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
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
                    className="block w-full h-12 px-4 pr-12 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold disabled:opacity-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 active:scale-[0.99]"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            {/* Forgot password only */}
            <div className="mt-6 text-center">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors inline-block"
              >
                Forgot Password?
              </Link>
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
