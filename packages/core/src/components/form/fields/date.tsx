import type { DateField as DateFieldType } from '@rescribe/common'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import * as React from 'react'

import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Label } from '~/components/ui/label'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '~/components/ui/popover'
import { cn } from '~/lib/utils'

type Props = DateFieldType

// TODO: controlled operation
const DateField = ({ description, label }: Props) => {
	const [date, setDate] = React.useState<Date>()

	return (
		<div className='rs-flex rs-items-center rs-justify-between rs-flex-wrap rs-gap-2'>
			<div className='rs-grid rs-gap-1.5 rs-leading-none'>
				<Label>{label}</Label>
				{description && (
					<p className='rs-text-sm rs-text-muted-foreground'>
						{description}
					</p>
				)}
			</div>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant={'outline'}
						className={cn(
							'rs-w-[280px] rs-justify-start rs-text-left rs-font-normal',
							!date && 'rs-text-muted-foreground',
						)}
					>
						<CalendarIcon />
						{date ? format(date, 'PPP') : <span>Pick a date</span>}
					</Button>
				</PopoverTrigger>
				<PopoverContent className='rs-w-auto rs-p-0'>
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
