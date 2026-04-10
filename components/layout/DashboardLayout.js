// components/DashboardLayout.js

'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import Image from 'next/image'
import Link from 'next/link'
import { Menu } from 'lucide-react'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeItem, setActiveItem] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const isPublicPage = ['/login', '/register', '/forgot-password', '/apply', '/'].includes(pathname) || pathname.startsWith('/onboarding')
    if (isPublicPage) { setLoading(false); return; }
    const userStr = localStorage.getItem('seller_user')
    if (!userStr) { router.push('/login'); return; }
    const parsedUser = JSON.parse(userStr)
    setUser(parsedUser)
    setLoading(false)
  }, [router, pathname])

  useEffect(() => {
    const pathSegments = pathname.split('/')
    const currentItem = pathSegments.length > 1 && pathSegments[1] ? pathSegments[1] : 'dashboard'
    setActiveItem(currentItem)
  }, [pathname])

  useEffect(() => { setIsSidebarOpen(false) }, [pathname])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isSidebarOpen])

  const isPublicPage = ['/login', '/register', '/forgot-password', '/apply', '/'].includes(pathname) || pathname.startsWith('/onboarding')
  if (isPublicPage) return <>{children}</>

  if (!user && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#E8E8E4] border-t-[#1A1816]"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="h-screen overflow-hidden bg-[#FAFAF8] flex flex-col" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-white border-b border-[#E8E8E4] flex items-center justify-between px-4">
        <Link href="/dashboard" className="block">
          <Image src="/assets/logo.svg" alt="DeelMap" width={180} height={52} className="h-12 w-auto object-contain" priority />
        </Link>
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded hover:bg-[#FAFAF8] transition-colors duration-200"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-[#444441]" />
        </button>
      </header>

      {/* Sidebar — collapses on desktop, expands on hover */}
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
      />

      {/* Main content — padding shifts with sidebar width */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 pt-[calc(4rem+env(safe-area-inset-top,0px))] lg:pt-0 lg:pl-[260px]">
        <main className="flex-1 flex flex-col min-h-0 min-w-0 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
