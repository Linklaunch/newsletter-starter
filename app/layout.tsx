import Link from 'next/link'
import type {ReactNode} from 'react'
import './globals.css'
import './theme-semantic.css'
import {
  AppHeader,
  AppHeaderInner,
  AppMain,
  AppShell
} from '@/components/ui/app-shell'
import {Row} from '@/components/ui/typography'
import {AuthProviders} from './auth-providers'

const NAV_LINKS = [
  {href: '/promos', label: 'Promotions'},
  {href: '/stats', label: 'Analytics'}
] as const

export const metadata = {
  title: 'CareerSignal',
  description: 'The CareerSignal operator console, by LinkLaunch'
}

export default function RootLayout({
  children
}: {children: ReactNode}): React.JSX.Element {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/svg+xml" href="/logo.svg" />
      </head>
      <body>
        <AuthProviders>
          <AppShell className="flex min-h-screen w-full min-w-0 flex-col">
            <AppHeader>
              <AppHeaderInner>
                <Row className="w-full flex-wrap items-center justify-between gap-4">
                  <Link
                    href="/"
                    className="flex items-baseline gap-2 no-underline"
                    aria-label="CareerSignal home">
                    <span className="font-sans text-2xl font-extrabold leading-none tracking-[-1px] text-foreground">
                      CareerSignal<span className="text-orange">.</span>
                    </span>
                    <span className="font-sans text-[13px] font-semibold tracking-[-0.3px] text-muted-foreground">
                      by LinkLaunch&#8482;
                    </span>
                  </Link>
                  <div className="flex items-center gap-4">
                    <nav
                      aria-label="Main navigation"
                      className="flex items-center gap-4">
                      {NAV_LINKS.map(link => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="font-mono text-[10px] uppercase tracking-[1.4px] text-muted-foreground hover:text-foreground hover:underline">
                          {link.label}
                        </Link>
                      ))}
                    </nav>
                    <div className="font-mono text-[10px] uppercase tracking-[1.4px] text-muted-foreground">
                      CareerSignal operator console
                    </div>
                  </div>
                </Row>
              </AppHeaderInner>
            </AppHeader>
            <AppMain className="flex min-h-0 min-w-0 flex-1 flex-col">
              {children}
            </AppMain>
          </AppShell>
        </AuthProviders>
      </body>
    </html>
  )
}
