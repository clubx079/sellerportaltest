'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  MessageCircle,
  X,
  LogOut,
  MapPin,
  User
} from 'lucide-react'

const DESKTOP_BREAKPOINT = 1024

export default function Sidebar({ isOpen, setIsOpen, activeItem, setActiveItem, collapsed, onCollapsedChange }) {
  const pathname = usePathname()
  const router = useRouter()
  const [logoError, setLogoError] = useState(false)
  const leaveTimeoutRef = useRef(null)
  const [isDesktop, setIsDesktop] = useState(false)

  const isCollapsed = collapsed ?? true
  // When mobile menu is open (isOpen), show full content like desktop expanded; on desktop use collapse state
  const showExpanded = isOpen || !isCollapsed
  const [expandedContentVisible, setExpandedContentVisible] = useState(false)
  const expandContentTimeoutRef = useRef(null)

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
    const update = () => setIsDesktop(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  // Fade in expanded content after width starts growing so it doesn’t pop
  useEffect(() => {
    if (showExpanded) {
      if (isOpen) {
        setExpandedContentVisible(true)
        if (expandContentTimeoutRef.current) {
          clearTimeout(expandContentTimeoutRef.current)
          expandContentTimeoutRef.current = null
        }
      } else {
        expandContentTimeoutRef.current = setTimeout(() => {
          setExpandedContentVisible(true)
          expandContentTimeoutRef.current = null
        }, 120)
      }
    } else {
      if (expandContentTimeoutRef.current) {
        clearTimeout(expandContentTimeoutRef.current)
        expandContentTimeoutRef.current = null
      }
      setExpandedContentVisible(false)
    }
    return () => {
      if (expandContentTimeoutRef.current) clearTimeout(expandContentTimeoutRef.current)
    }
  }, [showExpanded, isOpen])

  const handleLogout = () => {
    localStorage.removeItem('seller_user')
    router.push('/login')
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'properties', label: 'Properties', icon: Building2, path: '/properties' },
    { id: 'messages', label: 'Messages', icon: MessageCircle, path: '/messages' }
  ]

  const [sellerUser, setSellerUser] = useState(null)
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('seller_user')
      if (raw) setSellerUser(JSON.parse(raw))
    } catch (_) {}
  }, [])

  useEffect(() => {
    const sellerId = sellerUser?.id || sellerUser?.userId
    if (!sellerId) return

    let mounted = true
    let timer = null

    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/seller/chat?action=get_conversations', {
          headers: {
            Authorization: `Bearer ${sellerId}`
          }
        })
        const data = await res.json()
        if (!mounted) return
        if (data?.success && Array.isArray(data.conversations)) {
          const total = data.conversations.reduce((sum, c) => sum + Number(c.unread_count || 0), 0)
          setMessagesUnreadCount(total)
        }
      } catch (_) {
        // Keep sidebar resilient if unread call fails.
      }
    }

    fetchUnread()
    timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchUnread()
      }
    }, 10000)

    return () => {
      mounted = false
      if (timer) clearInterval(timer)
    }
  }, [sellerUser?.id, sellerUser?.userId])

  useEffect(() => {
    menuItems.forEach((item) => {
      if (item.path === pathname) setActiveItem(item.id)
    })
  }, [pathname])

  const handleItemClick = (item) => {
    setActiveItem(item.id)
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsOpen(false)
    }
  }

  const handleMouseEnter = () => {
    if (!isDesktop) return
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current)
      leaveTimeoutRef.current = null
    }
    onCollapsedChange?.(false)
  }

  const handleMouseLeave = () => {
    if (!isDesktop) return
    leaveTimeoutRef.current = setTimeout(() => {
      onCollapsedChange?.(true)
      leaveTimeoutRef.current = null
    }, 280)
  }

  useEffect(() => () => {
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current)
  }, [])

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full bg-white border-r border-slate-200 flex flex-col shadow-sm
          transition-[transform,width,min-width] duration-300 ease-in-out
          ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-0'}
          lg:translate-x-0
          ${showExpanded ? 'lg:w-60 lg:min-w-60' : 'lg:w-[72px] lg:min-w-[72px]'}
          overflow-hidden
          pt-[env(safe-area-inset-top,0px)] lg:pt-0
        `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Logo / Brand - collapsed: icon only, expanded: full logo */}
        <div className="flex items-center justify-between gap-2 px-3 py-4 border-b border-slate-100 min-h-[73px] shrink-0">
          <Link href="/dashboard" className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
            {showExpanded ? (
              <span
                className={`flex items-center gap-3 min-w-0 transition-opacity duration-200 ease-out ${
                  expandedContentVisible ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div className="relative h-9 w-[120px] flex-shrink-0 flex items-center justify-center">
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
                    <div className="w-9 h-9 bg-brandRed rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap">Seller</span>
              </span>
            ) : (
              <div className="w-10 h-10 flex items-center justify-center shrink-0 mx-auto">
                {!logoError ? (
                  <Image
                    src="/assets/sidebar_logo.png"
                    alt="DeelMap"
                    width={40}
                    height={40}
                    className="w-10 h-10 object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                )}
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 rounded-xl bg-slate-100 active:bg-slate-200 transition-colors shrink-0 touch-manipulation"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 scrollbar-hide">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem === item.id
            const isMessages = item.id === 'messages'
            const showUnread = isMessages && messagesUnreadCount > 0
            return (
              <Link
                key={item.id}
                href={item.path}
                onClick={() => handleItemClick(item)}
                title={showExpanded ? undefined : item.label}
                className={`w-full flex items-center gap-3 rounded-xl transition-all duration-150 group ${
                  showExpanded ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'
                } ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="relative shrink-0">
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  {showUnread && !showExpanded && (
                    <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold leading-none text-white bg-brandRed rounded-full">
                      {messagesUnreadCount > 9 ? '9+' : messagesUnreadCount}
                    </span>
                  )}
                </div>
                {showExpanded && (
                  <div className={`flex items-center justify-between gap-2 min-w-0 flex-1 transition-opacity duration-200 ease-out ${
                    expandedContentVisible ? 'opacity-100' : 'opacity-0'
                  }`}>
                    <span className="text-sm font-medium truncate">{item.label}</span>
                    {showUnread && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold leading-none text-white bg-brandRed rounded-full">
                        {messagesUnreadCount > 99 ? '99+' : messagesUnreadCount}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer: Settings + Logout */}
        <div className="px-3 py-4 border-t border-slate-100 space-y-1 shrink-0">
          <Link
            href="/settings"
            onClick={() => typeof window !== 'undefined' && window.innerWidth < DESKTOP_BREAKPOINT && setIsOpen(false)}
            title={showExpanded ? undefined : 'Settings'}
            className={`group/user w-full flex items-center gap-3 rounded-xl transition-all duration-150 ${
              showExpanded ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'
            } ${
              pathname === '/settings'
                ? 'bg-primary/10 text-primary'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            {showExpanded && (
              <div
                className={`min-w-0 flex-1 overflow-hidden transition-opacity duration-200 ease-out ${
                  expandedContentVisible ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <p className="text-xs font-medium text-slate-500 truncate">Settings</p>
                <p className="text-sm font-medium text-slate-900 truncate">
                  {sellerUser?.email || sellerUser?.contact_person_name || 'Account'}
                </p>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < DESKTOP_BREAKPOINT) setIsOpen(false)
              handleLogout()
            }}
            title={showExpanded ? undefined : 'Logout'}
            className={`w-full flex items-center gap-3 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-150 ${
              showExpanded ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'
            }`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {showExpanded && (
              <span
                className={`text-sm font-medium transition-opacity duration-200 ease-out ${
                  expandedContentVisible ? 'opacity-100' : 'opacity-0'
                }`}
              >
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  )
}
