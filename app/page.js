'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in
    const user = localStorage.getItem('seller_user')
    if (user) {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="motion-safe:animate-spin rounded-full h-12 w-12 border-2 border-hairline border-t-ink"></div>
    </div>
  )
}