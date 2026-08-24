import type * as React from 'react'

import {cn} from '@/lib/utils'

function H1({className, ...props}: React.ComponentProps<'h1'>) {
  return (
    <h1
      className={cn(
        'font-dotted text-3xl font-bold tracking-tight text-foreground',
        className
      )}
      {...props}
    />
  )
}

function H2({className, ...props}: React.ComponentProps<'h2'>) {
  return (
    <h2
      className={cn(
        'font-dotted text-xl font-semibold text-foreground',
        className
      )}
      {...props}
    />
  )
}

function Text({className, ...props}: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-foreground', className)} {...props} />
}

function Strong({className, ...props}: React.ComponentProps<'strong'>) {
  return (
    <strong
      className={cn('font-semibold text-foreground', className)}
      {...props}
    />
  )
}

function Muted({className, ...props}: React.ComponentProps<'p'>) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
}

function Caption({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

function Inline({className, ...props}: React.ComponentProps<'span'>) {
  return (
    <span className={cn('text-sm text-foreground/90', className)} {...props} />
  )
}

function Mono({className, ...props}: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('font-mono text-sm text-foreground/90', className)}
      {...props}
    />
  )
}

function Row({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-row flex-wrap items-center gap-2', className)}
      {...props}
    />
  )
}

function Stack({className, ...props}: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2', className)} {...props} />
}

function Grid({className, ...props}: React.ComponentProps<'div'>) {
  return <div className={cn('grid', className)} {...props} />
}

export {Caption, Grid, H1, H2, Inline, Mono, Muted, Row, Stack, Strong, Text}
