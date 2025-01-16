import { COLLECTION_SLUG_REGEX } from './lib/constants'
import type { Collection, Config } from './types'

export function config(config: Config) {
	return config
}

export function collection(collection: Collection) {
	return {
		...collection,
		slug: COLLECTION_SLUG_REGEX.parse(collection.slug),
	} as Collection
}
