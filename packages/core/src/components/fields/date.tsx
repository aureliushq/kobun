import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover'
import type { DateField as DateFieldType } from '@/fields'
import { cn } from '@/lib/utils'

type Props = DateFieldType

// TODO: controlled operation
const DateField = ({ description, label }: Props) => {
	const [date, setDate] = React.useState<Date>()

	return (
		<div className='flex items-center justify-between flex-wrap gap-2'>
			<div className='grid gap-1.5 leading-none'>
				<Label>{label}</Label>
				{description && (
					<p className='text-sm text-muted-foreground'>
						{description}
					</p>
				)}
			</div>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant={'outline'}
						className={cn(
							'w-[280px] justify-start text-left font-normal',
							!date && 'text-muted-foreground',
						)}
					>
						<CalendarIcon />
						{date ? format(date, 'PPP') : <span>Pick a date</span>}
					</Button>
				</PopoverTrigger>
				<PopoverContent className='w-auto p-0'>
					<Calendar
						mode='single'
						selected={date}
						onSelect={setDate}
						initialFocus
					/>
				</PopoverContent>
			</Popover>
		</div>
	)
}

export default DateField
