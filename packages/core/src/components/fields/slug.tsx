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
			<div className='w-full flex flex-col items-start gap-2'>
				<div className='grid gap-1.5 leading-none'>
					<Label>{slug.label}</Label>
					{slug.description && (
						<p className='text-sm text-muted-foreground'>
							{slug.description}
						</p>
					)}
				</div>
				<div className='w-full flex items-center gap-2'>
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
