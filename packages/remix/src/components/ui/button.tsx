import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
	'rs-inline-flex rs-items-center rs-justify-center rs-gap-2 rs-whitespace-nowrap rs-rounded-md rs-text-sm rs-font-medium rs-ring-offset-background rs-transition-colors focus-visible:rs-outline-none focus-visible:rs-ring-2 focus-visible:rs-ring-ring focus-visible:rs-ring-offset-2 disabled:rs-pointer-events-none disabled:rs-opacity-50 [&_svg]:rs-pointer-events-none [&_svg]:rs-size-4 [&_svg]:rs-shrink-0',
	{
		variants: {
			variant: {
				default:
					'rs-bg-primary rs-text-primary-foreground hover:rs-bg-primary/90',
				destructive:
					'rs-bg-destructive rs-text-destructive-foreground hover:rs-bg-destructive/90',
				outline:
					'rs-border rs-border-input rs-bg-background hover:rs-bg-accent hover:rs-text-accent-foreground',
				secondary:
					'rs-bg-secondary rs-text-secondary-foreground hover:rs-bg-secondary/80',
				ghost: 'hover:rs-bg-accent hover:rs-text-accent-foreground',
				link: 'rs-text-primary rs-underline-offset-4 hover:rs-underline',
			},
			size: {
				default: 'rs-h-10 rs-px-4 rs-py-2',
				sm: 'rs-h-9 rs-rounded-md rs-px-3',
				lg: 'rs-h-11 rs-rounded-md rs-px-8',
				icon: 'rs-h-10 rs-w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button'
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		)
	},
)
Button.displayName = 'Button'

export { Button, buttonVariants }
