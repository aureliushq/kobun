import {
	CollectionContentManager,
	SingletonContentManager,
} from '../shared/content-storage.js'
import { CloudflareContentStorage } from './storage.js'
import type { CloudflareR2FileStorage } from './r2.js'

/**
 * Cloudflare content manager factories
 */

export function createCloudflareCollectionManager(
	r2Storage: CloudflareR2FileStorage,
	prefix: string,
	format: 'md' | 'mdx' = 'md',
): CollectionContentManager {
	const storage = new CloudflareContentStorage(r2Storage)

	const getPath = (slug?: string) => {
		if (slug) {
			return `${prefix}/${slug}.${format}`
		}
		return `${prefix}/*.${format}`
	}

	// Note: Collection parameter is not available in R2 context, using minimal interface
	// biome-ignore lint/suspicious/noExplicitAny: R2 context requires minimal interface mock
	const mockCollection = {} as any

	return new CollectionContentManager(
		storage,
		mockCollection,
		format,
		getPath,
	)
}

export function createCloudflareSingletonManager(
	r2Storage: CloudflareR2FileStorage,
	prefix: string,
	slug: string,
	format = 'json',
): SingletonContentManager {
	const storage = new CloudflareContentStorage(r2Storage)

	const getPath = () => `${prefix}/${slug}.${format}`

	// Note: Singleton parameter is not available in R2 context, using minimal interface
	// biome-ignore lint/suspicious/noExplicitAny: R2 context requires minimal interface mock
	const mockSingleton = {} as any

	return new SingletonContentManager(
		storage,
		mockSingleton,
		// biome-ignore lint/suspicious/noExplicitAny: format parameter needs flexible typing for R2 compatibility
		format as any,
		getPath,
	)
}

// Legacy compatibility functions
export async function readItemsInR2Collection(params: {
	filters?: Record<string, string>
	format: 'md' | 'mdx'
	prefix: string
	r2Storage: CloudflareR2FileStorage
}) {
	const manager = createCloudflareCollectionManager(
		params.r2Storage,
		params.prefix,
		params.format,
	)
	return manager.readItems(params.filters)
}

export async function readItemInR2Collection(params: {
	format?: 'md' | 'mdx'
	id?: string
	prefix: string
	r2Storage: CloudflareR2FileStorage
	// biome-ignore lint/suspicious/noExplicitAny: schema structure varies by configuration
	schema: any
	slug?: string
}) {
	const manager = createCloudflareCollectionManager(
		params.r2Storage,
		params.prefix,
		params.format,
	)
	return manager.readItem({
		id: params.id,
		slug: params.slug,
		schema: params.schema,
	})
}

export async function readR2Singleton(params: {
	format?: string
	prefix: string
	r2Storage: CloudflareR2FileStorage
	// biome-ignore lint/suspicious/noExplicitAny: schema structure varies by configuration
	schema: any
	slug: string
}) {
	const manager = createCloudflareSingletonManager(
		params.r2Storage,
		params.prefix,
		params.slug,
		params.format,
	)
	return manager.read(params.schema)
}
