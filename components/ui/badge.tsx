import {cva} from 'class-variance-authority'
import type {VariantProps} from 'class-variance-authority'
import type * as React from 'react'

import {cn} from '@/lib/utils'

import './glass.css'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:size-3 [&_*]:text-inherit',
  {
    variants: {
      variant: {
        default:
          'glass glass--primary border-transparent text-primary-foreground',
        secondary: 'glass glass--secondary border-transparent',
        outline: 'glass glass--outline border-transparent',
        /* Translucent glass tints  -  see glass.css .glass--* */
        success: 'glass glass--success',
        destructive: 'glass glass--ui-danger',
        warning: 'glass glass--warning',
        accent: 'glass glass--accent',
        cover: 'glass glass--cover',
        pass: 'glass glass--pass',
        muted: 'glass glass--muted border-transparent text-muted-foreground',
        brand: 'glass glass--brand',
        info: 'glass glass--info',
        infoMuted: 'glass glass--info-muted',
        dangerBadge: 'glass glass--danger-badge',
        mutedDim: 'glass glass--muted-dim border-transparent',
        holdingLong:
          'glass glass--success gap-1.5 font-mono text-xs font-normal',
        holdingShort:
          'glass glass--accent gap-1.5 font-mono text-xs font-normal'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({variant}), className)}
      {...props}
    />
  )
}

export {Badge, badgeVariants}
