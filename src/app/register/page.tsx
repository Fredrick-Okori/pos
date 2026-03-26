'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Registration is disabled - only admins can create employees
export default function RegisterPage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/login')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600">Redirecting to login...</p>
    </div>
  )
}
