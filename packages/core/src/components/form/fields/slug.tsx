import type { SlugField as SlugFieldType } from '@kobun/common'
import { RefreshCcwIcon } from 'lucide-react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

type SlugProps = Omit<SlugFieldType, 'type'> & {
	config?: Partial<HTMLInputElement>
}

// TODO: controlled operation
// TODO: slug generation
// TODO: parsing and validation
const SlugField = ({
	config,
	description,
	label,
	placeholder,
	title,
	...rest
}: SlugProps) => {
	return (
		<div className='rs-w-full rs-flex rs-flex-col rs-items-start rs-gap-2'>
			<div className='rs-grid rs-gap-1.5 rs-leading-none'>
				<Label>{label}</Label>
				{description && (
					<p className='rs-text-sm rs-text-muted-foreground'>
						{description}
					</p>
				)}
			</div>
			<div className='rs-w-full rs-flex rs-items-center rs-gap-2'>
				<Input
					defaultValue={config?.defaultValue}
					placeholder={placeholder}
					type='text'
					{...rest}
				/>
				<Button
					className='rs-flex-shrink-0'
					size='icon'
					variant='outline'
				>
					<RefreshCcwIcon />
				</Button>
			</div>
		</div>
	)
}

export default SlugField
