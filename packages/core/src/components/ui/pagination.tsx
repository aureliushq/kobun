import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import * as React from 'react'

import { type ButtonProps, buttonVariants } from '~/components/ui/button'
import { cn } from '~/lib/utils'

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
	<nav
		aria-label='pagination'
		className={cn(
			'rs-mx-auto rs-flex rs-w-full rs-justify-center',
			className,
		)}
		{...props}
	/>
)
Pagination.displayName = 'Pagination'

const PaginationContent = React.forwardRef<
	HTMLUListElement,
	React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
	<ul
		ref={ref}
		className={cn(
			'rs-flex rs-flex-row rs-items-center rs-gap-1',
			className,
		)}
		{...props}
	/>
))
PaginationContent.displayName = 'PaginationContent'

const PaginationItem = React.forwardRef<
	HTMLLIElement,
	React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
	<li ref={ref} className={cn('', className)} {...props} />
))
PaginationItem.displayName = 'PaginationItem'

type PaginationLinkProps = {
	isActive?: boolean
} & Pick<ButtonProps, 'size'> &
	React.ComponentProps<'a'>

const PaginationLink = ({
	className,
	isActive,
	size = 'icon',
	...props
}: PaginationLinkProps) => (
	<a
		aria-current={isActive ? 'page' : undefined}
		className={cn(
			buttonVariants({
				variant: isActive ? 'outline' : 'ghost',
				size,
			}),
			className,
		)}
		{...props}
	/>
)
PaginationLink.displayName = 'PaginationLink'

const PaginationPrevious = ({
	className,
	...props
}: React.ComponentProps<typeof PaginationLink>) => (
	<PaginationLink
		aria-label='Go to previous page'
		size='default'
		className={cn('rs-gap-1 rs-pl-2.5', className)}
		{...props}
	>
		<ChevronLeft className='rs-h-4 rs-w-4' />
		<span>Previous</span>
	</PaginationLink>
)
PaginationPrevious.displayName = 'PaginationPrevious'

const PaginationNext = ({
	className,
	...props
}: React.ComponentProps<typeof PaginationLink>) => (
	<PaginationLink
		aria-label='Go to next page'
		size='default'
		className={cn('rs-gap-1 rs-pr-2.5', className)}
		{...props}
	>
		<span>Next</span>
		<ChevronRight className='rs-h-4 rs-w-4' />
	</PaginationLink>
)
PaginationNext.displayName = 'PaginationNext'

const PaginationEllipsis = ({
	className,
	...props
}: React.ComponentProps<'span'>) => (
	<span
		aria-hidden
		className={cn(
			'rs-flex rs-h-9 rs-w-9 rs-items-center rs-justify-center',
			className,
		)}
		{...props}
	>
		<MoreHorizontal className='rs-h-4 rs-w-4' />
		<span className='rs-sr-only'>More pages</span>
	</span>
)
PaginationEllipsis.displayName = 'PaginationEllipsis'

export {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
}
