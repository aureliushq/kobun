import { parseWithZod } from '@conform-to/zod'
import { createZodSchema, parseAdminPathname } from '@rescribe/common'
import { customAlphabet } from 'nanoid'
import invariant from 'tiny-invariant'
import YAML from 'yaml'

import type { ActionHandlerArgs } from '~/types'

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 32)

export const handleActions = async ({ config, request }: ActionHandlerArgs) => {
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
		case 'local': {
			const format = config.storage.format
			if (params.section === 'root') {
				return {}
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
				return {}
			}

			const formData = await request.formData()
			const schema = createZodSchema({
				schema: collection.schema,
			})
			if (params.section === 'editor-create') {
				const submission = parseWithZod(formData, { schema })
				const id = nanoid()
				const createdAt = new Date().toISOString()
				const updatedAt = new Date().toISOString()
				const markdown = submission.payload.content
				// biome-ignore lint/performance/noDelete: <explanation>
				delete submission.payload.intent
				// biome-ignore lint/performance/noDelete: <explanation>
				delete submission.payload.content
				const metadata = {
					id,
					...submission.payload,
					createdAt,
					updatedAt,
				}
				const frontmatter = YAML.stringify(metadata).trimEnd()
				const fileContent = markdown
					? `---\n${frontmatter}\n---\n\n${markdown}\n`
					: `---\n${frontmatter}\n---`
				console.log(fileContent)
				return {}
			}

			const id = params.id
			if (params.section === 'editor-edit') {
			}
		}
	}
}
