// import { z } from 'zod'
import type { Features } from './types'

export const BASE_PATH = '/'
export const APP_BASE_PATH = '/app'
export const PUBLIC_BASE_PATH = '/public'

export const PATHS = {
	BASE: BASE_PATH,
	COLLECTIONS: 'collections',
	EDITOR: 'editor/collections',
	SETTINGS: 'settings',
	SINGLETONS: 'editor/singletons',
}

/**
 * Content storage paths for organizing files
 */
export const CONTENT_PATHS = {
	ROOT: 'content',
	COLLECTIONS: 'content/collections',
	SINGLETONS: 'content/singletons',
} as const

/**
 * Storage prefixes for different environments
 */
export const STORAGE_PREFIXES = {
	CONTENT: 'content',
	COLLECTIONS: 'collections',
	SINGLETONS: 'singletons',
} as const

/**
 * File extensions for different content types
 */
export const FILE_EXTENSIONS = {
	MARKDOWN: 'md',
	MDX: 'mdx',
	JSON: 'json',
} as const

/**
 * Environment variable names for configuration
 */
export const ENV_VARS = {
	ACCOUNT_ID: 'ACCOUNT_ID',
	ACCESS_KEY: 'ACCESS_KEY',
	BUCKET_NAME: 'BUCKET_NAME',
	SECRET_ACCESS_KEY: 'SECRET_ACCESS_KEY',
} as const

/**
 * HTTP status codes used throughout the application
 */
export const HTTP_STATUS = {
	OK: 200,
	CREATED: 201,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	INTERNAL_SERVER_ERROR: 500,
} as const

// export const COLLECTION_SLUG_REGEX = z
// 	.string()
// 	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const DEFAULT_FEATURES: Features = {
	featured: { limit: 3 },
	publish: true,
	timestamps: { createdAt: true, updatedAt: true },
}
