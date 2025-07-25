import {
	APP_BASE_PATH,
	type Collection,
	type Singleton,
	type ContentFormat,
	type SingletonFormat,
} from '@kobun/common'
import {
	CollectionContentManager,
	SingletonContentManager,
} from '../shared/content-storage.js'
import { NodeFileStorage } from './storage.js'

/**
 * Node.js content manager factories
 */

const nodeStorage = new NodeFileStorage()

export function createNodeCollectionManager(
	collection: Collection,
	format: ContentFormat = 'md',
): CollectionContentManager {
	const getPath = (slug?: string) => {
		const basePath = `${process.cwd()}${APP_BASE_PATH}/content/collections/${collection.paths.content}`

		if (slug) {
			return `${basePath
				.replace('**/*', '')
				.replace('*', '')}${slug}.${format}`
		}

		return `${basePath}.${format}`
	}

	return new CollectionContentManager(
		nodeStorage,
		collection,
		format,
		getPath,
	)
}

export function createNodeSingletonManager(
	singleton: Singleton,
	format: SingletonFormat = 'json',
): SingletonContentManager {
	const getPath = () => {
		const contentPath = singleton.paths.content as string
		return `${process.cwd()}${APP_BASE_PATH}/content/singletons/${contentPath}.${format}`
	}

	return new SingletonContentManager(nodeStorage, singleton, format, getPath)
}

// Legacy compatibility functions
export async function readItemsInLocalCollection(params: {
	collection: Collection
	filters?: Record<string, string>
	format: ContentFormat
}) {
	const manager = createNodeCollectionManager(
		params.collection,
		params.format,
	)
	return manager.readItems(params.filters)
}

export async function readItemInLocalCollection(params: {
	collection: Collection
	format?: ContentFormat
	id?: string
	// biome-ignore lint/suspicious/noExplicitAny: schema structure varies by configuration
	schema: any
	slug?: string
}) {
	const manager = createNodeCollectionManager(
		params.collection,
		params.format,
	)
	return manager.readItem({
		id: params.id,
		slug: params.slug,
		schema: params.schema,
	})
}

export async function readLocalSingleton(params: {
	singleton: Singleton
	format?: SingletonFormat
	// biome-ignore lint/suspicious/noExplicitAny: schema structure varies by configuration
	schema: any
}) {
	const manager = createNodeSingletonManager(params.singleton, params.format)
	return manager.read(params.schema)
}
