import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SlugField as SlugFieldType } from '@/fields'
import TextField from './text'
import { Button } from '../ui/button'
import { RefreshCcw } from 'lucide-react'

type Props = SlugFieldType

// TODO: controlled operation
// TODO: slug generation
// TODO: parsing and validation
const SlugField = ({ name, slug }: Props) => {
	return (
		<>
			<TextField
				description={name.description}
				label={name.label}
				placeholder={name.placeholder}
				type='text'
			/>
			<div className='rs-w-full rs-flex rs-flex-col rs-items-start rs-gap-2'>
				<div className='rs-grid rs-gap-1.5 rs-leading-none'>
					<Label>{slug.label}</Label>
					{slug.description && (
						<p className='rs-text-sm rs-text-muted-foreground'>
							{slug.description}
						</p>
					)}
				</div>
				<div className='rs-w-full rs-flex rs-items-center rs-gap-2'>
					<Input placeholder={slug.placeholder} type='text' />
					<Button>
						<RefreshCcw />
						Regenerate
					</Button>
				</div>
			</div>
		</>
	)
}

export default SlugField
