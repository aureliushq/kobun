import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'

import { cn } from '~/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
	React.ElementRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
	<TooltipPrimitive.Content
		ref={ref}
		sideOffset={sideOffset}
		className={cn(
			'rs-z-50 rs-overflow-hidden rs-rounded-md rs-border rs-bg-popover rs-px-3 rs-py-1.5 rs-text-sm rs-text-popover-foreground rs-shadow-md rs-animate-in rs-fade-in-0 rs-zoom-in-95 data-[state=closed]:rs-animate-out data-[state=closed]:rs-fade-out-0 data-[state=closed]:rs-zoom-out-95 data-[side=bottom]:rs-slide-in-from-top-2 data-[side=left]:rs-slide-in-from-right-2 data-[side=right]:rs-slide-in-from-left-2 data-[side=top]:rs-slide-in-from-bottom-2',
			className,
		)}
		{...props}
	/>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
