import type { FieldMetadata } from '@conform-to/react'
import type { ConfigSchema, SchemaKey } from '@kobun/common'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '~/components/ui/accordion'
import InputRenderer from '../input-renderer'
import type { Layout } from '~/lib/types'
import { Label } from '~/components/ui/label'

type ObjectFieldProps<T extends SchemaKey> = {
	description?: string
	fields: Required<{
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		[x: string]: FieldMetadata<any, Record<string, any>, string[]>
	}>
	label: string
	name: string
	schema: ConfigSchema<T>
}

const ObjectField = <T extends SchemaKey>({
	description,
	fields,
	label,
	name,
	schema,
}: ObjectFieldProps<T>) => {
	// Find the title field if it exists

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
			<Accordion type='single' collapsible>
				{Object.entries(schema).map(([key, field]) => {
					const titleField = Object.keys(schema).find(
						([key]) => key === 'title',
					)
					console.log('titleField', titleField)
					const fieldData = schema[key as T]
					// @ts-ignore
					const fieldMetadata = fields[key].getFieldset()
					const titleValue = titleField
						? schema[titleField as T].label
						: label

					return (
						<AccordionItem key={key} value={name}>
							<AccordionTrigger>
								<div className='rs-flex rs-flex-col rs-items-start rs-gap-1'>
									<span>{titleValue}</span>
									{description && (
										<span className='rs-text-sm rs-text-muted-foreground'>
											{description}
										</span>
									)}
								</div>
							</AccordionTrigger>
							<AccordionContent>
								<div className='rs-space-y-4'>
									<InputRenderer
										key={key}
										fieldData={fieldData}
										fieldKey={key}
										fieldMetadata={fieldMetadata}
										fields={fields}
										layout={'form' as Layout}
									/>
								</div>
							</AccordionContent>
						</AccordionItem>
					)
				})}
			</Accordion>
		</div>
	)
}

export default ObjectField
