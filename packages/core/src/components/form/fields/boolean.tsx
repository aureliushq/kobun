import type { BooleanField as BooleanFieldType } from '@kobun/common'

import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'

type BooleanProps = Omit<BooleanFieldType, 'type'> & {
	config?: Partial<HTMLInputElement>
}

// TODO: controlled operation
const BooleanField = ({
	component,
	config,
	description,
	label,
	...rest
}: BooleanProps) => {
	switch (component) {
		case 'checkbox': {
			return (
				<div className='rs-items-top rs-flex rs-space-x-2'>
					<Checkbox
						defaultChecked={config?.defaultChecked}
						id={config?.id}
						{...rest}
					/>
					<div className='rs-grid rs-gap-1.5 rs-leading-none'>
						<Label htmlFor={config?.id}>{label}</Label>
						{description && (
							<p className='rs-text-sm rs-text-muted-foreground'>
								{description}
							</p>
						)}
					</div>
				</div>
			)
		}
		case 'switch': {
			return (
				<div className='rs-flex rs-items-center rs-justify-between rs-gap-2'>
					<div className='rs-grid rs-gap-1.5 rs-leading-none rs-order-2 md:rs-order-1'>
						<Label htmlFor={config?.id}>{label}</Label>
						{description && (
							<p className='rs-text-sm rs-text-muted-foreground'>
								{description}
							</p>
						)}
					</div>
					<Switch
						className='rs-order-1 md:rs-order-2'
						defaultChecked={config?.defaultChecked}
						id={config?.id}
						{...rest}
					/>
				</div>
			)
		}
	}
}

export default BooleanField
