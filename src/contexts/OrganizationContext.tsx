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

const ORG_STORAGE_KEY = 'krug_selected_org_id'

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrgState] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = profile?.role === 'superadmin'

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      const orgs: Organization[] = data || []
      setOrganizations(orgs)

      // Restore previously selected org from localStorage (admin only)
      if (isAdmin && orgs.length > 0) {
        const savedOrgId = localStorage.getItem(ORG_STORAGE_KEY)
        const savedOrg = savedOrgId ? orgs.find(o => o.id === savedOrgId) : null
        setSelectedOrgState(savedOrg || orgs[0])
      } else if (!isAdmin && profile?.organization_id) {
        // Employees are locked to their assigned org
        const empOrg = orgs.find(o => o.id === profile.organization_id)
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
