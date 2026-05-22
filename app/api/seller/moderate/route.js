import { NextResponse } from 'next/server'
import { moderateSellerProperty } from '@/lib/moderateSellerProperty'

export async function POST(request) {
  try {
    const { property_id } = await request.json()
    if (!property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 })
    // Run in background — don't await
    setTimeout(() => moderateSellerProperty(property_id).catch(console.error), 0)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
