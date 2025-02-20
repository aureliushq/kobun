import { RefreshCcw } from 'lucide-react'

import type { SlugField as SlugFieldType } from '~/components/form/fields'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

type Props = SlugFieldType

// TODO: controlled operation
// TODO: slug generation
// TODO: parsing and validation
const SlugField = ({ description, label, placeholder, title }: Props) => {
	return (
		<div className='rs-w-full rs-px-2 rs-flex rs-flex-col rs-items-start rs-gap-2'>
			<div className='rs-grid rs-gap-1.5 rs-leading-none'>
				<Label>{label}</Label>
				{description && (
					<p className='rs-text-sm rs-text-muted-foreground'>
						{description}
					</p>
				)}
			</div>
			<div className='rs-w-full rs-flex rs-items-center rs-gap-2'>
				<Input placeholder={placeholder} type='text' />
				<Button
					className='rs-flex-shrink-0'
					size='icon'
					variant='outline'
				>
					<RefreshCcw />
				</Button>
			</div>
		</div>
	)
}

export default SlugField
