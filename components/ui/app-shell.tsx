import type * as React from 'react'

import {cn} from '@/lib/utils'

import {H2} from './typography'

function AppShell({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="app-shell"
      className={cn(
        'flex min-h-screen flex-col bg-background text-foreground',
        className
      )}
      {...props}
    />
  )
}

function AppHeader({className, ...props}: React.ComponentProps<'header'>) {
  return (
    <header
      data-slot="app-header"
      className={cn(
        'sticky top-0 z-50 border-b border-[color-mix(in_srgb,var(--border)_55%,transparent)]',
        'bg-[color-mix(in_srgb,var(--background)_82%,transparent)] shadow-[0_1px_0_color-mix(in_srgb,var(--border)_35%,transparent)]',
        'backdrop-blur-[18px] backdrop-saturate-[115%] [-webkit-backdrop-filter:blur(18px)_saturate(1.15)]',
        'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
        className
      )}
      {...props}
    />
  )
}

function AppHeaderInner({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="app-header-inner"
      className={cn(
        'mx-auto flex h-[var(--nav-height)] w-full min-w-0 max-w-[var(--max-width)] items-center justify-between gap-4 px-4 sm:px-6',
        className
      )}
      {...props}
    />
  )
}

function AppTitle({className, ...props}: React.ComponentProps<'h1'>) {
  return (
    <h1
      className={cn(
        'font-dotted text-2xl font-bold tracking-tight text-foreground',
        className
      )}
      {...props}
    />
  )
}

function AppMain({className, ...props}: React.ComponentProps<'main'>) {
  // Width + padding are owned by each page's <Page> wrapper (they set their own
  // mx-auto / max-w-* / p-6). AppMain stays full-width so wide two-column pages
  // (editor, stats) aren't clamped to the narrower --max-width, and so page
  // padding isn't doubled.
  return (
    <main
      data-slot="app-main"
      className={cn('w-full min-w-0', className)}
      {...props}
    />
  )
}

function PageHeader({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        'mb-6 flex flex-wrap items-center justify-between gap-4',
        className
      )}
      {...props}
    />
  )
}

function PageSection({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="page-section"
      className={cn('mb-8', className)}
      {...props}
    />
  )
}

function Page({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="page"
      className={cn('w-full min-w-0', className)}
      {...props}
    />
  )
}

function PageTitle({className, ...props}: React.ComponentProps<'h2'>) {
  return <H2 className={className} {...props} />
}

export {
  AppHeader,
  AppHeaderInner,
  AppMain,
  AppShell,
  AppTitle,
  Page,
  PageHeader,
  PageSection,
  PageTitle
}
