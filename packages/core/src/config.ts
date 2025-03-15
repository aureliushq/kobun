import type {
	// COLLECTION_SLUG_REGEX,
	Collection,
	Config,
	Singleton,
} from '@kobun/common'

export function config(config: Config) {
	return config
}

export function collection(collection: Collection) {
	return {
		...collection,
		// slug: COLLECTION_SLUG_REGEX.parse(collection.slug),
	} as Collection
}

export function singleton(singleton: Singleton) {
	return {
		...singleton,
	} as Singleton
}
