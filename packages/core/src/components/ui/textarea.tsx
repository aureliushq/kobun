import * as React from 'react'

import { cn } from '~/lib/utils'

const Textarea = React.forwardRef<
	HTMLTextAreaElement,
	React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
	return (
		<textarea
			className={cn(
				'rs-flex rs-min-h-[80px] rs-w-full rs-rounded-md rs-border rs-border-input rs-bg-background rs-px-3 rs-py-2 rs-text-base rs-ring-offset-background placeholder:rs-text-muted-foreground focus-visible:rs-outline-none focus-visible:rs-ring-2 focus-visible:rs-ring-ring focus-visible:rs-ring-offset-2 disabled:rs-cursor-not-allowed disabled:rs-opacity-50 md:rs-text-sm',
				className,
			)}
			ref={ref}
			{...props}
		/>
	)
})
Textarea.displayName = 'Textarea'

export { Textarea }
