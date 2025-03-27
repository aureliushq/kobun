import {
	createZodSchema,
	type Collection,
	type Config,
	type R2Credentials,
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
	readItemInR2Collection,
	readItemsInR2Collection,
	readR2Singleton,
} from './utils'
import { CloudflareR2FileStorage } from './r2'

export const createReader = ({
	config,
	context,
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
}: { config: Config; context: any }): KobunReader<SchemaKey> | undefined => {
	const { storage } = config
	const mode = storage.mode
	if (mode === 'r2') {
		const collections: Record<string, CollectionInterface<SchemaKey>> = {}
		const singletons: Record<string, SingletonInterface<SchemaKey>> = {}

		const collectionFormat = config.storage.format.collections
		const contentPrefix = config.storage.content?.prefix ?? 'content'
		const singletonFormat = config.storage.format.singletons

		const credentials: R2Credentials = storage.credentials
			? storage.credentials
			: context.cloudflare.env
				? {
						accountId: context.cloudflare.env.ACCOUNT_ID as string,
						accessKeyId: context.cloudflare.env
							.ACCESS_KEY as string,
						bucketName: context.cloudflare.env
							.BUCKET_NAME as string,
						secretAccessKey: context.cloudflare.env
							.SECRET_ACCESS_KEY as string,
					}
				: {
						accountId: process.env.ACCOUNT_ID as string,
						accessKeyId: process.env.ACCESS_KEY as string,
						bucketName: process.env.BUCKET_NAME as string,
						secretAccessKey: process.env
							.SECRET_ACCESS_KEY as string,
					}
		const r2Storage = new CloudflareR2FileStorage(credentials)

		const generateInterfaceForCollection = <T extends SchemaKey>(
			collection: Collection,
			collectionSlug: string,
		) => {
			const prefix = `${contentPrefix}/collections/${collectionSlug}`
			const collectionInterface: CollectionInterface<T> = {
				_label: collection.label,
				_schema: collection.schema,

				async all(params?: AllParams) {
					return await readItemsInR2Collection({
						filters: params?.filters,
						format: collectionFormat,
						prefix,
						r2Storage,
					})
				},

				async unique({ where, options = { headings: false } }) {
					const schema = createZodSchema({
						schema: collection.schema,
						options: { omit: ['content'], type: 'loader' },
					})
					if (!where.slug) {
						return await readItemInR2Collection({
							format: collectionFormat,
							id: where.id,
							prefix,
							r2Storage,
							schema,
						})
					}

					return await readItemInR2Collection({
						format: collectionFormat,
						prefix,
						r2Storage,
						slug: where.slug,
						schema,
					})
				},
			}

			return collectionInterface
		}

		const generateInterfaceForSingleton = <T extends SchemaKey>(
			singleton: Singleton,
			slug: string,
		) => {
			const prefix = `${contentPrefix}/singletons`
			const singletonInterface: SingletonInterface<T> = {
				_label: singleton.label,
				_schema: singleton.schema,

				async get() {
					const schema = createZodSchema({
						schema: singleton.schema,
						options: { omit: ['content'], type: 'loader' },
					})
					return await readR2Singleton({
						format: singletonFormat,
						prefix,
						r2Storage,
						schema,
						slug,
					})
				},
			}

			return singletonInterface
		}

		// Add collections to reader
		for (const key in config.collections) {
			const collection = config.collections[key] as Collection
			collections[key] = generateInterfaceForCollection(collection, key)
		}

		// Add singletons to reader
		if (config.singletons) {
			for (const key in config.singletons) {
				const singleton = config.singletons[key] as Singleton
				singletons[key] = generateInterfaceForSingleton(singleton, key)
			}
		}

		return {
			collections,
			singletons,
		}
	}

	// TODO: add link to documentation
	throw new Error(
		`Unsupported or incompatible storage mode: ${mode}. Make sure you're using the correct loader for the storage mode you're using.`,
	)
}
