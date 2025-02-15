'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Overlay>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay
		ref={ref}
		className={cn(
			'rs-fixed rs-inset-0 rs-z-50 rs-bg-black/80 data-[state=open]:rs-animate-in data-[state=closed]:rs-animate-out data-[state=closed]:rs-fade-out-0 data-[state=open]:rs-fade-in-0',
			className,
		)}
		{...props}
	/>
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
	<DialogPortal>
		<DialogOverlay />
		<DialogPrimitive.Content
			ref={ref}
			className={cn(
				'rs-fixed rs-left-[50%] rs-top-[50%] rs-z-50 rs-grid rs-w-full rs-max-w-lg rs-translate-x-[-50%] rs-translate-y-[-50%] rs-gap-4 rs-border rs-bg-background rs-p-6 rs-shadow-lg rs-duration-200 data-[state=open]:rs-animate-in data-[state=closed]:rs-animate-out data-[state=closed]:rs-fade-out-0 data-[state=open]:rs-fade-in-0 data-[state=closed]:rs-zoom-out-95 data-[state=open]:rs-zoom-in-95 data-[state=closed]:rs-slide-out-to-left-1/2 data-[state=closed]:rs-slide-out-to-top-[48%] data-[state=open]:rs-slide-in-from-left-1/2 data-[state=open]:rs-slide-in-from-top-[48%] sm:rs-rounded-lg',
				className,
			)}
			{...props}
		>
			{children}
			<DialogPrimitive.Close className='rs-absolute rs-right-4 rs-top-4 rs-rounded-sm rs-opacity-70 rs-ring-offset-background rs-transition-opacity hover:rs-opacity-100 focus:rs-outline-none focus:rs-ring-2 focus:rs-ring-ring focus:rs-ring-offset-2 disabled:rs-pointer-events-none data-[state=open]:rs-bg-accent data-[state=open]:rs-text-muted-foreground'>
				<X className='rs-h-4 rs-w-4' />
				<span className='rs-sr-only'>Close</span>
			</DialogPrimitive.Close>
		</DialogPrimitive.Content>
	</DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			'rs-flex rs-flex-col rs-space-y-1.5 rs-text-center sm:rs-text-left',
			className,
		)}
		{...props}
	/>
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({
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
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Title
		ref={ref}
		className={cn(
			'rs-text-lg rs-font-semibold rs-leading-none rs-tracking-tight',
			className,
		)}
		{...props}
	/>
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Description
		ref={ref}
		className={cn('rs-text-sm rs-text-muted-foreground', className)}
		{...props}
	/>
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
	Dialog,
	DialogPortal,
	DialogOverlay,
	DialogClose,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription,
}
