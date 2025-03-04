import type { TextField as TextFieldType } from '@kobun/common'

import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'

type TextProps = Omit<TextFieldType, 'type'> & {
	config?: Partial<HTMLInputElement>
}

const TextField = ({
	config,
	description,
	htmlType = 'text',
	label,
	multiline = false,
	placeholder,
	...rest
}: TextProps) => {
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
				<Textarea
					defaultValue={config?.defaultValue}
					placeholder={placeholder}
					{...rest}
				/>
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
			<Input
				defaultValue={config?.defaultValue}
				placeholder={placeholder}
				type={htmlType}
				{...rest}
			/>
		</div>
	)
}

export default TextField
