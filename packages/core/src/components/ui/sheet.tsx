import * as SheetPrimitive from '@radix-ui/react-dialog'
import { type VariantProps, cva } from 'class-variance-authority'
import { X } from 'lucide-react'
import * as React from 'react'

import { cn } from '~/lib/utils'

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
	React.ElementRef<typeof SheetPrimitive.Overlay>,
	React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<SheetPrimitive.Overlay
		className={cn(
			'rs-fixed rs-inset-0 rs-z-50 rs-bg-black/80 data-[state=open]:rs-animate-in data-[state=closed]:rs-animate-out data-[state=closed]:rs-fade-out-0 data-[state=open]:rs-fade-in-0',
			className,
		)}
		{...props}
		ref={ref}
	/>
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
	'rs-fixed rs-z-50 rs-gap-4 rs-bg-background rs-p-6 rs-shadow-lg rs-transition rs-ease-in-out data-[state=open]:rs-animate-in data-[state=closed]:rs-animate-out data-[state=closed]:rs-duration-300 data-[state=open]:rs-duration-500',
	{
		variants: {
			side: {
				top: 'rs-inset-x-0 rs-top-0 rs-border-b data-[state=closed]:rs-slide-out-to-top data-[state=open]:rs-slide-in-from-top',
				bottom: 'rs-inset-x-0 rs-bottom-0 rs-border-t data-[state=closed]:rs-slide-out-to-bottom data-[state=open]:rs-slide-in-from-bottom',
				left: 'rs-inset-y-0 rs-left-0 rs-h-full rs-w-3/4 rs-border-r data-[state=closed]:rs-slide-out-to-left data-[state=open]:rs-slide-in-from-left sm:rs-max-w-sm',
				right: 'rs-inset-y-0 rs-right-0 rs-h-full rs-w-3/4 rs-border-l data-[state=closed]:rs-slide-out-to-right data-[state=open]:rs-slide-in-from-right sm:rs-max-w-sm',
			},
		},
		defaultVariants: {
			side: 'right',
		},
	},
)

interface SheetContentProps
	extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
		VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
	React.ElementRef<typeof SheetPrimitive.Content>,
	SheetContentProps
>(({ side = 'right', className, children, ...props }, ref) => (
	<SheetPortal>
		<SheetOverlay />
		<SheetPrimitive.Content
			ref={ref}
			className={cn(sheetVariants({ side }), className)}
			{...props}
		>
			{children}
			<SheetPrimitive.Close className='rs-absolute rs-right-4 rs-top-4 rs-rounded-sm rs-opacity-70 rs-ring-offset-background rs-transition-opacity hover:rs-opacity-100 focus:rs-outline-none focus:rs-ring-2 focus:rs-ring-ring focus:rs-ring-offset-2 disabled:rs-pointer-events-none data-[state=open]:rs-bg-secondary'>
				<X className='rs-h-4 rs-w-4' />
				<span className='rs-sr-only'>Close</span>
			</SheetPrimitive.Close>
		</SheetPrimitive.Content>
	</SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			'rs-flex rs-flex-col rs-space-y-2 rs-text-center sm:rs-text-left',
			className,
		)}
		{...props}
	/>
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			'rs-flex rs-flex-col-reverse sm:rs-flex-row sm:rs-justify-end sm:rs-space-x-2',
			className,
		)}
		{...props}
	/>
)
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = React.forwardRef<
	React.ElementRef<typeof SheetPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
	<SheetPrimitive.Title
		ref={ref}
		className={cn(
			'rs-text-lg rs-font-semibold rs-text-foreground',
			className,
		)}
		{...props}
	/>
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
	React.ElementRef<typeof SheetPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
	<SheetPrimitive.Description
		ref={ref}
		className={cn('rs-text-sm rs-text-muted-foreground', className)}
		{...props}
	/>
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
	Sheet,
	SheetPortal,
	SheetOverlay,
	SheetTrigger,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
}
