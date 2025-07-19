import { KobunError, ValidationError, StorageError, NotFoundError, type ErrorResponse, createErrorResponse } from './types'

/**
 * Wraps a function with error handling and logging
 */
export const withErrorHandling = <T extends (...args: any[]) => any>(
	fn: T,
	context: string
): T => {
	return ((...args: any[]) => {
		try {
			const result = fn(...args)
			
			// Handle async functions
			if (result && typeof result.catch === 'function') {
				return result.catch((error: Error) => {
					handleError(error, context)
					throw error
				})
			}
			
			return result
		} catch (error) {
			handleError(error as Error, context)
			throw error
		}
	}) as T
}

/**
 * Centralized error handling and logging
 */
export const handleError = (error: Error, context: string): void => {
	const timestamp = new Date().toISOString()
	
	if (error instanceof KobunError) {
		console.error(`[${timestamp}] ${context}: ${error.name}`, {
			message: error.message,
			code: error.code,
			statusCode: error.statusCode,
			details: error.details,
			stack: error.stack,
		})
	} else {
		console.error(`[${timestamp}] ${context}: UnhandledError`, {
			message: error.message,
			stack: error.stack,
		})
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
		
		if ((error as any)?.code === 'ENOENT') {
			throw new NotFoundError(`${message}: File not found`, { 
				filePath, 
				originalError: error 
			})
		}
		
		if ((error as any)?.code === 'EACCES') {
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
export const validateSubmission = (submission: any, operationName: string) => {
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