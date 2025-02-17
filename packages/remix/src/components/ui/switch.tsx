import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

const Switch = React.forwardRef<
	React.ElementRef<typeof SwitchPrimitives.Root>,
	React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
	<SwitchPrimitives.Root
		className={cn(
			'rs-peer rs-inline-flex rs-h-6 rs-w-11 rs-shrink-0 rs-cursor-pointer rs-items-center rs-rounded-full rs-border-2 rs-border-transparent rs-transition-colors focus-visible:rs-outline-none focus-visible:rs-ring-2 focus-visible:rs-ring-ring focus-visible:rs-ring-offset-2 focus-visible:rs-ring-offset-background disabled:rs-cursor-not-allowed disabled:rs-opacity-50 data-[state=checked]:rs-bg-primary data-[state=unchecked]:rs-bg-input',
			className,
		)}
		{...props}
		ref={ref}
	>
		<SwitchPrimitives.Thumb
			className={cn(
				'rs-pointer-events-none rs-block rs-h-5 rs-w-5 rs-rounded-full rs-bg-background rs-shadow-lg rs-ring-0 rs-transition-transform data-[state=checked]:rs-translate-x-5 data-[state=unchecked]:rs-translate-x-0',
			)}
		/>
	</SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
