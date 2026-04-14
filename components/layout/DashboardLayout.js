// components/DashboardLayout.js

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, Bell } from 'lucide-react'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeItem, setActiveItem] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [notifUnread, setNotifUnread] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const notifRef = useRef(null)

  useEffect(() => {
    const isPublicPage = ['/login', '/register', '/forgot-password', '/apply', '/'].includes(pathname) || pathname.startsWith('/onboarding') || pathname.startsWith('/properties/preview')
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
    if (!user?.id) return
    let mounted = true, timer = null
    const fetchNotifs = async () => {
      try {
        const res = await fetch('/api/seller/notifications', { headers: { Authorization: `Bearer ${user.id}` } })
        const data = await res.json()
        if (!mounted) return
        if (data?.notifications) {
          setNotifications(data.notifications)
          setNotifUnread(data.notifications.filter(n => !n.is_read).length)
        }
      } catch {}
    }
    fetchNotifs()
    timer = setInterval(() => { if (document.visibilityState === 'visible') fetchNotifs() }, 30000)
    return () => { mounted = false; clearInterval(timer) }
  }, [user?.id])

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    if (notifOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [notifOpen])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isSidebarOpen])

  const isPublicPage = ['/login', '/register', '/forgot-password', '/apply', '/'].includes(pathname) || pathname.startsWith('/onboarding') || pathname.startsWith('/properties/preview')
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
        <div className="flex items-center gap-1">
          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen(prev => !prev)}
              className="relative p-2 rounded hover:bg-[#FAFAF8] transition-colors duration-200"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-[#444441]" />
              {notifUnread > 0 && (
                <span className="absolute top-1 right-1 min-w-[15px] h-[15px] flex items-center justify-center px-0.5 text-[9px] font-bold text-white bg-[#D03839] rounded-full leading-none">
                  {notifUnread > 99 ? '99+' : notifUnread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="fixed top-16 left-0 right-0 bg-white border-b border-[#E8E8E4] shadow-xl z-[200] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E4]">
                  <span className="text-[13px] font-semibold text-[#1A1816]">Notifications</span>
                  {notifUnread > 0 && (
                    <button
                      onClick={async () => {
                        if (!user?.id) return
                        await fetch('/api/seller/notifications', { method: 'POST', headers: { Authorization: `Bearer ${user.id}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_all_read' }) })
                        setNotifUnread(0)
                        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
                      }}
                      className="text-[11px] text-[#D03839] font-medium hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex items-center justify-center h-16 text-[13px] text-[#737370]">No notifications yet</div>
                  ) : (
                    notifications.map(n => (
                      <Link
                        key={n.id}
                        href={n.type === 'listing_approved' || n.type === 'listing_rejected' ? '/properties' : '/messages'}
                        onClick={async () => {
                          setNotifOpen(false)
                          if (!n.is_read && user?.id) {
                            await fetch('/api/seller/notifications', { method: 'POST', headers: { Authorization: `Bearer ${user.id}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_read', notification_id: n.id }) })
                            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
                            setNotifUnread(prev => Math.max(0, prev - 1))
                          }
                        }}
                        className={`flex items-start gap-3 px-4 py-3 border-l-2 transition-colors hover:bg-[#FAFAF8] ${n.is_read ? 'border-l-transparent bg-white' : 'border-l-[#D03839] bg-[#FAFAF8]'}`}
                      >
                        <Bell className="w-4 h-4 text-[#737370] flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] truncate ${n.is_read ? 'text-[#444441]' : 'font-semibold text-[#1A1816]'}`}>{n.title}</p>
                          <p className="text-[11px] text-[#737370] truncate mt-0.5">{n.body}</p>
                          <p className="text-[10px] text-[#A8A8A4] mt-1">{n.created_at ? new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded hover:bg-[#FAFAF8] transition-colors duration-200"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-[#444441]" />
          </button>
        </div>
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
