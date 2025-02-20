import * as ToolbarPrimitive from '@radix-ui/react-toolbar'
import * as React from 'react'

import { cn } from '~/lib/utils'

const Toolbar = React.forwardRef<
	React.ElementRef<typeof ToolbarPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root>
>(({ className, ...props }, ref) => (
	<ToolbarPrimitive.Root
		ref={ref}
		className={cn(
			'rs-flex rs-items-center rs-space-x-1 rs-rounded-md rs-border rs-bg-background rs-p-1',
			className,
		)}
		{...props}
	/>
))
Toolbar.displayName = ToolbarPrimitive.Root.displayName

const ToolbarButton = React.forwardRef<
	React.ElementRef<typeof ToolbarPrimitive.Button>,
	React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button>
>(({ className, ...props }, ref) => (
	<ToolbarPrimitive.Button
		ref={ref}
		className={cn(
			'rs-inline-flex rs-items-center rs-justify-center rs-rounded-sm rs-px-2.5 rs-py-1.5 rs-text-sm rs-font-medium rs-ring-offset-background rs-transition-colors focus-visible:rs-outline-none focus-visible:rs-ring-2 focus-visible:rs-ring-ring focus-visible:rs-ring-offset-2 disabled:rs-pointer-events-none disabled:rs-opacity-50',
			'hover:rs-bg-muted hover:rs-text-muted-foreground',
			className,
		)}
		{...props}
	/>
))
ToolbarButton.displayName = ToolbarPrimitive.Button.displayName

const ToolbarSeparator = React.forwardRef<
	React.ElementRef<typeof ToolbarPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<ToolbarPrimitive.Separator
		ref={ref}
		className={cn('rs-mx-1 rs-h-5 rs-w-[1px] rs-bg-border', className)}
		{...props}
	/>
))
ToolbarSeparator.displayName = ToolbarPrimitive.Separator.displayName

const ToolbarLink = React.forwardRef<
	React.ElementRef<typeof ToolbarPrimitive.Link>,
	React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Link>
>(({ className, ...props }, ref) => (
	<ToolbarPrimitive.Link
		ref={ref}
		className={cn(
			'rs-inline-flex rs-items-center rs-justify-center rs-rounded-sm rs-px-2.5 rs-py-1.5 rs-text-sm rs-font-medium rs-ring-offset-background rs-transition-colors focus-visible:rs-outline-none focus-visible:rs-ring-2 focus-visible:rs-ring-ring focus-visible:rs-ring-offset-2 disabled:rs-pointer-events-none disabled:rs-opacity-50',
			'hover:rs-bg-muted hover:rs-text-muted-foreground',
			className,
		)}
		{...props}
	/>
))
ToolbarLink.displayName = ToolbarPrimitive.Link.displayName

export { Toolbar, ToolbarButton, ToolbarSeparator, ToolbarLink }
