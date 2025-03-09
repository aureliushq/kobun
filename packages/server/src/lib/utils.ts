import type { FieldTypes, ConfigSchema, SchemaKey } from '@kobun/common'

// Takes a payload and the collection schema, returns a transformed payload
export const transformMultiselectFields = <T extends SchemaKey>(
	payload: { [k: string]: unknown },
	collectionSchema: ConfigSchema<T>,
) => {
	const transformed = { ...payload }

	// biome-ignore lint/complexity/noForEach: <explanation>
	Object.entries(collectionSchema).forEach(([key, field]) => {
		// @ts-ignore
		const fieldType = field.type as FieldTypes
		if (
			fieldType === 'multiselect' &&
			typeof payload[key] === 'string' &&
			payload[key]
		) {
			transformed[key] = payload[key]
				.split(',')
				.map((item) => item.trim())
		}
	})

	return transformed
}
