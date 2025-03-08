import { createZodSchema, parseAdminPathname } from '@kobun/common'
import fg from 'fast-glob'
import invariant from 'tiny-invariant'
import {
	getLocalCollectionContentPath,
	readItemInLocalCollection,
	readItemsInLocalCollection,
} from '~/node/utils'
import type { LoaderHandlerArgs } from '~/types'

export const handleLoader = async ({ config, request }: LoaderHandlerArgs) => {
	const url = new URL(request.url)
	const { basePath, collections } = config
	const params = parseAdminPathname({
		basePath,
		collections,
		pathname: url.pathname,
		search: url.search,
	})

	if (!params) return {}

	const mode = config.storage.mode
	switch (mode) {
		case 'local': {
			const format = config.storage.format
			if (params.section === 'root') {
				// TODO: return data required for dashboard
				// recent drafts in different collections
				const everything = await Promise.all(
					Object.keys(config.collections).map(async (key) => {
						const slug = key
						invariant(
							collections[slug],
							`Collection ${slug} not found in config`,
						)
						const collection = collections[slug]
						const path = getLocalCollectionContentPath({
							collection,
							format,
						})
						const files = await fg(path, { onlyFiles: true })
						return { files }
					}),
				)

				return { everything }
			}
			if (params.section === 'settings') {
				return {}
			}
			const collectionSlug = params.collectionSlug
			invariant(
				collections[collectionSlug],
				`Collection ${collectionSlug} not found in config`,
			)
			const collection = collections[collectionSlug]
			if (params.section === 'collections') {
				const filters = params.search
				return readItemsInLocalCollection({
					collection,
					filters,
					format,
				})
			}

			if (params.section === 'editor-create') {
				return {}
			}

			const id = params.id
			const schema = createZodSchema({
				schema: collection.schema,
				options: { omit: ['content'], type: 'loader' },
			})
			if (params.section === 'editor-edit') {
				return readItemInLocalCollection({
					collection,
					format,
					id,
					schema,
				})
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
