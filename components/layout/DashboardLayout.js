// components/DashboardLayout.js - 2030 Premium SaaS UI

'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, MapPin } from 'lucide-react'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [activeItem, setActiveItem] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  // Initialize hotel info with cached data
  const [hotelInfo, setHotelInfo] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('hotel_settings')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          return { name: parsed.name || 'Hotel Manager', logo: parsed.logo || null }
        } catch {
          return { name: 'Hotel Manager', logo: null }
        }
      }
    }
    return { name: 'Hotel Manager', logo: null }
  })

  // Check authentication only once on mount (skip for public pages)
  useEffect(() => {
    // Skip auth check for public pages (login, register, forgot-password, apply, root)
    const isPublicPage = ['/login', '/register', '/forgot-password', '/apply', '/'].includes(pathname)
    if (isPublicPage) {
      setLoading(false)
      return
    }

    const userStr = localStorage.getItem('seller_user')
    if (!userStr) {
      router.push('/login')
      return
    }
    const parsedUser = JSON.parse(userStr)
    setUser(parsedUser)
    setLoading(false)
    // Fetch hotel settings
    fetchHotelSettings(parsedUser.id)
  }, [router, pathname])

  // Fetch hotel settings (table: settings, columns: name, logo; filter: user_id)
  const fetchHotelSettings = async (userId) => {
    if (!userId) {
      console.warn('[DashboardLayout] fetchHotelSettings: no userId, skipping')
      return
    }
    console.log('[DashboardLayout] fetchHotelSettings: requesting settings for user_id=', userId)
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('name, logo')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        // Log full error so we can see why Supabase returns 400
        console.error('[DashboardLayout] fetchHotelSettings error:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          full: String(error)
        })
        return
      }

      if (data) {
        const newHotelInfo = {
          name: data.name || 'Hotel Manager',
          logo: data.logo
        }
        setHotelInfo(newHotelInfo)
        localStorage.setItem('hotel_settings', JSON.stringify(newHotelInfo))
        console.log('[DashboardLayout] fetchHotelSettings: loaded', newHotelInfo.name ? 'name + logo' : 'defaults')
      } else {
        console.log('[DashboardLayout] fetchHotelSettings: no row found for user_id (using defaults)')
      }
    } catch (error) {
      console.error('[DashboardLayout] fetchHotelSettings exception:', error?.message || error, error)
    }
  }

  // Update active item when pathname changes
  useEffect(() => {
    const pathSegments = pathname.split('/')
    const currentItem = pathSegments.length > 1 && pathSegments[1] ? pathSegments[1] : 'dashboard'
    setActiveItem(currentItem)
  }, [pathname])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isSidebarOpen])

  // For public pages, render children without layout (no sidebar)
  const isPublicPage = ['/login', '/register', '/forgot-password', '/apply', '/'].includes(pathname)
  if (isPublicPage) {
    return <>{children}</>
  }

  // Loading state for authenticated pages
  if (!user && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9fafb]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="h-screen overflow-hidden bg-[#f9fafb] flex flex-col">
      {/* Mobile Header - same logo + Seller as desktop sidebar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 min-h-[3.5rem] bg-white border-b border-slate-200 flex items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)]">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative h-9 w-[120px] flex-shrink-0 flex items-center justify-center">
            <Image
              src="/assets/logo copy.png"
              alt="Deelmap"
              width={120}
              height={36}
              className="h-9 w-auto object-contain"
              priority
            />
          </div>
          <span className="text-xs font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap">Seller</span>
        </Link>
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="p-2.5 rounded-xl bg-slate-100 active:bg-slate-200 transition-colors shrink-0 touch-manipulation"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6 text-slate-700" />
        </button>
      </header>

      {/* Sidebar - collapsed by default on desktop, expands on hover */}
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main Content Wrapper - flex-1 min-h-0 so full-height pages (e.g. messages) don't scroll the page */}
      <div
        className={`flex-1 flex flex-col min-h-0 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pt-0 transition-[padding-left] duration-300 ease-in-out ${
          sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-60'
        }`}
      >
        <main className="flex-1 flex flex-col min-h-0 min-w-0 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
