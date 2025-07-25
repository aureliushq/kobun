/**
 * Base error class for all Kobun-related errors
 */
export class KobunError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly statusCode: number = 500,
		// biome-ignore lint/suspicious/noExplicitAny: error details can contain any type of debugging information
		public readonly details?: Record<string, any>,
	) {
		super(message)
		this.name = 'KobunError'

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, KobunError)
		}
	}
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends KobunError {
	// biome-ignore lint/suspicious/noExplicitAny: error details can contain any type of debugging information
	constructor(message: string, details?: Record<string, any>) {
		super(message, 'VALIDATION_ERROR', 400, details)
		this.name = 'ValidationError'
	}
}

/**
 * Error thrown when storage operations fail
 */
export class StorageError extends KobunError {
	// biome-ignore lint/suspicious/noExplicitAny: error details can contain any type of debugging information
	constructor(message: string, details?: Record<string, any>) {
		super(message, 'STORAGE_ERROR', 500, details)
		this.name = 'StorageError'
	}
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends KobunError {
	// biome-ignore lint/suspicious/noExplicitAny: error details can contain any type of debugging information
	constructor(message: string, details?: Record<string, any>) {
		super(message, 'CONFIGURATION_ERROR', 500, details)
		this.name = 'ConfigurationError'
	}
}

/**
 * Error thrown when authorization fails
 */
export class AuthorizationError extends KobunError {
	// biome-ignore lint/suspicious/noExplicitAny: error details can contain any type of debugging information
	constructor(message: string, details?: Record<string, any>) {
		super(message, 'AUTHORIZATION_ERROR', 403, details)
		this.name = 'AuthorizationError'
	}
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends KobunError {
	// biome-ignore lint/suspicious/noExplicitAny: error details can contain any type of debugging information
	constructor(message: string, details?: Record<string, any>) {
		super(message, 'NOT_FOUND_ERROR', 404, details)
		this.name = 'NotFoundError'
	}
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
	error: {
		message: string
		code: string
		statusCode: number
		// biome-ignore lint/suspicious/noExplicitAny: error details can contain any type of debugging information
		details?: Record<string, any>
	}
	timestamp: string
}

/**
 * Creates a standardized error response
 */
export const createErrorResponse = (error: KobunError): ErrorResponse => {
	return {
		error: {
			message: error.message,
			code: error.code,
			statusCode: error.statusCode,
			details: error.details,
		},
		timestamp: new Date().toISOString(),
	}
}
