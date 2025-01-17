import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { SelectField as SelectFieldType } from '@/fields'

type Props = SelectFieldType

// TODO: controlled operation
const SelectField = ({
	description,
	label,
	options,
	placeholder = 'Select',
}: Props) => {
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
			<Select>
				<SelectTrigger className='w-[180px]'>
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
