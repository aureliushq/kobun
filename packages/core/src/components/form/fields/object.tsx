import type { FieldMetadata } from '@conform-to/react'
import type { ConfigSchema, SchemaKey } from '@kobun/common'

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '~/components/ui/accordion'
import { Label } from '~/components/ui/label'
import type { Layout } from '~/lib/types'
import InputRenderer from '~/components/form/input-renderer'

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
	const titleField = Object.keys(schema).find((key) => key === 'title')
	const titleValue = schema[titleField as T].label

	return (
		<div className='rs-w-full rs-flex rs-flex-col rs-items-start rs-gap-2'>
			{label && (
				<div className='rs-grid rs-gap-1.5 rs-leading-none'>
					<Label>{label}</Label>
					{description && (
						<p className='rs-text-sm rs-text-muted-foreground'>
							{description}
						</p>
					)}
				</div>
			)}
			<Accordion className='rs-w-full' type='single' collapsible>
				<AccordionItem
					className='rs-w-full rs-border rs-border-border rs-rounded-md'
					value={name}
				>
					<AccordionTrigger className='rs-w-full rs-h-10 rs-p-4 data-[state=open]:rs-border-b rs-border-border'>
						<div className='rs-flex rs-flex-col rs-items-start rs-gap-1'>
							<span>{titleValue}</span>
							{description && (
								<span className='rs-text-sm rs-text-muted-foreground'>
									{description}
								</span>
							)}
						</div>
					</AccordionTrigger>
					<AccordionContent className='rs-w-full rs-p-4'>
						<div className='rs-space-y-4'>
							{Object.entries(schema).map(([key, field]) => {
								console.log('titleField', titleField)
								const fieldData = schema[key as T]
								const fieldMetadata =
									// @ts-ignore
									fields[key].getFieldset()

								return (
									<InputRenderer
										key={key}
										fieldData={fieldData}
										fieldKey={key}
										fieldMetadata={fieldMetadata}
										fields={fields}
										layout={'form' as Layout}
									/>
								)
							})}
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	)
}

export default ObjectField
