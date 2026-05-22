'use client'

import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, MapPin, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const InitialLoader = () => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D03839]" aria-hidden />
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

      if (!['approved', 'onboarding'].includes(application.status)) {
        setError('Your application status does not allow login. Please contact support.')
        setLoading(false)
        return
      }

      const { data: planRow } = await supabase
        .from('seller_plans')
        .select('plan_type')
        .eq('seller_id', application.id)
        .maybeSingle()

      const userData = {
        id: application.id,
        email: application.email,
        businessName: application.business_name,
        contactPersonName: application.contact_person_name,
        phone: application.phone,
        businessType: application.business_type,
        plan: planRow?.plan_type || null,
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
    <div className="min-h-screen bg-white flex flex-col relative overflow-x-hidden">
      {/* Logo – top-left, responsive for mobile */}
      <Link
        href="/"
        className="login-logo-enter absolute top-4 left-4 right-4 sm:right-auto sm:left-8 z-20 flex items-center justify-between sm:justify-start gap-2 transition-opacity hover:opacity-80"
      >
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="h-14 w-[160px] flex items-center justify-center shrink-0">
            {!logoError ? (
              <Image
                src="/assets/logo.svg"
                alt="DeelMap"
                width={160}
                height={56}
                className="h-14 w-auto object-contain"
                priority
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-9 h-9 rounded bg-[#1A1816] flex items-center justify-center">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            )}
          </div>
        </div>
      </Link>

      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-8 lg:gap-16 pt-20 sm:pt-24 lg:pt-12 pb-8 sm:pb-12 lg:pb-20 px-4 sm:px-6 lg:px-12 xl:px-16 relative z-10 max-w-7xl mx-auto w-full">
        {/* Left (desktop) / Top (mobile): tagline and supporting text */}
        <div className="w-full lg:max-w-md xl:max-w-lg flex-shrink-0 text-center lg:text-left order-2 lg:order-1">
          <h2 className="text-xl sm:text-2xl xl:text-4xl font-normal text-[#1A1816] leading-tight">
            <span className="login-hero-line1 block">List deals. Reach buyers.</span>
            <span className="login-hero-line2 mt-1 block">
              <span className="font-bold text-red-600">Grow your business.</span>
            </span>
          </h2>
          <p className="login-hero-p mt-3 sm:mt-4 text-[#444441] text-sm sm:text-base leading-relaxed max-w-md mx-auto lg:mx-0">
            Sign in to manage your wholesale listings, track performance, and connect with verified buyers on the platform.
          </p>
          <div className="login-hero-footer mt-4 sm:mt-6 lg:mt-8 flex items-center justify-center lg:justify-start gap-2 text-[#737370] text-xs sm:text-sm">
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span>Secure seller sign-in</span>
          </div>
        </div>

        {/* Right (desktop) / First on mobile: form */}
        <div className="login-form-enter w-full max-w-md flex-shrink-0 order-1 lg:order-2">
          {/* Header */}
          <div className="login-form-header-enter text-center mb-5 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1816] mb-1 sm:mb-2">
              Welcome Back
            </h1>
            <p className="text-[#444441] text-sm sm:text-base">
              Sign in to your seller account to continue
            </p>
          </div>

          {/* Form Card – responsive padding */}
          <div className="login-card-enter bg-white border-2 border-[#E8E8E4] rounded p-5 sm:p-6 lg:p-8 shadow-lg relative z-10 transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-0.5">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#444441] mb-1.5 sm:mb-2">
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
                  className="block w-full min-h-[44px] sm:h-12 px-4 rounded border border-[#D4D4CF] bg-white text-[#1A1816] placeholder:text-[#A8A8A4] text-base focus:outline-none focus:ring-2 focus:ring-[#D03839]/20 focus:border-[#D03839] transition-all duration-200"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#444441] mb-1.5 sm:mb-2">
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
                    className="block w-full min-h-[44px] sm:h-12 px-4 pr-12 rounded border border-[#D4D4CF] bg-white text-[#1A1816] placeholder:text-[#A8A8A4] text-base focus:outline-none focus:ring-2 focus:ring-[#D03839]/20 focus:border-[#D03839] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A8A4] hover:text-[#444441] transition-colors p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] sm:h-12 rounded bg-[#D03839] hover:bg-[#E0493B] text-white text-sm font-semibold disabled:opacity-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#D03839] focus:ring-offset-2 active:scale-[0.99]"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            {/* Forgot password + Create account */}
            <div className="mt-4 sm:mt-6 flex flex-col items-center gap-3">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-[#444441] hover:text-[#1A1816] transition-colors inline-block"
              >
                Forgot Password?
              </Link>
              <p className="text-sm text-[#737370]">
                Don&apos;t have an account?{' '}
                <Link
                  href="/onboarding"
                  className="font-semibold text-[#D03839] hover:text-[#E0493B] transition-colors"
                >
                  Create Account
                </Link>
              </p>
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D03839]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
