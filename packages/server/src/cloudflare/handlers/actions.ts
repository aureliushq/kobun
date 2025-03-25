import { parseWithZod } from '@conform-to/zod'
import {
	PATHS,
	type R2Credentials,
	createZodSchema,
	parseAdminPathname,
} from '@kobun/common'
import { customAlphabet } from 'nanoid'
import { redirect } from 'react-router'
import invariant from 'tiny-invariant'
import YAML from 'yaml'

import { CloudflareR2FileStorage } from '~/cloudflare/r2'
import { readItemInR2Collection } from '~/cloudflare/utils'
import { transformMultiselectFields } from '~/lib/utils'
import type { ActionHandlerArgs } from '~/types'

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 32)

export const handleActions = async ({
	config,
	context,
	request,
}: ActionHandlerArgs) => {
	const { adminAccess, basePath, collections, singletons } = config
	if (adminAccess?.disabled) return redirect(adminAccess?.redirectUrl ?? '/')
	const url = new URL(request.url)
	const params = parseAdminPathname({
		basePath,
		collections,
		pathname: url.pathname,
		singletons,
	})

	if (!params) return {}

	const mode = config.storage.mode
	switch (mode) {
		case 'r2': {
			const contentPrefix = config.storage.content?.prefix ?? 'content'

			if (
				params.section === 'root' ||
				params.section === 'settings' ||
				params.section === 'collections'
			) {
				return {}
			}

			const env = process?.env ?? context.cloudflare.env
			const credentials: R2Credentials = {
				accountId: env.ACCOUNT_ID as string,
				accessKeyId: env.ACCESS_KEY as string,
				bucketName: env.BUCKET_NAME as string,
				secretAccessKey: env.SECRET_ACCESS_KEY as string,
			}
			const r2Storage = new CloudflareR2FileStorage(credentials)

			// Handle singletons
			const singletonFormat = config.storage.format.singletons
			const singletonsPrefix = `${contentPrefix}/singletons`
			if (params.section === 'edit-singleton') {
				const singletonSlug = params.singletonSlug
				invariant(
					singletons?.[singletonSlug],
					`Singleton ${singletonSlug} not found in config`,
				)
				const singleton = singletons[singletonSlug]
				const formData = await request.formData()
				const schema = createZodSchema({
					schema: singleton.schema,
					options: { type: 'action' },
				})
				const submission = parseWithZod(formData, { schema })
				const transformedPayload = transformMultiselectFields(
					submission.payload,
					singleton.schema,
				)
				const metadata = {
					...transformedPayload,
					updatedAt: new Date().toISOString(),
				}
				const fileContent = JSON.stringify(metadata, null, 2)
				const file = new File(
					[fileContent],
					`${singletonSlug}.${singletonFormat}`,
					{
						type: 'text/json',
					},
				)
				await r2Storage.set(
					`${singletonsPrefix}/${singletonSlug}.${singletonFormat}`,
					file,
				)

				return { ...metadata }
			}

			// Handle collections
			const collectionSlug = params.collectionSlug
			invariant(
				collections[collectionSlug],
				`Collection ${collectionSlug} not found in config`,
			)
			const collection = collections[collectionSlug]
			const collectionFormat = config.storage.format.collections

			const formData = await request.formData()
			const collectionPrefix = `${contentPrefix}/collections/${collectionSlug}`
			const schema = createZodSchema({
				schema: collection.schema,
				options: { type: 'action' },
			})

			if (params.section === 'create-collection-item') {
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

				const file = new File(
					[fileContent],
					`${slug}.${collectionFormat}`,
					{
						type: 'text/markdown',
					},
				)
				await r2Storage.set(
					`${collectionPrefix}/${slug}.${collectionFormat}`,
					file,
				)

				const redirectUrl = `${basePath}/${PATHS.EDITOR}/${collectionSlug}/${id}`
				return redirect(redirectUrl)
			}

			const id = params.id
			if (params.section === 'edit-collection-item') {
				const data = await readItemInR2Collection({
					format: collectionFormat,
					id,
					prefix: collectionPrefix,
					r2Storage,
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

				// If slug changed, delete old file
				if (oldMetadata.slug !== slug) {
					await r2Storage.remove(
						`${collectionPrefix}/${oldMetadata.slug}.${collectionFormat}`,
					)
				}

				// Upload new/updated file
				const file = new File(
					[fileContent],
					`${slug}.${collectionFormat}`,
					{
						type: 'text/markdown',
					},
				)
				await r2Storage.set(
					`${collectionPrefix}/${slug}.${collectionFormat}`,
					file,
				)

				return { content, ...metadata }
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
