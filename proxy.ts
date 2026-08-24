import {NextResponse} from 'next/server'
import type {NextRequest} from 'next/server'
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

  // No session adapter ships with the public starter. Operator routes deny
  // until the deployer wires their own server-side identity integration.
  const url = req.nextUrl.clone()
  url.pathname = '/access-denied'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    '/(api|trpc)(.*)'
  ]
}
