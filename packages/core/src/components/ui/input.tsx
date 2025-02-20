import * as React from 'react'

import { cn } from '~/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(
					'rs-flex rs-h-10 rs-w-full rs-rounded-md rs-border rs-border-input rs-bg-background rs-px-3 rs-py-2 rs-text-base rs-ring-offset-background file:rs-border-0 file:rs-bg-transparent file:rs-text-sm file:rs-font-medium file:rs-text-foreground placeholder:rs-text-muted-foreground focus-visible:rs-outline-none focus-visible:rs-ring-2 focus-visible:rs-ring-ring focus-visible:rs-ring-offset-2 disabled:rs-cursor-not-allowed disabled:rs-opacity-50 md:rs-text-sm',
					className,
				)}
				ref={ref}
				{...props}
			/>
		)
	},
)
Input.displayName = 'Input'

export { Input }
