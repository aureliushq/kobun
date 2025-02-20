import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import * as React from 'react'

import { cn } from '~/lib/utils'

const Checkbox = React.forwardRef<
	React.ElementRef<typeof CheckboxPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
	<CheckboxPrimitive.Root
		ref={ref}
		className={cn(
			'rs-peer rs-h-4 rs-w-4 rs-shrink-0 rs-rounded-sm rs-border rs-border-primary rs-ring-offset-background focus-visible:rs-outline-none focus-visible:rs-ring-2 focus-visible:rs-ring-ring focus-visible:rs-ring-offset-2 disabled:rs-cursor-not-allowed disabled:rs-opacity-50 data-[state=checked]:rs-bg-primary data-[state=checked]:rs-text-primary-foreground',
			className,
		)}
		{...props}
	>
		<CheckboxPrimitive.Indicator
			className={cn(
				'rs-flex rs-items-center rs-justify-center rs-text-current',
			)}
		>
			<Check className='rs-h-4 rs-w-4' />
		</CheckboxPrimitive.Indicator>
	</CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
