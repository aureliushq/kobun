import { ChevronLeft, ChevronRight } from 'lucide-react'
import type * as React from 'react'
import { DayPicker } from 'react-day-picker'

import { buttonVariants } from '~/components/ui/button'
import { cn } from '~/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	...props
}: CalendarProps) {
	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn('rs-p-3', className)}
			classNames={{
				months: 'rs-flex rs-flex-col sm:rs-flex-row rs-space-y-4 sm:rs-space-x-4 sm:rs-space-y-0',
				month: 'rs-space-y-4',
				caption:
					'rs-flex rs-justify-center rs-pt-1 rs-relative rs-items-center',
				caption_label: 'rs-text-sm rs-font-medium',
				nav: 'rs-space-x-1 rs-flex rs-items-center',
				nav_button: cn(
					buttonVariants({ variant: 'outline' }),
					'rs-h-7 rs-w-7 rs-bg-transparent rs-p-0 rs-opacity-50 hover:rs-opacity-100',
				),
				nav_button_previous: 'rs-absolute rs-left-1',
				nav_button_next: 'rs-absolute rs-right-1',
				table: 'rs-w-full rs-border-collapse rs-space-y-1',
				head_row: 'rs-flex',
				head_cell:
					'rs-text-muted-foreground rs-rounded-md rs-w-9 rs-font-normal rs-text-[0.8rem]',
				row: 'rs-flex rs-w-full rs-mt-2',
				cell: 'rs-h-9 rs-w-9 rs-text-center rs-text-sm rs-p-0 rs-relative [&:has([aria-selected].day-range-end)]:rs-rounded-r-md [&:has([aria-selected].day-outside)]:rs-bg-accent/50 [&:has([aria-selected])]:rs-bg-accent first:[&:has([aria-selected])]:rs-rounded-l-md last:[&:has([aria-selected])]:rs-rounded-r-md focus-within:rs-relative focus-within:rs-z-20',
				day: cn(
					buttonVariants({ variant: 'ghost' }),
					'rs-h-9 rs-w-9 rs-p-0 rs-font-normal aria-selected:rs-opacity-100',
				),
				day_range_end: 'rs-day-range-end',
				day_selected:
					'rs-bg-primary rs-text-primary-foreground hover:rs-bg-primary hover:rs-text-primary-foreground focus:rs-bg-primary focus:rs-text-primary-foreground',
				day_today: 'rs-bg-accent rs-text-accent-foreground',
				day_outside:
					'rs-day-outside rs-text-muted-foreground aria-selected:rs-bg-accent/50 aria-selected:rs-text-muted-foreground',
				day_disabled: 'rs-text-muted-foreground rs-opacity-50',
				day_range_middle:
					'aria-selected:rs-bg-accent aria-selected:rs-text-accent-foreground',
				day_hidden: 'rs-invisible',
				...classNames,
			}}
			components={{
				IconLeft: ({ className, ...props }) => (
					<ChevronLeft
						className={cn('rs-h-4 rs-w-4', className)}
						{...props}
					/>
				),
				IconRight: ({ className, ...props }) => (
					<ChevronRight
						className={cn('rs-h-4 rs-w-4', className)}
						{...props}
					/>
				),
			}}
			{...props}
		/>
	)
}
Calendar.displayName = 'Calendar'

export { Calendar }
