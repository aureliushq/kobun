import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UrlField as UrlFieldType } from '@/fields'

type Props = UrlFieldType

// TODO: controlled operation
// TODO: validation
const UrlField = ({ description, label, placeholder }: Props) => {
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
			<Input placeholder={placeholder} type='url' />
		</div>
	)
}

export default UrlField
