'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import OrganizationSwitcher from './OrganizationSwitcher'

interface SidebarProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const isAdmin = profile?.role === 'superadmin'

  const employeeMenuItems = [
    {
      name: 'Dashboard',
      href: '/employee/dashboard',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
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
  ]

  const adminMenuItems = [
    {
      name: 'Dashboard',
      href: '/admin/dashboard',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
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
    {
      name: 'Unpaid Bills',
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

  const menuItems = isAdmin ? adminMenuItems : employeeMenuItems

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(201,168,76,.09)', border: '1px solid rgba(201,168,76,.22)' }}>
              <svg className="w-4 h-4" fill="none" stroke="#C9A84C" strokeWidth="1.6" viewBox="0 0 24 24">
                <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-sans font-bold tracking-widest text-gold-500" style={{ fontSize: 10 }}>SEIV</p>
              <p className="font-serif text-white/90 leading-tight" style={{ fontSize: 12 }}>Krug Ten Eleven</p>
            </div>
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
              {isAdmin ? 'Admin' : 'Staff'}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <p className="px-2 mb-2 font-sans font-semibold uppercase tracking-widest text-white/20" style={{ fontSize: 9 }}>
            {isAdmin ? 'Admin' : 'Reports'}
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
                  borderLeft: active ? '2.5px solid #C9A84C' : '2.5px solid transparent',
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

          {/* Date */}
          <p className="hidden sm:block font-mono text-xs" style={{ color: 'rgba(255,255,255,.35)' }}>
            {new Date().toLocaleDateString('en-UG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </header>

        {/* Page content */}
        <main className="p-5 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
