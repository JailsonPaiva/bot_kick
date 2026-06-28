import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = [
  '/',
  '/games',
  '/ranking',
  '/commands',
  '/timers',
  '/moderation',
  '/loyalty',
  '/alerts',
  '/giveaways',
  '/polls',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('kick_token')?.value

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

  // /ranking/[channelSlug] is public (slug has at least one char after /)
  const isPublicRanking = /^\/ranking\/.+/.test(pathname)

  if (isProtected && !isPublicRanking && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|play|overlay|api).*)',
  ],
}
