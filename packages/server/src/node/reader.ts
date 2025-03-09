import {
	createZodSchema,
	type Collection,
	type Config,
	type SchemaKey,
} from '@kobun/common'
import type { AllParams, CollectionInterface, KobunReader } from '~/types'
import { readItemInLocalCollection, readItemsInLocalCollection } from './utils'

export const createReader = (
	config: Config,
): KobunReader<SchemaKey> | undefined => {
	const mode = config.storage.mode
	if (mode === 'local') {
		let reader = {}
		const format = config.storage.format

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
						format,
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
							format,
							id: where.id,
							schema,
						})
					}

					return await readItemInLocalCollection({
						collection,
						format,
						slug: where.slug,
						schema,
					})
				},
			}

			return collectionInterface
		}

		for (const key in config.collections) {
			const collection = config.collections[key] as Collection

			reader = Object.assign(reader, {
				[key]: {
					...generateInterfaceForCollection(collection),
				},
			})
		}

		return reader
	}

	// TODO: add link to documentation
	throw new Error(
		`Unsupported or incompatible storage mode: ${mode}. Make sure you're using the correct loader for the storage mode you're using.`,
	)
}
