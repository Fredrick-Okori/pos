'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

interface NavbarProps {
  title?: string
}

export default function Navbar({ title = 'Krug POS' }: NavbarProps) {
  const { user, profile, signOut } = useAuth()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    if (profile?.role === 'superadmin') {
      router.push('/')
    } else {
      router.push('/')
    }
  }

  return (
    <nav className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 shadow-lg shadow-blue-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">
              {title}
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {profile && (
              <div className="hidden sm:flex items-center space-x-4">
                <span className="text-sm text-blue-100">
                  {profile.full_name}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  profile.role === 'superadmin' 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                }`}>
                  {profile.role === 'superadmin' ? 'Admin' : 'Employee'}
                </span>
              </div>
            )}
            
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center space-x-2 text-blue-100 hover:text-white focus:outline-none"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <span className="text-white font-medium text-sm">
                    {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-blue-950 rounded-md shadow-lg shadow-blue-900/50 py-1 z-50 border border-blue-700/50">
                  <div className="px-4 py-2 border-b border-blue-700/50 sm:hidden">
                    <p className="text-sm font-medium text-white">{profile?.full_name}</p>
                    <p className="text-xs text-blue-300/70">{profile?.email}</p>
                  </div>
                  {profile?.role === 'superadmin' && (
                    <Link
                      href="/admin/dashboard"
                      className="block px-4 py-2 text-sm text-blue-100 hover:bg-blue-800/50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Admin Dashboard
                    </Link>
                  )}
                  {profile?.role === 'employee' && (
                    <Link
                      href="/employee/dashboard"
                      className="block px-4 py-2 text-sm text-blue-100 hover:bg-blue-800/50"
                      onClick={() => setMenuOpen(false)}
                    >
                      My Dashboard
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-blue-800/50"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

