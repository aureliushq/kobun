import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import * as React from 'react'

import { cn } from '~/lib/utils'

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
		inset?: boolean
	}
>(({ className, inset, children, ...props }, ref) => (
	<DropdownMenuPrimitive.SubTrigger
		ref={ref}
		className={cn(
			'rs-flex rs-cursor-default rs-gap-2 rs-select-none rs-items-center rs-rounded-sm rs-px-2 rs-py-1.5 rs-text-sm rs-outline-none focus:rs-bg-accent data-[state=open]:rs-bg-accent [&_svg]:rs-pointer-events-none [&_svg]:rs-size-4 [&_svg]:rs-shrink-0',
			inset && 'rs-pl-8',
			className,
		)}
		{...props}
	>
		{children}
		<ChevronRight className='rs-ml-auto' />
	</DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
	DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
	<DropdownMenuPrimitive.SubContent
		ref={ref}
		className={cn(
			'rs-z-50 rs-min-w-[8rem] rs-overflow-hidden rs-rounded-md rs-border rs-bg-popover rs-p-1 rs-text-popover-foreground rs-shadow-lg data-[state=open]:rs-animate-in data-[state=closed]:rs-animate-out data-[state=closed]:rs-fade-out-0 data-[state=open]:rs-fade-in-0 data-[state=closed]:rs-zoom-out-95 data-[state=open]:rs-zoom-in-95 data-[side=bottom]:rs-slide-in-from-top-2 data-[side=left]:rs-slide-in-from-right-2 data-[side=right]:rs-slide-in-from-left-2 data-[side=top]:rs-slide-in-from-bottom-2',
			className,
		)}
		{...props}
	/>
))
DropdownMenuSubContent.displayName =
	DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
	<DropdownMenuPrimitive.Portal>
		<DropdownMenuPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			className={cn(
				'rs-z-50 rs-min-w-[8rem] rs-overflow-hidden rs-rounded-md rs-border rs-bg-popover rs-p-1 rs-text-popover-foreground rs-shadow-md data-[state=open]:rs-animate-in data-[state=closed]:rs-animate-out data-[state=closed]:rs-fade-out-0 data-[state=open]:rs-fade-in-0 data-[state=closed]:rs-zoom-out-95 data-[state=open]:rs-zoom-in-95 data-[side=bottom]:rs-slide-in-from-top-2 data-[side=left]:rs-slide-in-from-right-2 data-[side=right]:rs-slide-in-from-left-2 data-[side=top]:rs-slide-in-from-bottom-2',
				className,
			)}
			{...props}
		/>
	</DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
		inset?: boolean
	}
>(({ className, inset, ...props }, ref) => (
	<DropdownMenuPrimitive.Item
		ref={ref}
		className={cn(
			'rs-relative rs-flex rs-cursor-default rs-select-none rs-items-center rs-gap-2 rs-rounded-sm rs-px-2 rs-py-1.5 rs-text-sm rs-outline-none rs-transition-colors focus:rs-bg-accent focus:rs-text-accent-foreground data-[disabled]:rs-pointer-events-none data-[disabled]:rs-opacity-50 [&_svg]:rs-pointer-events-none [&_svg]:rs-size-4 [&_svg]:rs-shrink-0',
			inset && 'rs-pl-8',
			className,
		)}
		{...props}
	/>
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
	<DropdownMenuPrimitive.CheckboxItem
		ref={ref}
		className={cn(
			'rs-relative rs-flex rs-cursor-default rs-select-none rs-items-center rs-rounded-sm rs-py-1.5 rs-pl-8 rs-pr-2 rs-text-sm rs-outline-none rs-transition-colors focus:rs-bg-accent focus:rs-text-accent-foreground data-[disabled]:rs-pointer-events-none data-[disabled]:rs-opacity-50',
			className,
		)}
		checked={checked}
		{...props}
	>
		<span className='rs-absolute rs-left-2 rs-flex rs-h-3.5 rs-w-3.5 rs-items-center rs-justify-center'>
			<DropdownMenuPrimitive.ItemIndicator>
				<Check className='rs-h-4 rs-w-4' />
			</DropdownMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName =
	DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
	<DropdownMenuPrimitive.RadioItem
		ref={ref}
		className={cn(
			'rs-relative rs-flex rs-cursor-default rs-select-none rs-items-center rs-rounded-sm rs-py-1.5 rs-pl-8 rs-pr-2 rs-text-sm rs-outline-none rs-transition-colors focus:rs-bg-accent focus:rs-text-accent-foreground data-[disabled]:rs-pointer-events-none data-[disabled]:rs-opacity-50',
			className,
		)}
		{...props}
	>
		<span className='rs-absolute rs-left-2 rs-flex rs-h-3.5 rs-w-3.5 rs-items-center rs-justify-center'>
			<DropdownMenuPrimitive.ItemIndicator>
				<Circle className='rs-h-2 rs-w-2 rs-fill-current' />
			</DropdownMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Label>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
		inset?: boolean
	}
>(({ className, inset, ...props }, ref) => (
	<DropdownMenuPrimitive.Label
		ref={ref}
		className={cn(
			'rs-px-2 rs-py-1.5 rs-text-sm rs-font-semibold',
			inset && 'rs-pl-8',
			className,
		)}
		{...props}
	/>
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<DropdownMenuPrimitive.Separator
		ref={ref}
		className={cn('-rs-mx-1 rs-my-1 rs-h-px rs-bg-muted', className)}
		{...props}
	/>
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
	className,
	...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
	return (
		<span
			className={cn(
				'rs-ml-auto rs-text-xs rs-tracking-widest rs-opacity-60',
				className,
			)}
			{...props}
		/>
	)
}
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut'

export {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuGroup,
	DropdownMenuPortal,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuRadioGroup,
}
