import type * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
	'rs-inline-flex rs-items-center rs-rounded-full rs-border rs-px-2.5 rs-py-0.5 rs-text-xs rs-font-semibold rs-transition-colors focus:rs-outline-none focus:rs-ring-2 focus:rs-ring-ring focus:rs-ring-offset-2',
	{
		variants: {
			variant: {
				default:
					'rs-border-transparent rs-bg-primary rs-text-primary-foreground hover:rs-bg-primary/80',
				secondary:
					'rs-border-transparent rs-bg-secondary rs-text-secondary-foreground hover:rs-bg-secondary/80',
				destructive:
					'rs-border-transparent rs-bg-destructive rs-text-destructive-foreground hover:rs-bg-destructive/80',
				outline: 'rs-text-foreground',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
)

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	)
}

export { Badge, badgeVariants }
