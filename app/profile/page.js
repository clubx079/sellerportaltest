"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/settings')
  }, [router])
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <p className="text-sm text-gray-500">Redirecting to Settings...</p>
    </div>
  )
}
