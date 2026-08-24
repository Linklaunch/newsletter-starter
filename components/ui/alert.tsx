import {cva} from 'class-variance-authority'
import type {VariantProps} from 'class-variance-authority'
import type * as React from 'react'

import {cn} from '@/lib/utils'

const alertVariants = cva(
  'group/alert relative w-full rounded-lg border px-4 py-3 text-sm text-foreground [&_p]:m-0',
  {
    variants: {
      variant: {
        default: 'border-border bg-muted/30',
        destructive:
          'border-ui-danger-border bg-ui-danger-soft-bg text-ui-danger-fg [&_a]:text-ui-danger-fg [&_a]:underline [&_a]:underline-offset-2',
        success: 'border-ui-success-border bg-ui-success-bg text-ui-success-fg',
        warning: 'border-ui-warning-border bg-ui-warning-bg text-ui-warning-fg',
        info: 'border-ui-info-border bg-ui-info-bg text-ui-info-fg'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({variant}), className)}
      {...props}
    />
  )
}

function AlertTitle({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        'font-dotted mb-1 font-medium leading-none tracking-tight [&+div]:translate-y-[-2px]',
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-sm leading-relaxed text-foreground/90 [&_p]:leading-relaxed',
        className
      )}
      {...props}
    />
  )
}

export {Alert, AlertDescription, AlertTitle, alertVariants}
