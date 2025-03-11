import { parseWithZod } from '@conform-to/zod'
import { PATHS, createZodSchema, parseAdminPathname } from '@kobun/common'
import { customAlphabet } from 'nanoid'
import { redirect } from 'react-router'
import invariant from 'tiny-invariant'
import YAML from 'yaml'
import { CloudflareR2FileStorage } from '~/cloudflare/r2'
import { transformMultiselectFields } from '~/lib/utils'
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
		case 'r2': {
			const format = config.storage.format
			if (
				params.section === 'root' ||
				params.section === 'settings' ||
				params.section === 'collections'
			) {
				return {}
			}

			const collectionSlug = params.collectionSlug
			invariant(
				collections[collectionSlug],
				`Collection ${collectionSlug} not found in config`,
			)
			const collection = collections[collectionSlug]

			// Initialize R2 storage
			const r2Storage = new CloudflareR2FileStorage(
				config.storage.credentials,
			)

			const formData = await request.formData()
			const schema = createZodSchema({
				schema: collection.schema,
				options: { type: 'action' },
			})

			if (params.section === 'editor-create') {
				const submission = parseWithZod(formData, { schema })
				const id = nanoid()
				const { content = '', intent, ...payload } = submission.payload
				const markdown = content as string
				const slug = payload.slug as string
				let metadata = {
					id,
					...payload,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					status: 'draft',
				}
				if (intent === 'publish') {
					metadata = Object.assign({}, metadata, {
						publishedAt: new Date().toISOString(),
						status: 'published',
					})
				}
				const frontmatter = YAML.stringify(metadata).trimEnd()
				const fileContent = markdown
					? `---\n${frontmatter}\n---\n\n${markdown}\n`
					: `---\n${frontmatter}\n---`

				// Create file and upload to R2
				const file = new File([fileContent], `${slug}.${format}`, {
					type: 'text/markdown',
				})
				await r2Storage.set(`${collectionSlug}/${slug}.${format}`, file)

				const redirectUrl = `${basePath}/${PATHS.EDITOR}/${collectionSlug}/${id}`
				return redirect(redirectUrl)
			}

			if (params.section === 'editor-edit') {
				const id = params.id

				// Read existing file from R2
				const existingFile = await r2Storage.get(
					`${collectionSlug}/${id}.${format}`,
				)
				invariant(existingFile, `File not found for id: ${id}`)

				const existingContent = await existingFile.text()
				const parts = existingContent.split('---')
				invariant(
					parts.length >= 2,
					'Invalid file format - missing frontmatter',
				)
				const existingFrontmatter = parts[1] ?? ''
				const oldMetadata = YAML.parse(existingFrontmatter.trim())

				const submission = parseWithZod(formData, { schema })
				const transformedPayload = transformMultiselectFields(
					submission.payload,
					collection.schema,
				)
				const { content = '', intent, ...payload } = transformedPayload
				const markdown = content as string
				const slug = payload.slug as string

				let metadata = {
					...oldMetadata,
					...payload,
					updatedAt: new Date().toISOString(),
					status: 'draft',
				}
				if (intent === 'publish') {
					metadata = Object.assign({}, metadata, {
						publishedAt: new Date().toISOString(),
						status: 'published',
					})
				}

				const frontmatter = YAML.stringify(metadata).trimEnd()
				const fileContent = markdown
					? `---\n${frontmatter}\n---\n\n${markdown}\n`
					: `---\n${frontmatter}\n---`

				// If slug changed, delete old file
				if (oldMetadata.slug !== slug) {
					await r2Storage.remove(
						`${collectionSlug}/${oldMetadata.slug}.${format}`,
					)
				}

				// Upload new/updated file
				const file = new File([fileContent], `${slug}.${format}`, {
					type: 'text/markdown',
				})
				await r2Storage.set(`${collectionSlug}/${slug}.${format}`, file)

				return metadata
			}
			break
		}
		default: {
			throw new Error(
				`Storage mode ${mode} is not supported in Cloudflare environment`,
			)
		}
	}
}
