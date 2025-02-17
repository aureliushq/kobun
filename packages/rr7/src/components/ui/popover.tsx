import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'

import { cn } from '@/lib/utils'

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
	React.ElementRef<typeof PopoverPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
	<PopoverPrimitive.Portal>
		<PopoverPrimitive.Content
			ref={ref}
			align={align}
			sideOffset={sideOffset}
			className={cn(
				'rs-z-50 rs-w-72 rs-rounded-md rs-border rs-bg-popover rs-p-4 rs-text-popover-foreground rs-shadow-md rs-outline-none data-[state=open]:rs-animate-in data-[state=closed]:rs-animate-out data-[state=closed]:rs-fade-out-0 data-[state=open]:rs-fade-in-0 data-[state=closed]:rs-zoom-out-95 data-[state=open]:rs-zoom-in-95 data-[side=bottom]:rs-slide-in-from-top-2 data-[side=left]:rs-slide-in-from-right-2 data-[side=right]:rs-slide-in-from-left-2 data-[side=top]:rs-slide-in-from-bottom-2',
				className,
			)}
			{...props}
		/>
	</PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
