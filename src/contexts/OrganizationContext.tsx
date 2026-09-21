'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase'
import { Organization } from '@/types'
import { useAuth } from './AuthContext'

interface OrganizationContextType {
  organizations: Organization[]
  selectedOrg: Organization | null
  setSelectedOrg: (org: Organization) => void
  loading: boolean
  refreshOrganizations: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

const ORG_STORAGE_KEY = 'seiv_selected_org_id'

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrgState] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = profile?.role === 'superadmin'
  // managers are locked to their assigned org like employees

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      const orgs: Organization[] = data || []
      const vanguishOrg = orgs.find(org => org.name.toLowerCase() === 'vanguish' || org.slug?.toLowerCase() === 'vanguish')
      const displayOrgs = orgs.filter(org => {
        const name = org.name.toLowerCase()
        const slug = org.slug?.toLowerCase() ?? ''
        return !(name === 'thrones' || slug === 'thrones')
      })

      setOrganizations(displayOrgs)

      // Restore previously selected org from localStorage (admin only)
      if (isAdmin && displayOrgs.length > 0) {
        const savedOrgId = localStorage.getItem(ORG_STORAGE_KEY)
        const savedOrg = savedOrgId ? displayOrgs.find(o => o.id === savedOrgId) : null
        const preferredOrg = savedOrg || vanguishOrg || displayOrgs[0]
        setSelectedOrgState(preferredOrg)
        localStorage.setItem(ORG_STORAGE_KEY, preferredOrg.id)
      } else if (!isAdmin && profile?.organization_id) {
        // Employees and managers are locked to their assigned org
        const empOrg = displayOrgs.find(o => o.id === profile.organization_id)
        if (empOrg) setSelectedOrgState(empOrg)
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const setSelectedOrg = (org: Organization) => {
    setSelectedOrgState(org)
    localStorage.setItem(ORG_STORAGE_KEY, org.id)
  }

  useEffect(() => {
    if (profile) {
      fetchOrganizations()
    }
  }, [profile?.id])

  return (
    <OrganizationContext.Provider value={{
      organizations,
      selectedOrg,
      setSelectedOrg,
      loading,
      refreshOrganizations: fetchOrganizations,
    }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}
