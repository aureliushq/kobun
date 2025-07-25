/**
 * Type guard utilities for safe type checking and assertions
 */

/**
 * Checks if a value is a non-empty string
 */
export const isNonEmptyString = (value: unknown): value is string => {
	return typeof value === 'string' && value.length > 0
}

/**
 * Safely gets an environment variable with validation
 */
export const getEnvVar = (name: string, fallback?: string): string => {
	const value = process.env[name] || fallback

	if (!isNonEmptyString(value)) {
		throw new Error(
			`Required environment variable ${name} is not set or is empty`,
		)
	}

	return value
}

/**
 * Safely gets an environment variable from Cloudflare env object
 */
export const getCloudflareEnvVar = (
	env: Record<string, unknown> | undefined,
	name: string,
	fallback?: string,
): string => {
	const value = env?.[name] || fallback

	if (!isNonEmptyString(value)) {
		throw new Error(
			`Required Cloudflare environment variable ${name} is not set or is empty`,
		)
	}

	return value
}

/**
 * Type guard for checking if a value is a valid JSON string
 */
export const isValidJsonString = (value: unknown): value is string => {
	if (!isNonEmptyString(value)) return false

	try {
		JSON.parse(value)
		return true
	} catch {
		return false
	}
}

/**
 * Safely parses JSON with type checking
 */
export const safeJsonParse = <T = unknown>(value: unknown): T | null => {
	if (!isValidJsonString(value)) return null

	try {
		return JSON.parse(value) as T
	} catch {
		return null
	}
}

/**
 * Type guard to check if a value has a slug property
 */
export const hasSlugProperty = (value: unknown): value is { slug: string } => {
	return (
		typeof value === 'object' &&
		value !== null &&
		'slug' in value &&
		// biome-ignore lint/suspicious/noExplicitAny: type guard requires checking unknown object properties
		isNonEmptyString((value as any).slug)
	)
}

/**
 * Safely extracts slug from payload
 */
export const extractSlug = (payload: Record<string, unknown>): string => {
	if (!hasSlugProperty(payload)) {
		throw new Error('Payload missing required slug property')
	}

	return payload.slug
}

/**
 * Type guard for checking if a value is a string array path
 */
export const isStringArray = (value: unknown): value is string[] => {
	return (
		Array.isArray(value) && value.every((item) => typeof item === 'string')
	)
}

/**
 * Safely gets the last element from a path string
 */
export const getLastPathSegment = (path: string): string => {
	const segments = path.split('/')
	const lastSegment = segments[segments.length - 1]

	if (!isNonEmptyString(lastSegment)) {
		throw new Error(`Invalid path: ${path}`)
	}

	return lastSegment
}

/**
 * Type guard for content path validation
 */
export const isValidContentPath = (value: unknown): value is string => {
	return isNonEmptyString(value) && !value.includes('..')
}
