import type { DialogProps } from '@radix-ui/react-dialog'
import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'
import * as React from 'react'

import { Dialog, DialogContent } from '~/components/ui/dialog'
import { cn } from '~/lib/utils'

const Command = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
	<CommandPrimitive
		ref={ref}
		className={cn(
			'rs-flex rs-h-full rs-w-full rs-flex-col rs-overflow-hidden rs-rounded-md rs-bg-popover rs-text-popover-foreground',
			className,
		)}
		{...props}
	/>
))
Command.displayName = CommandPrimitive.displayName

const CommandDialog = ({ children, ...props }: DialogProps) => {
	return (
		<Dialog {...props}>
			<DialogContent className='rs-overflow-hidden rs-p-0 rs-shadow-lg'>
				<Command className='[&_[cmdk-group-heading]]:rs-px-2 [&_[cmdk-group-heading]]:rs-font-medium [&_[cmdk-group-heading]]:rs-text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:rs-pt-0 [&_[cmdk-group]]:rs-px-2 [&_[cmdk-input-wrapper]_svg]:rs-h-5 [&_[cmdk-input-wrapper]_svg]:rs-w-5 [&_[cmdk-input]]:rs-h-12 [&_[cmdk-item]]:rs-px-2 [&_[cmdk-item]]:rs-py-3 [&_[cmdk-item]_svg]:rs-h-5 [&_[cmdk-item]_svg]:rs-w-5'>
					{children}
				</Command>
			</DialogContent>
		</Dialog>
	)
}

const CommandInput = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Input>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
	<div
		className='rs-flex rs-items-center rs-border-b rs-px-3'
		cmdk-input-wrapper=''
	>
		<Search className='rs-mr-2 rs-h-4 rs-w-4 rs-shrink-0 rs-opacity-50' />
		<CommandPrimitive.Input
			ref={ref}
			className={cn(
				'rs-flex rs-h-11 rs-w-full rs-rounded-md rs-bg-transparent rs-py-3 rs-text-sm rs-outline-none placeholder:rs-text-muted-foreground disabled:rs-cursor-not-allowed disabled:rs-opacity-50',
				className,
			)}
			{...props}
		/>
	</div>
))

CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.List
		ref={ref}
		className={cn(
			'rs-max-h-[300px] rs-overflow-y-auto rs-overflow-x-hidden',
			className,
		)}
		{...props}
	/>
))

CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Empty>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
	<CommandPrimitive.Empty
		ref={ref}
		className='rs-py-6 rs-text-center rs-text-sm'
		{...props}
	/>
))

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Group>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Group
		ref={ref}
		className={cn(
			'rs-overflow-hidden rs-p-1 rs-text-foreground [&_[cmdk-group-heading]]:rs-px-2 [&_[cmdk-group-heading]]:rs-py-1.5 [&_[cmdk-group-heading]]:rs-text-xs [&_[cmdk-group-heading]]:rs-font-medium [&_[cmdk-group-heading]]:rs-text-muted-foreground',
			className,
		)}
		{...props}
	/>
))

CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Separator
		ref={ref}
		className={cn('-rs-mx-1 rs-h-px rs-bg-border', className)}
		{...props}
	/>
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Item
		ref={ref}
		className={cn(
			"rs-relative rs-flex rs-cursor-default rs-gap-2 rs-select-none rs-items-center rs-rounded-sm rs-px-2 rs-py-1.5 rs-text-sm rs-outline-none data-[disabled=true]:rs-pointer-events-none data-[selected='true']:rs-bg-accent data-[selected=true]:rs-text-accent-foreground data-[disabled=true]:rs-opacity-50 [&_svg]:rs-pointer-events-none [&_svg]:rs-size-4 [&_svg]:rs-shrink-0",
			className,
		)}
		{...props}
	/>
))

CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({
	className,
	...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
	return (
		<span
			className={cn(
				'rs-ml-auto rs-text-xs rs-tracking-widest rs-text-muted-foreground',
				className,
			)}
			{...props}
		/>
	)
}
CommandShortcut.displayName = 'CommandShortcut'

export {
	Command,
	CommandDialog,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandShortcut,
	CommandSeparator,
}
