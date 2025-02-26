import type { FieldMetadata } from '@conform-to/react'
import type { ConfigSchema, SchemaKey } from '@rescribe/common'

import InputRenderer from '~/components/form/input-renderer'

const Form = <T extends SchemaKey>({
	fields,
	isContentFieldAvailable,
	primaryInputFields,
	schema,
	secondaryInputFields,
}: {
	fields: Required<{
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		[x: string]: FieldMetadata<any, Record<string, any>, string[]>
	}>
	isContentFieldAvailable: boolean
	primaryInputFields: string[]
	schema: ConfigSchema<T>
	secondaryInputFields: string[]
}) => {
	const PrimaryInputs =
		primaryInputFields.length > 0
			? primaryInputFields.map((key) => {
					const fieldData = schema[key as T]
					const fieldMetadata = fields[key]
					return (
						<InputRenderer
							fields={fields}
							// TODO: fix this type
							// @ts-ignore
							fieldData={fieldData}
							fieldKey={key}
							fieldMetadata={fieldMetadata}
							key={key}
						/>
					)
				})
			: null

	const SecondaryInputs =
		secondaryInputFields.length > 0
			? secondaryInputFields.map((key) => {
					const fieldData = schema[key as T]
					const fieldMetadata = fields[key]
					return (
						<InputRenderer
							fields={fields}
							// TODO: fix this type
							// @ts-ignore
							fieldData={fieldData}
							fieldKey={key}
							fieldMetadata={fieldMetadata}
							key={key}
						/>
					)
				})
			: null

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
