import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
	React.ElementRef<typeof ToastPrimitives.Viewport>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
	<ToastPrimitives.Viewport
		ref={ref}
		className={cn(
			'rs-fixed rs-top-0 rs-z-[100] rs-flex rs-max-h-screen rs-w-full rs-flex-col-reverse rs-p-4 sm:rs-bottom-0 sm:rs-right-0 sm:rs-top-auto sm:rs-flex-col md:rs-max-w-[420px]',
			className,
		)}
		{...props}
	/>
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
	'rs-group rs-pointer-events-auto rs-relative rs-flex rs-w-full rs-items-center rs-justify-between rs-space-x-4 rs-overflow-hidden rs-rounded-md rs-border rs-p-6 rs-pr-8 rs-shadow-lg rs-transition-all data-[swipe=cancel]:rs-translate-x-0 data-[swipe=end]:rs-translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:rs-translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:rs-transition-none data-[state=open]:rs-animate-in data-[state=closed]:rs-animate-out data-[swipe=end]:rs-animate-out data-[state=closed]:rs-fade-out-80 data-[state=closed]:rs-slide-out-to-right-full data-[state=open]:rs-slide-in-from-top-full data-[state=open]:sm:rs-slide-in-from-bottom-full',
	{
		variants: {
			variant: {
				default: 'rs-border rs-bg-background rs-text-foreground',
				destructive:
					'rs-destructive rs-group rs-border-destructive rs-bg-destructive rs-text-destructive-foreground',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
)

const Toast = React.forwardRef<
	React.ElementRef<typeof ToastPrimitives.Root>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
		VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
	return (
		<ToastPrimitives.Root
			ref={ref}
			className={cn(toastVariants({ variant }), className)}
			{...props}
		/>
	)
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
	React.ElementRef<typeof ToastPrimitives.Action>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
	<ToastPrimitives.Action
		ref={ref}
		className={cn(
			'rs-inline-flex rs-h-8 rs-shrink-0 rs-items-center rs-justify-center rs-rounded-md rs-border rs-bg-transparent rs-px-3 rs-text-sm rs-font-medium rs-ring-offset-background rs-transition-colors hover:rs-bg-secondary focus:rs-outline-none focus:rs-ring-2 focus:rs-ring-ring focus:rs-ring-offset-2 disabled:rs-pointer-events-none disabled:rs-opacity-50 group-[.destructive]:rs-border-muted/40 group-[.destructive]:hover:rs-border-destructive/30 group-[.destructive]:hover:rs-bg-destructive group-[.destructive]:hover:rs-text-destructive-foreground group-[.destructive]:focus:rs-ring-destructive',
			className,
		)}
		{...props}
	/>
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
	React.ElementRef<typeof ToastPrimitives.Close>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
	<ToastPrimitives.Close
		ref={ref}
		className={cn(
			'rs-absolute rs-right-2 rs-top-2 rs-rounded-md rs-p-1 rs-text-foreground/50 rs-opacity-0 rs-transition-opacity hover:rs-text-foreground focus:rs-opacity-100 focus:rs-outline-none focus:rs-ring-2 group-hover:rs-opacity-100 group-[.destructive]:rs-text-red-300 group-[.destructive]:hover:rs-text-red-50 group-[.destructive]:focus:rs-ring-red-400 group-[.destructive]:focus:rs-ring-offset-red-600',
			className,
		)}
		toast-close=''
		{...props}
	>
		<X className='rs-h-4 rs-w-4' />
	</ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
	React.ElementRef<typeof ToastPrimitives.Title>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
	<ToastPrimitives.Title
		ref={ref}
		className={cn('rs-text-sm rs-font-semibold', className)}
		{...props}
	/>
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
	React.ElementRef<typeof ToastPrimitives.Description>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
	<ToastPrimitives.Description
		ref={ref}
		className={cn('rs-text-sm rs-opacity-90', className)}
		{...props}
	/>
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
	type ToastProps,
	type ToastActionElement,
	ToastProvider,
	ToastViewport,
	Toast,
	ToastTitle,
	ToastDescription,
	ToastClose,
	ToastAction,
}
