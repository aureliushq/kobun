import type { UrlField as UrlFieldType } from '~/components/form/fields'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

type Props = UrlFieldType

// TODO: controlled operation
// TODO: validation
const UrlField = ({ description, label, placeholder }: Props) => {
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
			<Input placeholder={placeholder} type='url' />
		</div>
	)
}

export default UrlField
