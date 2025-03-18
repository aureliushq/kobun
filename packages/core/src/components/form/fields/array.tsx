import type { FieldMetadata } from '@conform-to/react'
import type { ArrayField as ArrayFieldType } from '@kobun/common'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import InputRenderer from '../input-renderer'
import type { Layout } from '~/lib/types'
import { TrashIcon } from 'lucide-react'

type ArrayFieldProps = {
	description?: string
	fields: Required<{
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		[x: string]: FieldMetadata<any, Record<string, any>, string[]>
	}>
	label: string
	name: string
	field: ArrayFieldType['field']
	itemLabel?: ArrayFieldType['itemLabel']
}

const ArrayField = ({
	description,
	fields,
	label,
	name,
	field,
	itemLabel,
}: ArrayFieldProps) => {
	const [items, setItems] = useState<number[]>([0])

	const handleAddItem = () => {
		setItems((prev) => [...prev, prev.length])
	}

	const handleRemoveItem = (index: number) => {
		setItems((prev) => prev.filter((_, i) => i !== index))
	}

	// TODO: when there's a label, remove button is misaligned
	return (
		<div className='rs-w-full rs-flex rs-flex-col rs-items-start rs-gap-4'>
			<div className='rs-grid rs-gap-1.5 rs-leading-none'>
				<Label>{label}</Label>
				{description && (
					<p className='rs-text-sm rs-text-muted-foreground'>
						{description}
					</p>
				)}
			</div>
			<div className='rs-w-full rs-space-y-4'>
				{items.map((index) => (
					<div
						key={index}
						className='rs-flex rs-items-start rs-gap-2 rs-w-full'
					>
						<div className='rs-flex-1'>
							<InputRenderer
								fieldData={field}
								fieldKey={`${name}.${index}`}
								fieldMetadata={
									fields[`${name}.${index}`] || fields[name]
								}
								fields={fields}
								layout={'form' as Layout}
							/>
						</div>
						{items.length > 1 && (
							<Button
								onClick={() => handleRemoveItem(index)}
								size='icon'
								variant='destructive'
							>
								<TrashIcon />
							</Button>
						)}
					</div>
				))}
			</div>
			<Button onClick={handleAddItem} variant='outline'>
				Add One More
			</Button>
		</div>
	)
}

export default ArrayField

