// components/DashboardLayout.js - 2030 Premium SaaS UI

'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import { Menu, Hotel } from 'lucide-react'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
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
    // Skip auth check for public pages (login, register)
    if (pathname === '/login' || pathname === '/register') {
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

  // Fetch hotel settings
  const fetchHotelSettings = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('name, logo')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        const hasDetails = typeof error === 'object' && error !== null && Object.keys(error).length > 0
        if (hasDetails) {
          console.error('Error fetching hotel settings:', error)
        }
        return
      }

      if (data) {
        const newHotelInfo = {
          name: data.name || 'Hotel Manager',
          logo: data.logo
        }
        setHotelInfo(newHotelInfo)
        // Cache the settings for instant load on refresh
        localStorage.setItem('hotel_settings', JSON.stringify(newHotelInfo))
      }
    } catch (error) {
      console.error('Error fetching hotel settings:', error)
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

  // For public pages, render children without layout
  if (pathname === '/login' || pathname === '/register') {
    return <>{children}</>
  }

  // Loading state for authenticated pages
  if (!user && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-900 border-t-transparent"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
            {hotelInfo.logo ? (
              <img
                src={hotelInfo.logo}
                alt={hotelInfo.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Hotel className="w-4 h-4 text-white" />
            )}
          </div>
          <span className="text-sm font-semibold text-neutral-900 truncate">{hotelInfo.name}</span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors shrink-0"
        >
          <Menu className="w-5 h-5 text-neutral-700" />
        </button>
      </header>

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
      />

      {/* Main Content Wrapper - adjusted for new sidebar width (w-64) */}
      <div className="lg:pl-64 pt-14 lg:pt-0">
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
