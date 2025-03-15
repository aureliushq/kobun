import {
	type R2Credentials,
	createZodSchema,
	parseAdminPathname,
} from '@kobun/common'
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
		case 'r2': {
			const contentPrefix = config.storage.content?.prefix ?? 'content'
			const format = config.storage.format

			if (params.section === 'root' || params.section === 'settings') {
				return { config }
			}

			const env = process?.env ?? context.cloudflare.env
			const credentials: R2Credentials = {
				accountId: env.ACCOUNT_ID as string,
				accessKeyId: env.ACCESS_KEY as string,
				bucketName: env.BUCKET_NAME as string,
				secretAccessKey: env.SECRET_ACCESS_KEY as string,
			}
			const r2Storage = new CloudflareR2FileStorage(credentials)

			const { collectionSlug } = params
			invariant(
				collections[collectionSlug],
				`Collection ${collectionSlug} not found in config`,
			)
			const collection = collections[collectionSlug]
			const prefix = `${contentPrefix}/collections/${collectionSlug}`
			if (params.section === 'collections') {
				const filters = params.search
				const collectionItems = await readItemsInR2Collection({
					filters,
					format,
					prefix,
					r2Storage,
				})

				return { config, items: collectionItems }
			}

			if (params.section === 'editor-create') {
				return { config }
			}

			const id = params.id
			const schema = createZodSchema({
				schema: collection.schema,
				options: { omit: ['content'], type: 'loader' },
			})
			if (params.section === 'editor-edit') {
				const item = await readItemInR2Collection({
					format,
					id,
					prefix,
					r2Storage,
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
}
