import { parseWithZod } from '@conform-to/zod'
import type z from 'zod'
import type { FormProcessingResult, FormPayload, CollectionSchema, FieldConfiguration } from '../types/form-processing.js'

// Re-export for backward compatibility
export type { FormProcessingResult, FormPayload, CollectionSchema } from '../types/form-processing.js'

/**
 * Transform multiselect fields to ensure proper data structure
 * Based on existing implementation in packages/server/src/lib/utils.ts
 */
export const transformMultiselectFields = <T extends string>(
	payload: { [k: string]: unknown },
	collectionSchema: CollectionSchema
): Record<string, unknown> => {
	const transformed = { ...payload }

	Object.entries(collectionSchema).forEach(([key, field]) => {
		const fieldType = (field as FieldConfiguration)?.type
		if (
			fieldType === 'multiselect' &&
			typeof payload[key] === 'string' &&
			payload[key]
		) {
			transformed[key] = (payload[key] as string)
				.split(',')
				.map((item) => item.trim())
		}
	})

	return transformed
}

/**
 * Process form submission with validation and transformation
 */
export const processFormSubmission = async <T = FormPayload>(
	formData: FormData,
	schema: z.ZodType<T>,
	collectionSchema: CollectionSchema
): Promise<FormProcessingResult<T>> => {
	const submission = parseWithZod(formData, { schema })
	
	// Transform multiselect fields
	const transformedPayload = transformMultiselectFields(
		submission.payload,
		collectionSchema
	)

	const { content = '', intent, ...metadata } = transformedPayload

	return {
		transformedPayload: transformedPayload as T,
		submission,
		content: content as string,
		intent: intent as string | undefined,
		metadata,
	}
}

