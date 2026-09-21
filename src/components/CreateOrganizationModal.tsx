'use client'

import { useState } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { Organization } from '@/types'
import toast from 'react-hot-toast'
import { LuCastle } from 'react-icons/lu'

interface CreateOrganizationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (newOrg: Organization) => void
}

export default function CreateOrganizationModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateOrganizationModalProps) {
  const { refreshOrganizations, setSelectedOrg } = useOrganization()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  if (!isOpen) return null

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)
    if (!slugManuallyEdited) {
      setSlug(
        newName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      )
    }
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugManuallyEdited(true)
    setSlug(
      e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '')
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Organization name is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/create-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create organization')
      }

      toast.success(`Organization "${data.organization.name}" created successfully!`)
      await refreshOrganizations()
      setSelectedOrg(data.organization)
      onSuccess?.(data.organization)
      handleClose()
    } catch (err: any) {
      toast.error(err.message || 'Error creating organization')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setName('')
    setSlug('')
    setDescription('')
    setSlugManuallyEdited(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-navy-300/10 flex items-center justify-center text-navy-300">
              <LuCastle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Add New Organization</h2>
              <p className="text-xs text-gray-500">Create a new venue or bar</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Organization / Bar Name *</label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              className="input-field"
              placeholder="e.g. Vanguish"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">Identifier Slug</label>
            <div className="relative">
              <input
                type="text"
                value={slug}
                onChange={handleSlugChange}
                className="input-field font-mono text-sm"
                placeholder="e.g. vanguish"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Unique URL and system slug (lowercase letters, numbers, hyphens)</p>
          </div>

          <div>
            <label className="label">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              placeholder="e.g. Vanguish Lounge & Bar"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="btn-primary text-sm flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Organization</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

