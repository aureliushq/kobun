import type { Submission } from '@conform-to/dom'

/**
 * Error handling types
 */

export interface FileSystemError extends Error {
	code?: 'ENOENT' | 'EACCES' | string
	path?: string
}

export interface SubmissionValidationResult<T = Record<string, unknown>> {
	status: 'success' | 'error'
	payload?: T
	error?: Record<string, string[]>
	reply?: Record<string, unknown>
}

export type SafeFunction<TArgs extends unknown[], TReturn> = (
	...args: TArgs
) => TReturn | Promise<TReturn>

export interface OperationContext {
	operationName: string
	filePath?: string
	additionalContext?: Record<string, unknown>
}
