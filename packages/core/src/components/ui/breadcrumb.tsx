import { Slot } from '@radix-ui/react-slot'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import * as React from 'react'

import { cn } from '~/lib/utils'

const Breadcrumb = React.forwardRef<
	HTMLElement,
	React.ComponentPropsWithoutRef<'nav'> & {
		separator?: React.ReactNode
	}
>(({ ...props }, ref) => <nav ref={ref} aria-label='breadcrumb' {...props} />)
Breadcrumb.displayName = 'Breadcrumb'

const BreadcrumbList = React.forwardRef<
	HTMLOListElement,
	React.ComponentPropsWithoutRef<'ol'>
>(({ className, ...props }, ref) => (
	<ol
		ref={ref}
		className={cn(
			'rs-flex rs-flex-wrap rs-items-center rs-gap-1.5 rs-break-words rs-text-sm rs-text-muted-foreground sm:rs-gap-2.5',
			className,
		)}
		{...props}
	/>
))
BreadcrumbList.displayName = 'BreadcrumbList'

const BreadcrumbItem = React.forwardRef<
	HTMLLIElement,
	React.ComponentPropsWithoutRef<'li'>
>(({ className, ...props }, ref) => (
	<li
		ref={ref}
		className={cn('rs-inline-flex rs-items-center rs-gap-1.5', className)}
		{...props}
	/>
))
BreadcrumbItem.displayName = 'BreadcrumbItem'

const BreadcrumbLink = React.forwardRef<
	HTMLAnchorElement,
	React.ComponentPropsWithoutRef<'a'> & {
		asChild?: boolean
	}
>(({ asChild, className, ...props }, ref) => {
	const Comp = asChild ? Slot : 'a'

	return (
		<Comp
			ref={ref}
			className={cn(
				'rs-transition-colors hover:rs-text-foreground',
				className,
			)}
			{...props}
		/>
	)
})
BreadcrumbLink.displayName = 'BreadcrumbLink'

const BreadcrumbPage = React.forwardRef<
	HTMLSpanElement,
	React.ComponentPropsWithoutRef<'span'>
>(({ className, ...props }, ref) => (
	// biome-ignore lint/a11y/useFocusableInteractive: <explanation>
	<span
		ref={ref}
		role='link'
		aria-disabled='true'
		aria-current='page'
		className={cn('rs-font-normal rs-text-foreground', className)}
		{...props}
	/>
))
BreadcrumbPage.displayName = 'BreadcrumbPage'

const BreadcrumbSeparator = ({
	children,
	className,
	...props
}: React.ComponentProps<'li'>) => (
	<li
		role='presentation'
		aria-hidden='true'
		className={cn('[&>svg]:rs-w-3.5 [&>svg]:rs-h-3.5', className)}
		{...props}
	>
		{children ?? <ChevronRight />}
	</li>
)
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator'

const BreadcrumbEllipsis = ({
	className,
	...props
}: React.ComponentProps<'span'>) => (
	<span
		role='presentation'
		aria-hidden='true'
		className={cn(
			'rs-flex rs-h-9 rs-w-9 rs-items-center rs-justify-center',
			className,
		)}
		{...props}
	>
		<MoreHorizontal className='rs-h-4 rs-w-4' />
		<span className='rs-sr-only'>More</span>
	</span>
)
BreadcrumbEllipsis.displayName = 'BreadcrumbElipssis'

export {
	Breadcrumb,
	BreadcrumbList,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbPage,
	BreadcrumbSeparator,
	BreadcrumbEllipsis,
}
