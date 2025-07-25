import type { Config } from '../types'

/**
 * Standard base response structure for all API operations
 */
export interface BaseApiResponse {
	config: Config
	timestamp?: string
	success: boolean
}

/**
 * Response for singleton operations
 */
export interface SingletonResponse extends BaseApiResponse {
	item: Record<string, unknown>
}

/**
 * Response for collection list operations
 */
export interface CollectionListResponse extends BaseApiResponse {
	items: Record<string, unknown>[]
	total?: number
	pagination?: {
		page: number
		limit: number
		hasNext: boolean
		hasPrevious: boolean
	}
}

/**
 * Response for single collection item operations
 */
export interface CollectionItemResponse extends BaseApiResponse {
	item: Record<string, unknown>
}

/**
 * Response for empty operations (like settings pages)
 */
export interface EmptyResponse extends BaseApiResponse {
	// Only includes base config and metadata
}

/**
 * Union type for all possible API responses
 */
export type ApiResponse =
	| SingletonResponse
	| CollectionListResponse
	| CollectionItemResponse
	| EmptyResponse

/**
 * Validation result interface for consistent error handling
 */
export interface ValidationResult<T = unknown> {
	success: boolean
	data?: T
	errors?: Array<{
		field: string
		message: string
		code: string
	}>
}

/**
 * Metadata for collection items with proper typing
 */
export interface CollectionItemMetadata {
	id: string
	slug: string
	title?: string
	status: 'draft' | 'published'
	createdAt: string
	updatedAt: string
	publishedAt?: string
	[key: string]: unknown
}

/**
 * Metadata for singletons with proper typing
 */
export interface SingletonMetadata {
	updatedAt: string
	[key: string]: unknown
}

/**
 * File processing result with content and metadata
 */
export interface ProcessedContent<T = Record<string, unknown>> {
	content: string
	metadata: T
}

/**
 * Storage operation result
 */
export interface StorageResult<T = unknown> {
	success: boolean
	data?: T
	error?: string
}
