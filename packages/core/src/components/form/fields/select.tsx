import type { SelectField as SelectFieldType } from '@kobun/common'
import { useState } from 'react'

import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select'

type SelectProps = Omit<SelectFieldType, 'type'>

// TODO: controlled operation
const SelectField = ({
	description,
	label,
	options,
	placeholder = 'Select',
	...rest
}: SelectProps) => {
	const defaultOption = options.find(
		(option) => option.value === rest.defaultOption,
	)
	const [selected, setSelected] = useState<string>(defaultOption?.value ?? '')

	return (
		<div className='rs-flex rs-items-center rs-justify-between rs-flex-wrap rs-gap-2 rs-px-2'>
			<div className='rs-grid rs-gap-1.5 rs-leading-none'>
				<Label>{label}</Label>
				{description && (
					<p className='rs-text-sm rs-text-muted-foreground'>
						{description}
					</p>
				)}
			</div>
			<Input className='rs-hidden' {...rest} value={selected} />
			<Select onValueChange={setSelected} value={selected}>
				<SelectTrigger className='rs-w-[180px]'>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					{options.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}

export default SelectField
