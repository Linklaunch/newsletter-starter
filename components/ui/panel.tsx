import type * as React from 'react'

import {cn} from '@/lib/utils'
import {Muted} from './typography'

/**
 * Standard container card for the operator console. Consolidates the several
 * ad-hoc `rounded-xl border border-border bg-* p-*` boxes the pages grew into
 * a single consistent treatment (rounded-xl, hairline border, subtle card
 * surface). Pass `className` to tweak padding/layout per use.
 */
export function Panel({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="panel"
      className={cn(
        'rounded-xl border border-border bg-card/40 p-5',
        className
      )}
      {...props}
    />
  )
}

/**
 * Centered empty-state box used when a list has no content.
 * hand-copied across the console, promos, and stats pages.
 */
export function EmptyState({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center',
        className
      )}>
      <Muted>{children}</Muted>
    </div>
  )
}
