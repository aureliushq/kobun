import { parseWithZod } from '@conform-to/zod'
import type z from 'zod'

export interface FormProcessingResult {
	transformedPayload: Record<string, any>
	submission: any
	content: string
	intent?: string
	metadata: Record<string, any>
}

/**
 * Transform multiselect fields to ensure proper data structure
 * Based on existing implementation in packages/server/src/lib/utils.ts
 */
export const transformMultiselectFields = <T extends string>(
	payload: { [k: string]: unknown },
	collectionSchema: Record<string, any>
): Record<string, unknown> => {
	const transformed = { ...payload }

	Object.entries(collectionSchema).forEach(([key, field]) => {
		const fieldType = (field as any)?.type
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
export const processFormSubmission = async (
	formData: FormData,
	schema: z.ZodType,
	collectionSchema: Record<string, any>
): Promise<FormProcessingResult> => {
	const submission = parseWithZod(formData, { schema })
	
	// Transform multiselect fields
	const transformedPayload = transformMultiselectFields(
		submission.payload,
		collectionSchema
	)

	const { content = '', intent, ...metadata } = transformedPayload

	return {
		transformedPayload,
		submission,
		content: content as string,
		intent: intent as string | undefined,
		metadata,
	}
}

