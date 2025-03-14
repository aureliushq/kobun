import { parseWithZod } from '@conform-to/zod'
import { PATHS, createZodSchema, parseAdminPathname } from '@kobun/common'
import { customAlphabet } from 'nanoid'
import { redirect } from 'react-router'
import invariant from 'tiny-invariant'
import YAML from 'yaml'

import { transformMultiselectFields } from '~/lib/utils'
import {
	readItemInLocalCollection,
	writeItemToLocalCollection,
} from '~/node/utils'
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

			const formData = await request.formData()
			const schema = createZodSchema({
				schema: collection.schema,
				options: { type: 'action' },
			})
			if (params.section === 'editor-create') {
				// TODO: check if parseWithZod is successful and only then create the file
				const submission = parseWithZod(formData, { schema })
				// manually transform multiselect fields since parseWithZod is not doing it correctly
				const transformedPayload = transformMultiselectFields(
					submission.payload,
					collection.schema,
				)
				const { content = '', intent, ...payload } = transformedPayload
				const id = nanoid()
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
				await writeItemToLocalCollection({
					collection,
					format,
					fileContent,
					slug,
				})
				const redirectUrl = `${basePath}/${PATHS.EDITOR}/${collectionSlug}/${id}`
				return redirect(redirectUrl)
			}

			const id = params.id
			if (params.section === 'editor-edit') {
				const data = await readItemInLocalCollection({
					collection,
					format,
					id,
					schema: createZodSchema({
						schema: collection.schema,
						options: { omit: ['content'], type: 'loader' },
					}),
				})
				const { content: oldContent = '', ...oldMetadata } = data

				const submission = parseWithZod(formData, { schema })
				// manually transform multiselect fields since parseWithZod is not doing it correctly
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
				await writeItemToLocalCollection({
					collection,
					format,
					fileContent,
					oldSlug:
						oldMetadata.slug !== payload.slug
							? oldMetadata.slug
							: '',
					slug,
				})
				return await readItemInLocalCollection({
					collection,
					format,
					id,
					schema: createZodSchema({
						schema: collection.schema,
						options: { omit: ['content'], type: 'loader' },
					}),
				})
			}
			break
		}
		default: {
			// TODO: add link to documentation
			throw new Error(
				`Unsupported or incompatible storage mode: ${mode}. Make sure you're using the correct action for the storage mode you're using.`,
			)
		}
	}
}
