import type { FieldMetadata } from '@conform-to/react'
import type { ConfigSchema, Field, FieldTypes, SchemaKey } from '@kobun/common'

import InputRenderer from '~/components/form/input-renderer'
import type { Layout } from '~/lib/types'

const Form = <T extends SchemaKey>({
	fields,
	isContentFieldAvailable,
	layout = 'editor',
	primaryInputFields,
	schema,
	secondaryInputFields,
}: {
	fields: Required<{
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		[x: string]: FieldMetadata<any, Record<string, any>, string[]>
	}>
	isContentFieldAvailable: boolean
	layout?: Layout
	primaryInputFields: string[]
	schema: ConfigSchema<T>
	secondaryInputFields: string[]
}) => {
	const PrimaryInputs =
		primaryInputFields.length > 0
			? primaryInputFields.map((key) => {
					const fieldData = schema[key as T] as Field & {
						type: FieldTypes
					}
					const fieldMetadata = fields[key]
					return (
						<InputRenderer
							fields={fields}
							fieldData={fieldData}
							fieldKey={key}
							fieldMetadata={fieldMetadata}
							layout={layout}
							key={key}
						/>
					)
				})
			: null

	const SecondaryInputs =
		secondaryInputFields.length > 0
			? secondaryInputFields.map((key) => {
					const fieldData = schema[key as T] as Field & {
						type: FieldTypes
					}
					const fieldMetadata = fields[key]
					return (
						<InputRenderer
							fields={fields}
							fieldData={fieldData}
							fieldKey={key}
							fieldMetadata={fieldMetadata}
							layout={layout}
							key={key}
						/>
					)
				})
			: null

	if (layout === 'form') {
		return (
			<section className='rs-flex rs-h-full rs-w-full rs-max-w-4xl rs-mx-auto rs-flex-grow rs-flex-col rs-items-center rs-justify-start rs-px-6 rs-z-9'>
				<div className='rs-flex rs-h-full rs-w-full rs-flex-col rs-items-center rs-justify-start rs-gap-6 rs-px-4 rs-pt-12 rs-pb-24 md:rs-pb-16 lg:rs-px-0'>
					<div className='rs-w-full rs-flex rs-flex-col rs-gap-6 rs-px-2'>
						{SecondaryInputs}
					</div>
				</div>
			</section>
		)
	}

	return (
		<section className='rs-flex rs-h-full rs-w-full rs-flex-grow rs-flex-col rs-items-center rs-justify-start rs-z-9'>
			<div className='rs-flex rs-h-full rs-w-full rs-flex-col rs-items-center rs-justify-start rs-gap-6 rs-px-4 rs-pb-24 md:rs-pb-16 lg:rs-px-0'>
				<div className='rs-w-full rs-max-w-2xl rs-flex rs-flex-col rs-px-2 rs-gap-6'>
					{PrimaryInputs}
					{!isContentFieldAvailable && SecondaryInputs}
				</div>
			</div>
		</section>
	)
}

export default Form
