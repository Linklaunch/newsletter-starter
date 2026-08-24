import * as TabsPrimitive from '@radix-ui/react-tabs'
import {cva} from 'class-variance-authority'
import type {VariantProps} from 'class-variance-authority'
import type * as React from 'react'

import {cn} from '@/lib/utils'

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('group/tabs flex flex-col gap-2', className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  'inline-flex w-fit items-center justify-center text-muted-foreground data-[orientation=vertical]:h-fit data-[orientation=vertical]:flex-col',
  {
    variants: {
      variant: {
        default: 'rounded-lg bg-muted p-[3px]',
        line: 'h-auto gap-0 rounded-none border-b border-border bg-transparent p-0'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function TabsList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({variant}), 'group/tabs-list', className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:opacity-50',
        'text-muted-foreground hover:text-foreground',
        'group-data-[variant=default]/tabs-list:data-[state=active]:bg-background group-data-[variant=default]/tabs-list:data-[state=active]:text-foreground group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm',
        'group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:px-4 group-data-[variant=line]/tabs-list:py-2.5 group-data-[variant=line]/tabs-list:shadow-none',
        'group-data-[variant=line]/tabs-list:data-[state=active]:border-primary group-data-[variant=line]/tabs-list:data-[state=active]:text-primary group-data-[variant=line]/tabs-list:data-[state=active]:hover:text-primary',
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        'flex min-h-0 w-full min-w-0 flex-1 flex-col outline-none',
        className
      )}
      {...props}
    />
  )
}

export {Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants}
