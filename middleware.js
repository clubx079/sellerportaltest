import { NextResponse } from 'next/server'

export function middleware(request) {
  const { searchParams } = new URL(request.url)
  const ref = searchParams.get('ref')

  if (ref && /^[A-Za-z0-9]{4,20}$/.test(ref)) {
    const response = NextResponse.next()
    response.cookies.set('deelmap_ref', ref.toUpperCase(), {
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
