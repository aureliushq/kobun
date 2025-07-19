import { parseWithZod } from '@conform-to/zod'
import {
	PATHS,
	createZodSchema,
	parseAdminPathname,
	generateItemMetadata,
	generateSingletonMetadata,
	createFileContent,
	createSingletonContent,
	processFormSubmission,
} from '@kobun/common'
import { redirect } from 'react-router'
import invariant from 'tiny-invariant'

import {
	readItemInLocalCollection,
	writeItemToLocalCollection,
	writeLocalSingleton,
} from '~/node/utils'
import type { ActionHandlerArgs } from '~/types'

export const handleActions = async ({ config, request }: ActionHandlerArgs) => {
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
		case 'local': {
			if (
				params.section === 'root' ||
				params.section === 'settings' ||
				params.section === 'collections'
			) {
				return {}
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
				const formData = await request.formData()
				const schema = createZodSchema({
					schema: singleton.schema,
					options: { type: 'action' },
				})
				
				const { transformedPayload } = await processFormSubmission(
					formData,
					schema,
					singleton.schema
				)
				
				const metadata = generateSingletonMetadata(transformedPayload)
				const fileContent = createSingletonContent(metadata)
				
				return await writeLocalSingleton({
					format: singletonFormat,
					fileContent,
					singleton,
				})
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
			const schema = createZodSchema({
				schema: collection.schema,
				options: { type: 'action' },
			})
			if (params.section === 'create-collection-item') {
				// TODO: check if parseWithZod is successful and only then create the file
				const { content, intent, metadata: payloadMetadata } = await processFormSubmission(
					formData,
					schema,
					collection.schema
				)
				
				const metadata = generateItemMetadata(payloadMetadata, { 
					intent, 
					generateId: true 
				})
				
				const slug = payloadMetadata.slug as string
				const fileContent = createFileContent(metadata, content)
				
				await writeItemToLocalCollection({
					collection,
					format: collectionFormat,
					fileContent,
					slug,
				})
				
				const redirectUrl = `${basePath}/${PATHS.EDITOR}/${collectionSlug}/${metadata.id}`
				return redirect(redirectUrl)
			}

			const id = params.id
			if (params.section === 'edit-collection-item') {
				const data = await readItemInLocalCollection({
					collection,
					format: collectionFormat,
					id,
					schema: createZodSchema({
						schema: collection.schema,
						options: { omit: ['content'], type: 'loader' },
					}),
				})
				const { content: oldContent = '', ...oldMetadata } = data

				const { content, intent, metadata: payloadMetadata } = await processFormSubmission(
					formData,
					schema,
					collection.schema
				)
				
				const metadata = generateItemMetadata(payloadMetadata, {
					intent,
					existingMetadata: oldMetadata,
					generateId: false
				})
				
				const slug = payloadMetadata.slug as string
				const fileContent = createFileContent(metadata, content)
				
				await writeItemToLocalCollection({
					collection,
					format: collectionFormat,
					fileContent,
					oldSlug:
						oldMetadata.slug !== payloadMetadata.slug
							? oldMetadata.slug
							: '',
					slug,
				})
				
				return await readItemInLocalCollection({
					collection,
					format: collectionFormat,
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
