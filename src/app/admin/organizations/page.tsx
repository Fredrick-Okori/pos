'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Organization } from '@/types'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import CreateOrganizationModal from '@/components/CreateOrganizationModal'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { LuCastle } from 'react-icons/lu'

interface OrgWithCounts extends Organization {
  employeeCount?: number
  reportCount?: number
}

export default function OrganizationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { refreshOrganizations } = useOrganization()
  const { profile } = useAuth()
  const [orgs, setOrgs] = useState<OrgWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const isFred =
    profile?.role === 'superadmin' &&
    profile?.email?.toLowerCase() === 'fred.okori@kayeai.com'
  const canCreateOrg = isFred

  useEffect(() => {
    if (profile && !isFred) {
      router.replace('/admin/dashboard')
    }
  }, [profile, isFred, router])

  if (profile && !isFred) {
    return null
  }

  const fetchAllOrgs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const orgList: OrgWithCounts[] = data || []

      // Fetch employee & report counts for each org
      const enriched = await Promise.all(
        orgList.map(async (org) => {
          const [{ count: empCount }, { count: repCount }] = await Promise.all([
            supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', org.id),
            supabase
              .from('daily_reports')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', org.id),
          ])

          return {
            ...org,
            employeeCount: empCount ?? 0,
            reportCount: repCount ?? 0,
          }
        })
      )

      setOrgs(enriched)
    } catch (err: any) {
      console.error('Error fetching organizations:', err)
      toast.error('Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllOrgs()
  }, [])

  const handleToggleActive = async (org: OrgWithCounts) => {
    const newStatus = !org.is_active
    setTogglingId(org.id)
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', org.id)

      if (error) throw error

      toast.success(
        `Organization "${org.name}" ${newStatus ? 'activated' : 'deactivated'} successfully!`
      )

      await Promise.all([fetchAllOrgs(), refreshOrganizations()])
    } catch (err: any) {
      console.error('Error updating organization status:', err)
      toast.error(err.message || 'Failed to update organization status')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <DashboardLayout>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your bars, lounges, and venue locations
            </p>
          </div>
          {canCreateOrg && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center justify-center gap-2 self-start sm:self-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Organization</span>
            </button>
          )}
        </div>

        {/* Organizations Table Card */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              All Organizations ({orgs.length})
            </h2>
            <button
              onClick={fetchAllOrgs}
              className="text-sm text-navy-300 hover:text-navy-200 font-medium"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-300 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading organizations...</p>
            </div>
          ) : orgs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <LuCastle className="w-12 h-12 mx-auto mb-3 opacity-40 text-gray-400" />
              <p>No organizations found.</p>
              {canCreateOrg && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 btn-primary text-sm"
                >
                  Create your first organization
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Slug
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Staff / Reports
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orgs.map((org) => (
                    <tr key={org.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-9 h-9 bg-navy-100/50 rounded-xl flex items-center justify-center text-navy-400 font-bold text-sm mr-3 border border-navy-200/20">
                            {org.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">{org.name}</div>
                            {org.description && (
                              <div className="text-xs text-gray-400">{org.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm font-mono text-gray-600">
                        {org.slug}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-500">
                        <span className="font-medium text-gray-800">{org.employeeCount}</span> staff
                        <span className="mx-1.5 text-gray-300">•</span>
                        <span className="font-medium text-gray-800">{org.reportCount}</span> reports
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            org.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {org.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-500">
                        {org.created_at ? format(new Date(org.created_at), 'MMM dd, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => handleToggleActive(org)}
                          disabled={togglingId === org.id}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border ${
                            org.is_active
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          } disabled:opacity-50`}
                        >
                          {togglingId === org.id
                            ? 'Updating...'
                            : org.is_active
                            ? 'Deactivate'
                            : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal */}
        <CreateOrganizationModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => fetchAllOrgs()}
        />
      </DashboardLayout>
    </ProtectedRoute>
  )
}

