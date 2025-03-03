import type { SelectField as SelectFieldType } from '@kobun/common'
import { useState } from 'react'

import { Label } from '~/components/ui/label'
import { MultiSelect, type SelectOption } from '~/components/ui/multiselect'

type SelectProps = Omit<SelectFieldType, 'type'>

// TODO: controlled operation
const MultiSelectField = ({
	description,
	label,
	options,
	placeholder = 'Select',
}: SelectProps) => {
	const [selected, setSelected] = useState<SelectOption[]>([])

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
			<MultiSelect
				options={options}
				value={selected}
				onChange={setSelected}
				placeholder={placeholder}
				className='rs-w-auto rs-max-w-[180px] rs-flex-wrap'
				emptyMessage='No options available'
			/>
		</div>
	)
}

export default MultiSelectField
