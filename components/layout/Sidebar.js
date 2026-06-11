'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, MessageCircle, X, Settings,
  FileText, TrendingUp, BarChart3, CreditCard, Zap, ScrollText, Gift, Users, LifeBuoy, Bell
} from 'lucide-react'

const DESKTOP_BREAKPOINT = 1024

export default function Sidebar({ isOpen, setIsOpen, activeItem, setActiveItem }) {
  const pathname = usePathname()
  const [sellerUser, setSellerUser] = useState(null)
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0)
  const [listingsCount, setListingsCount] = useState(0)
  const [offersCount, setOffersCount] = useState(0)
  const [workspaces, setWorkspaces] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [notifUnread, setNotifUnread] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  useEffect(() => {
    if (!notifOpen) return
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  useEffect(() => {
    try { const raw = localStorage.getItem('seller_user'); if (raw) setSellerUser(JSON.parse(raw)) } catch {}
  }, [])

  useEffect(() => {
    const sellerId = sellerUser?.id
    if (!sellerId) return
    fetch('/api/team/workspaces', { headers: { Authorization: `Bearer ${sellerId}` } })
      .then(r => r.json())
      .then(data => { if (data?.available) setWorkspaces(data) })
      .catch(() => {})
  }, [sellerUser?.id])


  useEffect(() => {
    const sellerId = sellerUser?.id || sellerUser?.userId
    if (!sellerId) return
    const effectiveId = workspaces?.current?.effectiveSellerId || sellerId
    let mounted = true, timer = null
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/seller/chat?action=get_conversations', { headers: { Authorization: `Bearer ${effectiveId}` } })
        const data = await res.json()
        if (!mounted) return
        if (data?.success && Array.isArray(data.conversations)) setMessagesUnreadCount(data.conversations.reduce((sum, c) => sum + Number(c.unread_count || 0), 0))
      } catch {}
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        const { count: lCount } = await sb.from('properties').select('*', { count: 'exact', head: true }).eq('seller_id', effectiveId).neq('status', 'archived')
        if (mounted && lCount != null) setListingsCount(lCount)
      } catch {}
      try {
        const oRes = await fetch('/api/seller/offers', { headers: { Authorization: `Bearer ${effectiveId}` } })
        const oData = await oRes.json()
        if (!mounted) return
        if (oData?.pendingCount != null) setOffersCount(oData.pendingCount)
      } catch {}
      try {
        const nRes = await fetch('/api/seller/notifications', { headers: { Authorization: `Bearer ${sellerId}` } })
        const nData = await nRes.json()
        if (!mounted) return
        if (Array.isArray(nData?.notifications)) {
          setNotifications(nData.notifications)
          setNotifUnread(nData.notifications.filter(n => !n.is_read).length)
        }
      } catch {}
    }

    fetchCounts()
    timer = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') fetchCounts() }, 30000)
    return () => { mounted = false; if (timer) clearInterval(timer) }
  }, [sellerUser?.id, sellerUser?.userId, workspaces?.current?.effectiveSellerId])

  const handleItemClick = (item) => {
    setActiveItem(item.id)
    if (typeof window !== 'undefined' && window.innerWidth < DESKTOP_BREAKPOINT) setIsOpen(false)
  }

  const isPersonalWorkspace = workspaces?.current?.id === null
  const currentRole = workspaces?.current?.role || 'admin'
  const perms = workspaces?.current?.permissions || {}
  const hasFullAccess = isPersonalWorkspace || currentRole === 'admin'

  const sections = [
    {
      label: 'MAIN',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { id: 'properties', label: 'My Listings', icon: Building2, path: '/properties', badge: listingsCount || null },
        ...(hasFullAccess || perms.inbox_access ? [{ id: 'messages', label: 'Messages', icon: MessageCircle, path: '/messages', badge: messagesUnreadCount, badgeRed: true }] : []),
        { id: 'offers', label: 'Offers received', icon: FileText, path: '/offers', badge: offersCount || null },
      ]
    },
    {
      label: 'TOOLS',
      items: [
        ...(hasFullAccess || perms.analytics_view ? [{ id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' }] : []),
        { id: 'contracts', label: 'Contracts', icon: ScrollText, path: '/contracts', beta: true },
        { id: 'team', label: 'Team', icon: Users, path: '/team' },
      ]
    },
    {
      label: 'ACCOUNT',
      items: [
        ...(hasFullAccess ? [
          { id: 'plans',    label: 'Plans',    icon: Zap,        path: '/plans' },
          { id: 'referral', label: 'Referral', icon: Gift,       path: '/referral' },
          { id: 'billing',  label: 'Billing',  icon: CreditCard, path: '/billing' },
        ] : []),
        { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
        { id: 'support', label: 'Contact Us', icon: LifeBuoy, path: '/support' },
      ]
    }
  ]

  useEffect(() => {
    sections.forEach(s => s.items.forEach(item => {
      if (pathname === item.path || pathname?.startsWith(item.path + '/')) setActiveItem(item.id)
    }))
  }, [pathname])

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsOpen(false)} />}

      <aside className={`
        fixed top-0 left-0 z-50 h-full bg-white border-r border-[#E8E8E4]
        flex flex-col w-[260px] min-w-[260px]
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E4] shrink-0">
          <Link href="/dashboard">
            <Image src="/assets/logo-seller-portal.svg" alt="DeelMap Seller Portal" width={147} height={70} priority />
          </Link>
          <div className="flex items-center gap-1">
            {/* Notification Bell — desktop only (mobile bell lives in DashboardLayout navbar) */}
            <div className="relative hidden lg:block" ref={notifRef}>
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
                <div className="absolute left-0 top-full mt-2 w-[320px] bg-white border border-[#E8E8E4] rounded-lg shadow-xl z-[200] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E4]">
                    <span className="text-[13px] font-semibold text-[#1A1816]">Notifications</span>
                    {notifUnread > 0 && (
                      <button
                        onClick={async () => {
                          const sellerId = sellerUser?.id || sellerUser?.userId
                          if (!sellerId) return
                          await fetch('/api/seller/notifications', { method: 'POST', headers: { Authorization: `Bearer ${sellerId}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_all_read' }) })
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
                            const sellerId = sellerUser?.id || sellerUser?.userId
                            if (!n.is_read && sellerId) {
                              await fetch('/api/seller/notifications', { method: 'POST', headers: { Authorization: `Bearer ${sellerId}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_read', notification_id: n.id }) })
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
            {isOpen && (
              <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 rounded hover:bg-[#FAFAF8] text-[#737370] transition-colors duration-200" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {sections.map((section, si) => (
            <div key={si} className="mb-5">
              <p className="px-3 mb-2 text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[1.1px]">
                {section.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map(item => {
                  const Icon = item.icon
                  const isActive = activeItem === item.id
                  const hasBadge = item.badge > 0

                  return (
                    <Link
                      key={item.id} href={item.path} onClick={() => handleItemClick(item)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded text-[14px] transition-all duration-200 ${
                        isActive ? 'bg-[#FAFAF8] text-[#1A1816] font-semibold' : 'text-[#444441] hover:bg-[#FAFAF8] hover:text-[#1A1816]'
                      }`}
                    >
                      <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#1A1816]' : 'text-[#737370]'}`} />
                      <div className="flex items-center justify-between gap-2 min-w-0 flex-1">
                        <span className="truncate flex items-center gap-2">
                          {item.label}
                          {item.beta && (
                            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#FEF3E2] text-[#B5620A] flex-shrink-0">Beta</span>
                          )}
                        </span>
                        {hasBadge && (
                          <span className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-semibold rounded ${
                            item.badgeRed ? 'bg-[#D03839] text-white' : 'bg-[#FAFAF8] text-[#444441] border border-[#E8E8E4]'
                          }`}>
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
