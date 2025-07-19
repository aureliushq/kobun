import {
	type R2Credentials,
	createZodSchema,
	parseAdminPathname,
	createClientConfig,
	createEmptyResponse,
	createSingletonResponse,
	createCollectionListResponse,
	createCollectionItemResponse,
	getCloudflareEnvVar,
	getEnvVar,
	safeJsonParse,
} from '@kobun/common'
import { redirect } from 'react-router'
import invariant from 'tiny-invariant'

import { CloudflareR2FileStorage } from '~/cloudflare/r2'
import {
	readItemInR2Collection,
	readItemsInR2Collection,
} from '~/cloudflare/utils'
import type { LoaderHandlerArgs } from '~/types'

export const handleLoaders = async ({
	config,
	context,
	request,
}: LoaderHandlerArgs) => {
	const { adminAccess, basePath, collections, singletons, storage } = config
	if (adminAccess?.disabled) return redirect(adminAccess?.redirectUrl ?? '/')
	const url = new URL(request.url)
	const params = parseAdminPathname({
		basePath,
		collections,
		pathname: url.pathname,
		search: url.search,
		singletons,
	})

	if (!params) return {}

	const mode = storage.mode
	switch (mode) {
		case 'r2': {
			const contentPrefix = config.storage.content?.prefix ?? 'content'

			const credentials: R2Credentials = storage.credentials
				? storage.credentials
				: context.cloudflare.env
					? {
							accountId: context.cloudflare.env
								.ACCOUNT_ID as string,
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

			const clientConfig = Object.assign({}, config, {
				storage: {
					...storage,
					credentials: null,
				},
			})

			if (params.section === 'root' || params.section === 'settings') {
				return { config: clientConfig }
			}

			// Handle singletons
			const singletonFormat = config.storage.format.singletons
			const singletonPrefix = `${contentPrefix}/singletons`
			// TODO: when route changes loader data is not updated
			if (params.section === 'edit-singleton') {
				const singletonSlug = params.singletonSlug
				invariant(
					singletons?.[singletonSlug],
					`Singleton ${singletonSlug} not found in config`,
				)
				const singleton = singletons[singletonSlug]
				const schema = createZodSchema({
					options: { type: 'loader' },
					schema: singleton.schema,
					type: 'singleton',
				})
				const content = (await r2Storage.get(
					`${singletonPrefix}/${singletonSlug}.${singletonFormat}`,
				)) as string
				if (!content) return { config: clientConfig }
				const data = JSON.parse(content)
				const result = schema.safeParse(data)
				if (!result.success) {
					// Return partial data with empty values for invalid fields
					const partialData = { ...data } as Record<string, unknown>
					// biome-ignore lint/complexity/noForEach: <explanation>
					result.error.errors.forEach((error) => {
						const path = error.path.join('.')
						partialData[path] = ''
					})
					return { config: clientConfig, item: partialData }
				}
				return { config: clientConfig, item: result.data }
			}

			const collectionSlug = params.collectionSlug
			invariant(
				collections[collectionSlug],
				`Collection ${collectionSlug} not found in config`,
			)
			const collection = collections[collectionSlug]
			const collectionFormat = config.storage.format.collections
			const collectionPrefix = `${contentPrefix}/collections/${collectionSlug}`
			if (params.section === 'collections') {
				const filters = params.search
				const collectionItems = await readItemsInR2Collection({
					filters,
					format: collectionFormat,
					prefix: collectionPrefix,
					r2Storage,
				})

				return { config: clientConfig, items: collectionItems }
			}

			if (params.section === 'create-collection-item') {
				return { config: clientConfig }
			}

			const id = params.id
			const schema = createZodSchema({
				schema: collection.schema,
				options: { omit: ['content'], type: 'loader' },
			})
			if (params.section === 'edit-collection-item') {
				const item = await readItemInR2Collection({
					format: collectionFormat,
					id,
					prefix: collectionPrefix,
					r2Storage,
					schema,
				})
				return { config: clientConfig, item }
			}
			break
		}
		default: {
			// TODO: add link to documentation
			throw new Error(
				`Unsupported or incompatible storage mode: ${mode}. Make sure you're using the correct loader for the storage mode you're using.`,
			)
		}
	}
}
