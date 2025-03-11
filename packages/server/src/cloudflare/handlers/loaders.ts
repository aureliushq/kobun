import { PATHS, parseAdminPathname } from '@kobun/common'
import invariant from 'tiny-invariant'
import YAML from 'yaml'
import { CloudflareR2FileStorage } from '~/cloudflare/r2'
import type { LoaderHandlerArgs } from '~/types'

export const handleLoaders = async ({ config, request }: LoaderHandlerArgs) => {
	const url = new URL(request.url)
	const { basePath, collections } = config
	const params = parseAdminPathname({
		basePath,
		collections,
		pathname: url.pathname,
	})

	if (!params) return {}

	const mode = config.storage.mode
	switch (mode) {
		case 'r2': {
			const format = config.storage.format
			const contentPrefix = config.storage.content?.prefix ?? 'content'

			if (params.section === 'root' || params.section === 'settings') {
				return {}
			}

			const r2Storage = new CloudflareR2FileStorage(
				config.storage.credentials,
			)

			if (params.section === 'collections') {
				const { collectionSlug } = params
				invariant(
					collections[collectionSlug],
					`Collection ${collectionSlug} not found in config`,
				)

				const prefix = `${contentPrefix}/${collectionSlug}`
				const files = await r2Storage.list(prefix)
				const items = await Promise.all(
					files.map(async (fileName) => {
						const content = await r2Storage.get(
							`${prefix}/${fileName}`,
						)
						if (!content) return null

						const text = await content.text()
						const parts = text.split('---')
						if (parts.length < 2) return null

						const frontmatter = parts[1]?.trim()
						if (!frontmatter) return null

						const metadata = YAML.parse(frontmatter)

						return {
							id: fileName.replace(`.${format}`, ''),
							...metadata,
						}
					}),
				)

				return {
					items: items.filter(Boolean),
				}
			}

			if (params.section === 'editor-edit') {
				const { collectionSlug, id } = params
				invariant(
					collections[collectionSlug],
					`Collection ${collectionSlug} not found in config`,
				)

				const prefix = `${contentPrefix}/${collectionSlug}`
				const content = await r2Storage.get(`${prefix}/${id}.${format}`)
				if (!content) {
					throw new Error(
						`File ${id}.${format} not found in collection ${collectionSlug}`,
					)
				}

				const text = await content.text()
				const parts = text.split('---')
				invariant(
					parts.length >= 2,
					'Invalid file format - missing frontmatter',
				)

				const frontmatter = parts[1]?.trim()
				invariant(
					frontmatter,
					'Invalid file format - empty frontmatter',
				)

				const markdown = parts.slice(2).join('---').trim()
				const metadata = YAML.parse(frontmatter)

				return {
					content: markdown,
					...metadata,
				}
			}

			return {}
		}
		default: {
			throw new Error(
				`Storage mode ${mode} is not supported in Cloudflare environment`,
			)
		}
	}
}
