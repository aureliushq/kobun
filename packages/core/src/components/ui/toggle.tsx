'use client'

import * as React from 'react'
import * as TogglePrimitive from '@radix-ui/react-toggle'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const toggleVariants = cva(
	'rs-inline-flex rs-items-center rs-justify-center rs-rounded-md rs-text-sm rs-font-medium rs-ring-offset-background rs-transition-colors hover:rs-bg-muted hover:rs-text-muted-foreground focus-visible:rs-outline-none focus-visible:rs-ring-2 focus-visible:rs-ring-ring focus-visible:rs-ring-offset-2 disabled:rs-pointer-events-none disabled:rs-opacity-50 data-[state=on]:rs-bg-accent data-[state=on]:rs-text-accent-foreground [&_svg]:rs-pointer-events-none [&_svg]:rs-size-4 [&_svg]:rs-shrink-0 rs-gap-2',
	{
		variants: {
			variant: {
				default: 'rs-bg-transparent',
				outline:
					'rs-border rs-border-input rs-bg-transparent hover:rs-bg-accent hover:rs-text-accent-foreground',
			},
			size: {
				default: 'rs-h-10 rs-px-3 rs-min-w-10',
				sm: 'rs-h-9 rs-px-2.5 rs-min-w-9',
				lg: 'rs-h-11 rs-px-5 rs-min-w-11',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

const Toggle = React.forwardRef<
	React.ElementRef<typeof TogglePrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
		VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
	<TogglePrimitive.Root
		ref={ref}
		className={cn(toggleVariants({ variant, size, className }))}
		{...props}
	/>
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
