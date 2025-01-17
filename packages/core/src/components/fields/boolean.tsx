import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { BooleanField as BooleanFieldType } from '@/fields'

type BooleanProps = BooleanFieldType & {
	config?: Partial<HTMLInputElement>
}

// TODO: controlled operation
const BooleanField = ({
	component,
	config,
	defaultChecked,
	description,
	label,
}: BooleanProps) => {
	switch (component) {
		case 'checkbox': {
			return (
				<div className='items-top flex space-x-2'>
					<Checkbox defaultChecked={defaultChecked} id={config?.id} />
					<div className='grid gap-1.5 leading-none'>
						<Label htmlFor={config?.id}>{label}</Label>
						{description && (
							<p className='text-sm text-muted-foreground'>
								{description}
							</p>
						)}
					</div>
				</div>
			)
		}
		case 'switch': {
			return (
				<div className='flex items-start justify-between gap-2'>
					<div className='grid gap-1.5 leading-none order-2 md:order-1'>
						<Label htmlFor={config?.id}>{label}</Label>
						{description && (
							<p className='text-sm text-muted-foreground'>
								{description}
							</p>
						)}
					</div>
					<Switch
						className='order-1 md:order-2'
						defaultChecked={defaultChecked}
						id={config?.id}
					/>
				</div>
			)
		}
	}
}

export default BooleanField
