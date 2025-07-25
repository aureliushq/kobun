import type { Config } from '../types'
import type {
	BaseApiResponse,
	SingletonResponse,
	CollectionListResponse,
	CollectionItemResponse,
	EmptyResponse,
} from './interfaces'

/**
 * Creates a standardized base response with consistent structure
 */
const createBaseResponse = (config: Config): BaseApiResponse => ({
	config,
	timestamp: new Date().toISOString(),
	success: true,
})

/**
 * Creates a standardized singleton response
 */
export const createSingletonResponse = (
	config: Config,
	item: Record<string, unknown>,
): SingletonResponse => ({
	...createBaseResponse(config),
	item,
})

/**
 * Creates a standardized collection list response
 */
export const createCollectionListResponse = (
	config: Config,
	items: Record<string, unknown>[],
	options?: {
		total?: number
		page?: number
		limit?: number
		hasNext?: boolean
		hasPrevious?: boolean
	},
): CollectionListResponse => ({
	...createBaseResponse(config),
	items,
	total: options?.total,
	pagination:
		options?.page !== undefined
			? {
					page: options.page,
					limit: options.limit || items.length,
					hasNext: options.hasNext || false,
					hasPrevious: options.hasPrevious || false,
				}
			: undefined,
})

/**
 * Creates a standardized collection item response
 */
export const createCollectionItemResponse = (
	config: Config,
	item: Record<string, unknown>,
): CollectionItemResponse => ({
	...createBaseResponse(config),
	item,
})

/**
 * Creates a standardized empty response (for settings, root pages, etc.)
 */
export const createEmptyResponse = (config: Config): EmptyResponse => ({
	...createBaseResponse(config),
})

/**
 * Creates a consistent client-safe config object (removes sensitive data)
 */
export const createClientConfig = (config: Config): Config => {
	// Remove sensitive storage credentials from client-facing config
	let storage = config.storage

	if (storage.mode === 'r2' && 'credentials' in storage) {
		const { credentials, ...storageWithoutCredentials } = storage
		storage = storageWithoutCredentials
	}

	return {
		...config,
		storage,
	}
}
