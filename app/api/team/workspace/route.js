import { NextResponse } from 'next/server'
import { getWorkspaceSellerId } from '@/lib/workspace'

function getSellerId(request) {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  return null
}

// GET /api/team/workspace — returns the effective seller_id for workspace data queries
export async function GET(request) {
  const sellerId = getSellerId(request)
  if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await getWorkspaceSellerId(sellerId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[team/workspace]', err)
    return NextResponse.json({ effectiveId: sellerId, isTeamMember: false })
  }
}
