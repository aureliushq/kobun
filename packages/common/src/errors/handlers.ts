import { KobunError, ValidationError, StorageError, NotFoundError, type ErrorResponse, createErrorResponse } from './types'
import type { FileSystemError, SubmissionValidationResult, SafeFunction } from '../types/error-handling.js'
import { logger } from '../utils/logger.js'

/**
 * Wraps a function with error handling and logging
 */
export const withErrorHandling = <TArgs extends unknown[], TReturn>(
	fn: SafeFunction<TArgs, TReturn>,
	context: string
): SafeFunction<TArgs, TReturn> => {
	return ((...args: TArgs) => {
		try {
			const result = fn(...args)
			
			// Handle async functions
			if (result && typeof (result as any)?.catch === 'function') {
				return (result as Promise<TReturn>).catch((error: Error) => {
					handleError(error, context)
					throw error
				})
			}
			
			return result
		} catch (error) {
			handleError(error as Error, context)
			throw error
		}
	}) as SafeFunction<TArgs, TReturn>
}

/**
 * Centralized error handling and logging
 */
export const handleError = (error: Error, context: string): void => {
	if (error instanceof KobunError) {
		logger.error(`${context}: ${error.name}`, {
			code: error.code,
			statusCode: error.statusCode,
			details: error.details,
			operation: context
		}, error)
	} else {
		logger.error(`${context}: UnhandledError`, {
			operation: context
		}, error)
	}
}

/**
 * Safely handles file operations with proper error wrapping
 */
export const safeFileOperation = async <T>(
	operation: () => Promise<T>,
	operationName: string,
	filePath?: string
): Promise<T> => {
	try {
		return await operation()
	} catch (error) {
		const message = `Failed to ${operationName}${filePath ? ` for ${filePath}` : ''}`
		
		if ((error as FileSystemError)?.code === 'ENOENT') {
			throw new NotFoundError(`${message}: File not found`, { 
				filePath, 
				originalError: error 
			})
		}
		
		if ((error as FileSystemError)?.code === 'EACCES') {
			throw new StorageError(`${message}: Permission denied`, { 
				filePath, 
				originalError: error 
			})
		}
		
		throw new StorageError(message, { 
			filePath, 
			originalError: error 
		})
	}
}

/**
 * Validates form submission and returns proper error response
 */
export const validateSubmission = <T = Record<string, unknown>>(
	submission: SubmissionValidationResult<T>, 
	operationName: string
): SubmissionValidationResult<T> => {
	if (submission.status !== 'success') {
		throw new ValidationError(
			`Form validation failed for ${operationName}`,
			{ 
				submission: submission.error || submission.reply,
				status: submission.status 
			}
		)
	}
	
	return submission
}

/**
 * Safely executes an operation and returns error response if it fails
 */
export const safeExecute = async <T>(
	operation: () => Promise<T>,
	context: string
): Promise<T | ErrorResponse> => {
	try {
		return await operation()
	} catch (error) {
		handleError(error as Error, context)
		
		if (error instanceof KobunError) {
			return createErrorResponse(error)
		}
		
		// Convert unknown errors to KobunError
		const kobunError = new KobunError(
			(error as Error).message || 'An unknown error occurred',
			'UNKNOWN_ERROR',
			500,
			{ originalError: error }
		)
		
		return createErrorResponse(kobunError)
	}
}