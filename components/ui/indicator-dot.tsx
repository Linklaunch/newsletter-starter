import type * as React from 'react'

import {cn} from '@/lib/utils'

function IndicatorDot({
  className,
  active,
  ...props
}: React.ComponentProps<'span'> & {
  active?: boolean
}) {
  return (
    <span
      data-slot="indicator-dot"
      role="presentation"
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full',
        active ? 'animate-pulse bg-ui-cta-ok' : 'bg-ui-cta-danger',
        className
      )}
      {...props}
    />
  )
}

export {IndicatorDot}
