'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { UserRole } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading, signOut } = useAuth()
  const { selectedOrg, loading: orgLoading } = useOrganization()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/')
      } else if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
        if (profile.role === 'superadmin') {
          router.push('/admin/dashboard')
        } else if (profile.role === 'manager') {
          router.push('/manager/dashboard')
        } else {
          router.push('/employee/dashboard')
        }
      }
    }
  }, [user, profile, loading, allowedRoles, router])

  if (loading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-blue-200/70">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return null
  }

  // If a non-admin user has no active organization assigned (e.g. org was deactivated or removed)
  if (profile && profile.role !== 'superadmin' && !selectedOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950 p-4">
        <div className="max-w-md w-full bg-navy-900 border border-red-500/30 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Disabled</h2>
          <p className="text-sm text-blue-200/70 mb-6 leading-relaxed">
            Your assigned organization is not active or has been removed. You cannot view or submit reports. Please contact an administrator.
          </p>
          <button
            onClick={() => signOut()}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
