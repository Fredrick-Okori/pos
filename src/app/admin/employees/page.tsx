'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/types'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useOrganization } from '@/contexts/OrganizationContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function EmployeeManagement() {
  const { user } = useAuth()
  const supabase = createClient()
  const { selectedOrg } = useOrganization()
  const [employees, setEmployees] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newEmployee, setNewEmployee] = useState({
    email: '',
    password: '',
    full_name: ''
  })

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (selectedOrg) {
        query = query.eq('organization_id', selectedOrg.id)
      }

      const { data, error } = await query

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast.error('Failed to fetch employees')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [selectedOrg?.id])

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newEmployee.email || !newEmployee.password || !newEmployee.full_name) {
      toast.error('Please fill in all fields')
      return
    }

    if (newEmployee.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/admin/create-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmployee.email,
          password: newEmployee.password,
          full_name: newEmployee.full_name,
          organization_id: selectedOrg?.id || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create employee')

      toast.success('Employee created successfully!')
      setShowCreateModal(false)
      setNewEmployee({ email: '', password: '', full_name: '' })

      // Refresh the list after a short delay to allow trigger to complete
      setTimeout(fetchEmployees, 1000)
    } catch (error: any) {
      console.error('Error creating employee:', error)
      toast.error(error.message || 'Failed to create employee')
    } finally {
      setCreating(false)
    }
  }

  const handleRoleChange = async (employeeId: string, newRole: 'employee' | 'superadmin') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', employeeId)

      if (error) throw error

      toast.success('Role updated successfully!')
      fetchEmployees()
    } catch (error: any) {
      console.error('Error updating role:', error)
      toast.error(error.message || 'Failed to update role')
    }
  }

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <DashboardLayout>
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
            <p className="text-gray-600">Create and manage employee accounts</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            + Create Employee
          </button>
        </div>

        {/* Employee List */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">All Users ({employees.length})</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading employees...</p>
            </div>
          ) : employees.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No employees found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-primary-700 font-medium text-sm">
                              {employee.full_name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <span className="font-medium">{employee.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {employee.email}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          employee.role === 'superadmin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {employee.role === 'superadmin' ? 'Admin' : 'Employee'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(employee.created_at), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {employee.id !== user?.id && (
                          <select
                            value={employee.role}
                            onChange={(e) => handleRoleChange(employee.id, e.target.value as 'employee' | 'superadmin')}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="employee">Employee</option>
                            <option value="superadmin">Admin</option>
                          </select>
                        )}
                        {employee.id === user?.id && (
                          <span className="text-xs text-gray-400">Current user</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Employee Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Create New Employee</h2>
                  <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateEmployee} className="p-6 space-y-4">
                <div>
                  <label className="label">Full Name</label>
                  <input
                    type="text"
                    value={newEmployee.full_name}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, full_name: e.target.value }))}
                    className="input-field"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                    className="input-field"
                    placeholder="employee@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, password: e.target.value }))}
                    className="input-field"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn-primary flex-1"
                  >
                    {creating ? 'Creating...' : 'Create Employee'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
