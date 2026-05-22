'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SSOPage() {
  const router = useRouter()

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const encoded = params.get('d')
      if (!encoded) {
        router.replace('/login')
        return
      }
      const data = JSON.parse(atob(encoded))
      if (!data.id || !data.email) {
        router.replace('/login')
        return
      }
      localStorage.setItem('seller_user', JSON.stringify(data))
      router.replace('/dashboard')
    } catch {
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D03839]" />
    </div>
  )
}
