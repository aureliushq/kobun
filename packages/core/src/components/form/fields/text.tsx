import type { TextField as TextFieldType } from '~/components/form/fields'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'

type Props = TextFieldType

// TODO: controlled operation
const TextField = ({
	description,
	label,
	multiline = false,
	placeholder,
	type = 'text',
	...rest
}: Props) => {
	if (multiline) {
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
				<Textarea placeholder={placeholder} {...rest} />
			</div>
		)
	}

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
			<Input placeholder={placeholder} type={type} {...rest} />
		</div>
	)
}

export default TextField
