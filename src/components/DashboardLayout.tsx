'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import OrganizationSwitcher from './OrganizationSwitcher'
import { LuCastle } from 'react-icons/lu'
import { MoneyVisibilityProvider } from '@/contexts/MoneyVisibilityContext'

interface SidebarProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingNotifsCount, setPendingNotifsCount] = useState<number>(0)
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const isAdmin = profile?.role === 'superadmin'
  const isManager = profile?.role === 'manager'
  const isSuperFred = isAdmin && profile?.email?.toLowerCase() === 'fred.okori@kayeai.com'

  useEffect(() => {
    if (!profile) return
    const fetchCount = async () => {
      try {
        if (isSuperFred) {
          const res = await fetch('/api/admin/notifications')
          if (res.ok) {
            const data = await res.json()
            const pending = (data.notifications || []).filter((n: any) => n.status === 'pending').length
            setPendingNotifsCount(pending)
          }
        } else if (isManager) {
          const res = await fetch('/api/manager/notifications')
          if (res.ok) {
            const data = await res.json()
            setPendingNotifsCount(data.pendingCount || 0)
          }
        }
      } catch {
        // non-critical
      }
    }
    fetchCount()
  }, [profile, isSuperFred, isManager, pathname])

  const employeeMenuItems = [
    {
      name: 'Dashboard',
      href: '/employee/dashboard',
      icon: <LuCastle className="w-4 h-4" />,
    },
    {
      name: 'Expenses',
      href: '/employee/expenses',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    },
    {
      name: 'My Reports',
      href: '/employee/reports',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
    {
      name: 'Client Balances',
      href: '/employee/unpaid-balance',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    },
  ]

  const adminMenuItems = [
    {
      name: 'Dashboard',
      href: '/admin/dashboard',
      icon: <LuCastle className="w-4 h-4" />,
    },
    {
      name: 'All Reports',
      href: '/admin/reports',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
    {
      name: 'Employees',
      href: '/admin/employees',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    },
    ...(isSuperFred
      ? [
          {
            name: 'Organizations',
            href: '/admin/organizations',
            icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
          },
          {
            name: 'Notifications',
            href: '/admin/notifications',
            icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
          },
        ]
      : []),
    {
      name: 'Invoices',
      href: '/admin/unpaid-bills',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      name: 'Analytics',
      href: '/admin/analytics',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    },
    {
      name: 'Client Ledger',
      href: '/admin/clients',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
  ]

  const managerMenuItems = [
    {
      name: 'Dashboard',
      href: '/manager/dashboard',
      icon: <LuCastle className="w-4 h-4" />,
    },
    {
      name: 'Enter Daily Report',
      href: '/employee/dashboard',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    },
    {
      name: 'All Reports',
      href: '/admin/reports',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
    {
      name: 'Invoices',
      href: '/admin/unpaid-bills',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      name: 'Analytics',
      href: '/admin/analytics',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    },
    {
      name: 'Client Ledger',
      href: '/admin/clients',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      name: 'Notifications',
      href: '/manager/notifications',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    },
  ]

  const menuItems = isAdmin ? adminMenuItems : isManager ? managerMenuItems : employeeMenuItems

  useEffect(() => {
    const handler = () => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement && el.type === 'number') el.blur()
    }
    document.addEventListener('wheel', handler, { passive: true })
    return () => document.removeEventListener('wheel', handler)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/'
  }

  return (
    <MoneyVisibilityProvider>
    <div className="min-h-screen" style={{ background: '#FAF8F4' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-56 flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#0C2340', borderRight: '1px solid rgba(255,255,255,.06)' }}>

        {/* Brand */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div className="flex items-center gap-2.5 mb-3">
            <Image
              src="/siev_gold.png"
              alt="SEIV"
              width={36}
              height={36}
              className="object-contain shrink-0"
              priority
            />
            <span className="font-bold tracking-wide" style={{ fontSize: 18, letterSpacing: '.04em', color: '#C9A84C' }}>Seiv</span>
          </div>
          {/* User row */}
          <div className="flex items-center gap-2 mt-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-semibold text-white text-xs"
              style={{ background: 'rgba(37,99,168,.5)' }}>
              {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white/90 font-medium truncate" style={{ fontSize: 12 }}>{profile?.full_name || 'User'}</p>
            </div>
            <span className="shrink-0 text-gold-500 font-bold uppercase rounded px-1.5 py-0.5"
              style={{ fontSize: 8, background: 'rgba(201,168,76,.15)', letterSpacing: '.1em' }}>
              {isAdmin ? 'Admin' : isManager ? 'Manager' : 'Staff'}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <p className="px-2 mb-2 font-sans font-semibold uppercase tracking-widest text-white/20" style={{ fontSize: 9 }}>
            {isAdmin ? 'Admin' : isManager ? 'Manager' : 'Reports'}
          </p>
          {menuItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.name} href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150"
                style={{
                  color: active ? '#fff' : 'rgba(255,255,255,.5)',
                  background: active ? 'rgba(37,99,168,.35)' : 'transparent',
                  borderLeft: active ? '2.5px solid #f2eddd' : '2.5px solid transparent',
                }}
              >
                <span style={{ color: active ? '#93c5fd' : 'rgba(255,255,255,.3)' }}>{item.icon}</span>
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Quick action — employee only */}
        {!isAdmin && (
          <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <Link href="/employee/dashboard"
              className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'rgba(201,168,76,.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.25)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Daily Report
            </Link>
          </div>
        )}

        {/* Sign out */}
        <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <button onClick={handleSignOut}
            className="flex items-center gap-2.5 px-2.5 py-2 w-full rounded-lg text-xs font-medium transition-colors"
            style={{ color: 'rgba(255,100,100,.7)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="lg:pl-56">
        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-5 lg:px-8 sticky top-0 z-30"
          style={{ background: '#1A3A62', borderBottom: '1px solid rgba(37,99,168,.3)', boxShadow: '0 1px 20px rgba(0,0,0,.4)' }}>
          {/* Mobile menu toggle */}
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg text-blue-300 hover:text-white"
            style={{ background: 'rgba(255,255,255,.05)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1 lg:flex-none">
            <OrganizationSwitcher />
          </div>

          {/* Right side: Notifications bell & date */}
          <div className="flex items-center gap-3">
            {(isSuperFred || isManager) && (
              <Link
                href={isSuperFred ? '/admin/notifications' : '/manager/notifications'}
                className="relative p-2 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition flex items-center justify-center"
                title={isSuperFred ? 'Payment Notifications (Superadmin)' : 'System Notifications'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {pendingNotifsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-[#0C2340] shadow-sm">
                    {pendingNotifsCount > 9 ? '9+' : pendingNotifsCount}
                  </span>
                )}
              </Link>
            )}

            {/* Date */}
            <p className="hidden sm:block font-sans text-xs" style={{ color: 'rgba(255,255,255,.35)' }}>
              {new Date().toLocaleDateString('en-UG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </header>

        {/* Page content */}
        <main className="p-5 lg:p-8">
          {children}
        </main>
      </div>
    </div>
    </MoneyVisibilityProvider>
  )
}
