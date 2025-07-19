import type z from 'zod'
import { ValidationError } from '../errors/types'
import type { ValidationResult, ProcessedContent } from './interfaces'

/**
 * Safely validates data against a Zod schema with detailed error reporting
 */
export const validateWithSchema = <T>(
	data: unknown,
	schema: z.ZodType<T>,
	context?: string
): ValidationResult<T> => {
	const result = schema.safeParse(data)
	
	if (result.success) {
		return {
			success: true,
			data: result.data,
		}
	}
	
	const errors = result.error.errors.map(error => ({
		field: error.path.join('.'),
		message: error.message,
		code: error.code,
	}))
	
	return {
		success: false,
		errors,
	}
}

/**
 * Validates data and throws ValidationError if invalid
 */
export const validateOrThrow = <T>(
	data: unknown,
	schema: z.ZodType<T>,
	context: string
): T => {
	const validation = validateWithSchema(data, schema, context)
	
	if (!validation.success) {
		throw new ValidationError(
			`Validation failed for ${context}`,
			{ 
				errors: validation.errors,
				context 
			}
		)
	}
	
	return validation.data!
}

/**
 * Validates processed content (frontmatter + content) with proper error handling
 */
export const validateProcessedContent = <T>(
	content: string,
	metadata: unknown,
	schema: z.ZodType<T>,
	context: string
): ProcessedContent<T> => {
	const validatedMetadata = validateOrThrow(metadata, schema, context)
	
	return {
		content,
		metadata: validatedMetadata,
	}
}

/**
 * Creates a type-safe validator function for a specific schema
 */
export const createValidator = <T>(schema: z.ZodType<T>, context: string) => {
	return (data: unknown): ValidationResult<T> => {
		return validateWithSchema(data, schema, context)
	}
}

/**
 * Creates a type-safe validator function that throws on error
 */
export const createStrictValidator = <T>(schema: z.ZodType<T>, context: string) => {
	return (data: unknown): T => {
		return validateOrThrow(data, schema, context)
	}
}

/**
 * Validation middleware for form submissions with consistent error handling
 */
export const validateFormSubmission = <T>(
	submission: any,
	schema: z.ZodType<T>,
	operationName: string
): T => {
	if (submission.status !== 'success') {
		throw new ValidationError(
			`Form validation failed for ${operationName}`,
			{ 
				submission: submission.error || submission.reply,
				status: submission.status,
				operation: operationName
			}
		)
	}
	
	return validateOrThrow(submission.payload, schema, operationName)
}