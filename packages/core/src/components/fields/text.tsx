import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { TextField as TextFieldType } from '@/fields'

type Props = TextFieldType

// TODO: controlled operation
const TextField = ({
	description,
	label,
	multiline = false,
	placeholder,
	type = 'text',
}: Props) => {
	if (multiline) {
		return (
			<div className='w-full flex flex-col items-start gap-2'>
				<div className='grid gap-1.5 leading-none'>
					<Label>{label}</Label>
					{description && (
						<p className='text-sm text-muted-foreground'>
							{description}
						</p>
					)}
				</div>
				<Textarea placeholder={placeholder} />
			</div>
		)
	}

	return (
		<div className='w-full flex flex-col items-start gap-2'>
			<div className='grid gap-1.5 leading-none'>
				<Label>{label}</Label>
				{description && (
					<p className='text-sm text-muted-foreground'>
						{description}
					</p>
				)}
			</div>
			<Input placeholder={placeholder} type={type} />
		</div>
	)
}

export default TextField
