import {NextResponse} from 'next/server'
import type {NextRequest} from 'next/server'
import {isAllowlistedOperator} from './lib/auth/access'
import {getAuth} from './lib/auth/server'
import {operatorEmailAllowlist} from './lib/server-config'

function isPublic(pathname: string): boolean {
  return (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/auth/') ||
    pathname === '/issues' ||
    pathname.startsWith('/issues/') ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname === '/api/newsletter/feedback' ||
    pathname === '/feedback' ||
    pathname === '/access-denied'
  )
}

export async function proxy(req: NextRequest) {
  if (isPublic(req.nextUrl.pathname)) return NextResponse.next()

  const allowlist = operatorEmailAllowlist()
  if (allowlist.size === 0) {
    return NextResponse.redirect(new URL('/access-denied', req.url))
  }

  const identity = await getAuth()
  if (!identity) {
    const url = req.nextUrl.clone()
    url.pathname = '/auth/sign-in'
    url.search = ''
    return NextResponse.redirect(url)
  }
  if (!isAllowlistedOperator(identity.email, allowlist)) {
    const url = req.nextUrl.clone()
    url.pathname = '/access-denied'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    '/(api|trpc)(.*)'
  ]
}
