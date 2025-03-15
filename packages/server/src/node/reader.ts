import {
	createZodSchema,
	type Collection,
	type Config,
	type SchemaKey,
	type Singleton,
} from '@kobun/common'
import type {
	AllParams,
	CollectionInterface,
	KobunReader,
	SingletonInterface,
} from '~/types'
import {
	readItemInLocalCollection,
	readItemsInLocalCollection,
	readLocalSingleton,
} from './utils'

export const createReader = (
	config: Config,
): KobunReader<SchemaKey> | undefined => {
	const mode = config.storage.mode
	if (mode === 'local') {
		let reader = {}
		const collectionFormat = config.storage.format.collections
		const singletonFormat = config.storage.format.singletons

		const generateInterfaceForCollection = <T extends SchemaKey>(
			collection: Collection,
		) => {
			const collectionInterface: CollectionInterface<T> = {
				_label: collection.label,
				_schema: collection.schema,

				async all({ filters }: AllParams) {
					return await readItemsInLocalCollection({
						collection,
						filters,
						format: collectionFormat,
					})
				},

				async unique({ where, options = { headings: false } }) {
					const schema = createZodSchema({
						schema: collection.schema,
						options: { omit: ['content'], type: 'loader' },
					})
					if (!where.slug) {
						return await readItemInLocalCollection({
							collection,
							format: collectionFormat,
							id: where.id,
							schema,
						})
					}

					return await readItemInLocalCollection({
						collection,
						format: collectionFormat,
						slug: where.slug,
						schema,
					})
				},
			}

			return collectionInterface
		}

		const generateInterfaceForSingleton = <T extends SchemaKey>(
			singleton: Singleton,
		) => {
			const singletonInterface: SingletonInterface<T> = {
				_label: singleton.label,
				_schema: singleton.schema,

				async get() {
					const schema = createZodSchema({
						schema: singleton.schema,
						options: { omit: ['content'], type: 'loader' },
					})
					return await readLocalSingleton({
						singleton,
						format: singletonFormat,
						schema,
					})
				},
			}

			return singletonInterface
		}

		// Add collections to reader
		for (const key in config.collections) {
			const collection = config.collections[key] as Collection
			reader = Object.assign(reader, {
				[key]: {
					...generateInterfaceForCollection(collection),
				},
			})
		}

		// Add singletons to reader
		if (config.singletons) {
			for (const key in config.singletons) {
				const singleton = config.singletons[key] as Singleton
				reader = Object.assign(reader, {
					[key]: {
						...generateInterfaceForSingleton(singleton),
					},
				})
			}
		}

		return reader
	}

	// TODO: add link to documentation
	throw new Error(
		`Unsupported or incompatible storage mode: ${mode}. Make sure you're using the correct loader for the storage mode you're using.`,
	)
}
