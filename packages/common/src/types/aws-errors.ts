/**
 * AWS SDK error types for better type safety
 */

export interface AWSError extends Error {
	name: 'NotFound' | 'NoSuchKey' | 'AccessDenied' | string
	code?: string
	statusCode?: number
	region?: string
	hostname?: string
	retryable?: boolean
}
