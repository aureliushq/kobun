import type { Submission } from '@conform-to/dom'
import type { Field, ConfigSchema, SchemaKey } from '../types.js'

/**
 * Form processing types
 */

export interface FormProcessingResult<T = Record<string, unknown>> {
	transformedPayload: T
	submission: Submission<T>
	content: string
	intent?: string
	metadata: Record<string, unknown>
}

export interface FormPayload {
	content?: string
	intent?: string
	[key: string]: unknown
}

export type CollectionSchema = ConfigSchema<SchemaKey>
export type FieldConfiguration = Field