import { parseWithZod } from '@conform-to/zod'
import {
	PATHS,
	type R2Credentials,
	createZodSchema,
	parseAdminPathname,
	generateItemMetadata,
	generateSingletonMetadata,
	createFileContent,
	createSingletonContent,
	processFormSubmission,
	extractSlug,
	getCloudflareEnvVar,
	getEnvVar,
} from '@kobun/common'
import { redirect } from 'react-router'
import invariant from 'tiny-invariant'

import { CloudflareR2FileStorage } from '~/cloudflare/r2'
import { readItemInR2Collection } from '~/cloudflare/utils'
import type { ActionHandlerArgs } from '~/types'

export const handleActions = async ({
	config,
	context,
	request,
}: ActionHandlerArgs) => {
	const { adminAccess, basePath, collections, singletons, storage } = config
	if (adminAccess?.disabled) return redirect(adminAccess?.redirectUrl ?? '/')
	const url = new URL(request.url)
	const params = parseAdminPathname({
		basePath,
		collections,
		pathname: url.pathname,
		singletons,
	})

	if (!params) return {}

	const mode = storage.mode
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

			const credentials: R2Credentials = storage.credentials
				? storage.credentials
				: context.cloudflare.env
					? {
							accountId: getCloudflareEnvVar(
								context.cloudflare.env,
								'ACCOUNT_ID',
							),
							accessKeyId: getCloudflareEnvVar(
								context.cloudflare.env,
								'ACCESS_KEY',
							),
							bucketName: getCloudflareEnvVar(
								context.cloudflare.env,
								'BUCKET_NAME',
							),
							secretAccessKey: getCloudflareEnvVar(
								context.cloudflare.env,
								'SECRET_ACCESS_KEY',
							),
						}
					: {
							accountId: getEnvVar('ACCOUNT_ID'),
							accessKeyId: getEnvVar('ACCESS_KEY'),
							bucketName: getEnvVar('BUCKET_NAME'),
							secretAccessKey: getEnvVar('SECRET_ACCESS_KEY'),
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

				const { transformedPayload } = await processFormSubmission(
					formData,
					schema,
					singleton.schema,
				)

				const metadata = generateSingletonMetadata(transformedPayload)
				const fileContent = createSingletonContent(metadata)

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
				const {
					content,
					intent,
					metadata: payloadMetadata,
				} = await processFormSubmission(
					formData,
					schema,
					collection.schema,
				)

				const metadata = generateItemMetadata(payloadMetadata, {
					intent,
					generateId: true,
				})

				const slug = extractSlug(payloadMetadata)
				const fileContent = createFileContent(metadata, content)

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

				const redirectUrl = `${basePath}/${PATHS.EDITOR}/${collectionSlug}/${metadata.id}`
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

				const {
					content,
					intent,
					metadata: payloadMetadata,
				} = await processFormSubmission(
					formData,
					schema,
					collection.schema,
				)

				const metadata = generateItemMetadata(payloadMetadata, {
					intent,
					existingMetadata: oldMetadata,
					generateId: false,
				})

				const slug = extractSlug(payloadMetadata)
				const fileContent = createFileContent(metadata, content)

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
