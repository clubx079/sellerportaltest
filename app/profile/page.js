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
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Redirecting to Settings...</p>
    </div>
  )
}
