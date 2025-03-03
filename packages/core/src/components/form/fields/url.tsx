import type { UrlField as UrlFieldType } from '@kobun/common'

import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

type UrlProps = Omit<UrlFieldType, 'type'>

// TODO: controlled operation
// TODO: validation
const UrlField = ({ description, label, placeholder, ...rest }: UrlProps) => {
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
			<Input placeholder={placeholder} type='url' {...rest} />
		</div>
	)
}

export default UrlField
