'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Registration is disabled - only admins can create employees
export default function RegisterPage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-blue-200/70">Redirecting to login...</p>
    </div>
  )
}
