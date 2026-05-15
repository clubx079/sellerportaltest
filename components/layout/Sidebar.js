'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, MessageCircle, X, Settings,
  FileText, TrendingUp, BarChart3, CreditCard, Zap, ScrollText, Gift, Users, ChevronDown, Check
} from 'lucide-react'

const DESKTOP_BREAKPOINT = 1024

export default function Sidebar({ isOpen, setIsOpen, activeItem, setActiveItem }) {
  const pathname = usePathname()
  const [sellerUser, setSellerUser] = useState(null)
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0)
  const [listingsCount, setListingsCount] = useState(0)
  const [offersCount, setOffersCount] = useState(0)
  const [workspaces, setWorkspaces] = useState(null)
  const [wsOpen, setWsOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

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


  async function switchWorkspace(orgId) {
    const sellerId = sellerUser?.id
    if (!sellerId || switching) return
    setSwitching(true)
    setWsOpen(false)
    try {
      await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerId}` },
        body: JSON.stringify({ orgId }),
      })
      window.location.reload()
    } catch {}
    setSwitching(false)
  }

  useEffect(() => {
    const sellerId = sellerUser?.id || sellerUser?.userId
    if (!sellerId) return
    let mounted = true, timer = null
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/seller/chat?action=get_conversations', { headers: { Authorization: `Bearer ${sellerId}` } })
        const data = await res.json()
        if (!mounted) return
        if (data?.success && Array.isArray(data.conversations)) setMessagesUnreadCount(data.conversations.reduce((sum, c) => sum + Number(c.unread_count || 0), 0))
      } catch {}
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        const { count: lCount } = await sb.from('properties').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId)
        if (mounted && lCount != null) setListingsCount(lCount)
      } catch {}
      try {
        const oRes = await fetch('/api/seller/offers', { headers: { Authorization: `Bearer ${sellerId}` } })
        const oData = await oRes.json()
        if (!mounted) return
        if (oData?.pendingCount != null) setOffersCount(oData.pendingCount)
      } catch {}
    }

    fetchCounts()
    timer = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') fetchCounts() }, 30000)
    return () => { mounted = false; if (timer) clearInterval(timer) }
  }, [sellerUser?.id, sellerUser?.userId])

  const handleItemClick = (item) => {
    setActiveItem(item.id)
    if (typeof window !== 'undefined' && window.innerWidth < DESKTOP_BREAKPOINT) setIsOpen(false)
  }

  const sections = [
    {
      label: 'MAIN',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { id: 'properties', label: 'My Listings', icon: Building2, path: '/properties', badge: listingsCount || null },
        { id: 'messages', label: 'Messages', icon: MessageCircle, path: '/messages', badge: messagesUnreadCount, badgeRed: true },
        { id: 'offers', label: 'Offers received', icon: FileText, path: '/offers', badge: offersCount || null },
      ]
    },
    {
      label: 'TOOLS',
      items: [
        { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
        { id: 'contracts', label: 'Contracts', icon: ScrollText, path: '/contracts' },
        { id: 'team', label: 'Team', icon: Users, path: '/team' },
      ]
    },
    {
      label: 'ACCOUNT',
      items: [
        { id: 'plans', label: 'Plans', icon: Zap, path: '/plans' },
        { id: 'referral', label: 'Referral', icon: Gift, path: '/referral' },
        { id: 'billing', label: 'Billing', icon: CreditCard, path: '/billing' },
        { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
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
          {isOpen && (
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 rounded hover:bg-[#FAFAF8] text-[#737370] transition-colors duration-200" aria-label="Close menu">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Workspace switcher */}
        {workspaces?.available?.length > 1 && (
          <div className="px-3 py-2.5 border-b border-[#E8E8E4] relative">
            <button
              onClick={() => setWsOpen(v => !v)}
              disabled={switching}
              className="w-full flex items-center gap-2 px-3 py-2 rounded border border-[#E8E8E4] bg-[#FAFAF8] hover:border-[#1A1816] text-[13px] text-[#1A1816] font-medium transition-colors disabled:opacity-50"
            >
              <div className="w-5 h-5 rounded bg-[#1A1816] flex items-center justify-center shrink-0">
                <span className="text-white text-[9px] font-bold">
                  {(workspaces.current?.name || 'Personal')[0].toUpperCase()}
                </span>
              </div>
              <span className="flex-1 text-left truncate">{workspaces.current?.name || 'Personal'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#737370] shrink-0 transition-transform ${wsOpen ? 'rotate-180' : ''}`} />
            </button>
            {wsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setWsOpen(false)} />
                <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-[#E8E8E4] rounded shadow-md z-50 overflow-hidden">
                {workspaces.available.map(ws => (
                  <button
                    key={ws.id ?? 'personal'}
                    onClick={() => switchWorkspace(ws.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-[#444441] hover:bg-[#FAFAF8] transition-colors text-left"
                  >
                    <div className="w-5 h-5 rounded bg-[#E8E8E4] flex items-center justify-center shrink-0">
                      <span className="text-[#444441] text-[9px] font-bold">{ws.name[0].toUpperCase()}</span>
                    </div>
                    <span className="flex-1 truncate">{ws.name}</span>
                    {(workspaces.current?.id ?? null) === ws.id && (
                      <Check className="w-3.5 h-3.5 text-[#1A1816] shrink-0" />
                    )}
                  </button>
                ))}
                </div>
              </>
            )}
          </div>
        )}

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
                        <span className="truncate">{item.label}</span>
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
