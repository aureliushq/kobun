import { Command as CommandPrimitive } from 'cmdk'
import { X } from 'lucide-react'
import * as React from 'react'

import { Badge } from '~/components/ui/badge'
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from '~/components/ui/command'
import { cn } from '~/lib/utils'

export type SelectOption = {
	value: string
	label: string
}

export interface MultiSelectProps {
	options: SelectOption[]
	value: SelectOption[]
	onChange: (value: SelectOption[]) => void
	placeholder?: string
	disabled?: boolean
	maxItems?: number
	className?: string
	badgeClassName?: string
	containerClassName?: string
	emptyMessage?: string
}

export function MultiSelect({
	options,
	value,
	onChange,
	placeholder = 'Select options...',
	disabled = false,
	maxItems,
	className,
	badgeClassName,
	containerClassName,
	emptyMessage = 'No options available',
}: MultiSelectProps) {
	const inputRef = React.useRef<HTMLInputElement>(null)
	const [open, setOpen] = React.useState(false)
	const [inputValue, setInputValue] = React.useState('')

	const handleUnselect = React.useCallback(
		(option: SelectOption) => {
			onChange(value.filter((item) => item.value !== option.value))
		},
		[onChange, value],
	)

	const handleKeyDown = React.useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			const input = inputRef.current
			if (input) {
				if (e.key === 'Delete' || e.key === 'Backspace') {
					if (input.value === '' && value.length > 0) {
						onChange(value.slice(0, -1))
					}
				}
				if (e.key === 'Escape') {
					input.blur()
				}
			}
		},
		[onChange, value],
	)

	// Filter out already selected options
	const selectableOptions = options.filter(
		(option) => !value.some((item) => item.value === option.value),
	)

	// Manage reaching maxItems limit
	const isMaxItemsReached = maxItems !== undefined && value.length >= maxItems

	return (
		<Command
			onKeyDown={handleKeyDown}
			className={cn('rs-overflow-visible rs-bg-transparent', className)}
		>
			<div
				className={cn(
					'rs-group rs-rounded-md rs-border rs-border-input rs-px-3 rs-py-2 rs-text-sm rs-ring-offset-background rs-focus-within:ring-2 rs-focus-within:ring-ring rs-focus-within:ring-offset-2',
					disabled && 'rs-cursor-not-allowed rs-opacity-50',
					containerClassName,
				)}
			>
				<div className='rs-flex rs-flex-wrap rs-gap-1'>
					{value.map((option) => (
						<Badge
							key={option.value}
							variant='secondary'
							className={badgeClassName}
						>
							{option.label}
							<button
								className='rs-ml-1 rs-rounded-full rs-outline-none rs-ring-offset-background rs-focus:ring-2 rs-focus:ring-ring rs-focus:ring-offset-2'
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										handleUnselect(option)
									}
								}}
								onMouseDown={(e) => {
									e.preventDefault()
									e.stopPropagation()
								}}
								onClick={() => handleUnselect(option)}
								disabled={disabled}
								type='button'
								aria-label={`Remove ${option.label}`}
							>
								<X className='rs-h-3 rs-w-3 rs-text-muted-foreground rs-hover:text-foreground' />
							</button>
						</Badge>
					))}
					<CommandPrimitive.Input
						ref={inputRef}
						value={inputValue}
						onValueChange={setInputValue}
						onBlur={() => setOpen(false)}
						onFocus={() => setOpen(true)}
						placeholder={value.length === 0 ? placeholder : ''}
						className='rs-ml-2 rs-flex-1 rs-bg-transparent rs-outline-none rs-placeholder:text-muted-foreground'
						disabled={disabled || isMaxItemsReached}
					/>
				</div>
			</div>
			<div className='rs-relative rs-mt-2'>
				<CommandList>
					{open && selectableOptions.length > 0 ? (
						<div className='rs-absolute rs-top-0 rs-z-10 rs-w-full rs-rounded-md rs-border rs-bg-popover rs-text-popover-foreground rs-shadow-md rs-outline-none rs-animate-in'>
							<CommandGroup className='rs-h-full rs-overflow-auto'>
								{selectableOptions.map((option) => (
									<CommandItem
										key={option.value}
										onMouseDown={(e) => {
											e.preventDefault()
											e.stopPropagation()
										}}
										onSelect={() => {
											setInputValue('')
											if (!isMaxItemsReached) {
												onChange([...value, option])
											}
										}}
										className='rs-cursor-pointer'
										disabled={disabled || isMaxItemsReached}
									>
										{option.label}
									</CommandItem>
								))}
							</CommandGroup>
						</div>
					) : open && selectableOptions.length === 0 ? (
						<div className='rs-absolute rs-top-0 rs-z-10 rs-w-full rs-rounded-md rs-border rs-bg-popover rs-text-popover-foreground rs-shadow-md rs-outline-none rs-animate-in'>
							<CommandGroup>
								<p className='rs-py-6 rs-text-center rs-text-sm rs-text-muted-foreground'>
									{inputValue.length > 0
										? `No results for "${inputValue}"`
										: emptyMessage}
								</p>
							</CommandGroup>
						</div>
					) : null}
				</CommandList>
			</div>
		</Command>
	)
}
