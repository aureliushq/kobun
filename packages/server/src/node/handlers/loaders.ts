import { createZodSchema, parseAdminPathname } from '@kobun/common'
import { redirect } from 'react-router'
import invariant from 'tiny-invariant'

import {
	readItemInLocalCollection,
	readItemsInLocalCollection,
	readLocalSingleton,
} from '~/node/utils'
import type { LoaderHandlerArgs } from '~/types'

export const handleLoaders = async ({ config, request }: LoaderHandlerArgs) => {
	const { adminAccess, basePath, collections, singletons } = config
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

	const mode = config.storage.mode
	switch (mode) {
		case 'local': {
			if (params.section === 'root' || params.section === 'settings') {
				return { config }
			}

			// Handle singletons
			const singletonFormat = config.storage.format.singletons
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
				const singletonData = await readLocalSingleton({
					format: singletonFormat,
					schema,
					singleton,
				})
				return { config, item: singletonData }
			}

			// Handle collections
			const collectionSlug = params.collectionSlug
			invariant(
				collections[collectionSlug],
				`Collection ${collectionSlug} not found in config`,
			)
			const collection = collections[collectionSlug]
			const collectionFormat = config.storage.format.collections
			if (params.section === 'collections') {
				const filters = params.search
				const collectionItems = await readItemsInLocalCollection({
					collection,
					filters,
					format: collectionFormat,
				})
				return { config, items: collectionItems }
			}

			if (params.section === 'create-collection-item') {
				return { config }
			}

			const id = params.id
			const schema = createZodSchema({
				schema: collection.schema,
				options: { omit: ['content'], type: 'loader' },
			})
			if (params.section === 'edit-collection-item') {
				const item = readItemInLocalCollection({
					collection,
					format: collectionFormat,
					id,
					schema,
				})
				return { config, item }
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

	return {}
}
