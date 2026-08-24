import type * as React from 'react'

import {cn} from '@/lib/utils'

import './glass.css'

type FrameVariant = 'default' | 'outline' | 'ghost'

function Frame({
  className,
  variant = 'default',
  ref,
  ...props
}: React.ComponentProps<'div'> & {
  variant?: FrameVariant
}) {
  return (
    <div
      ref={ref}
      data-slot="frame"
      className={cn(
        'glass rounded-xl',
        variant === 'default' && 'glass--muted',
        variant === 'outline' && 'glass--outline',
        variant === 'ghost' && 'glass--muted border-transparent',
        className
      )}
      {...props}
    />
  )
}

export {Frame}
export type {FrameVariant}
