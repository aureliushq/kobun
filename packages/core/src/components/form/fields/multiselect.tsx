import type {
	MultiSelectField as MultiSelectFieldType,
	SelectOption,
} from '@kobun/common'
import { useState } from 'react'

import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { MultiSelect } from '~/components/ui/multiselect'

type MultiSelectProps = Omit<MultiSelectFieldType, 'type'>

const MultiSelectField = ({
	description,
	label,
	options,
	placeholder = 'Select',
	...rest
}: MultiSelectProps) => {
	const defaultOptions = options.filter((option) =>
		rest.defaultOptions?.includes(option.value),
	)
	const [selected, setSelected] = useState<SelectOption[]>(
		defaultOptions || [],
	)

	return (
		<div className='rs-w-full rs-flex rs-flex-col rs-items-start rs-gap-2 rs-px-2'>
			<div className='rs-grid rs-gap-1.5 rs-leading-none'>
				<Label>{label}</Label>
				{description && (
					<p className='rs-text-sm rs-text-muted-foreground'>
						{description}
					</p>
				)}
			</div>
			<Input
				className='rs-hidden'
				{...rest}
				value={selected.map((option) => option.value).join(',')}
			/>
			<MultiSelect
				options={options}
				value={selected}
				onChange={setSelected}
				placeholder={placeholder}
				className='rs-w-full rs-flex-wrap'
				emptyMessage='No options available'
			/>
		</div>
	)
}

export default MultiSelectField
