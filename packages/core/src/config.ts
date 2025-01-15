import { collectionSlug, type Collection, type Config } from './types'

export function config(config: Config) {
	return config
}

export function collection(collection: Collection) {
	return {
		...collection,
		slug: collectionSlug.parse(collection.slug),
	} as Collection
}
