import { APP_BASE_PATH, type Collection } from '@rescribe/common'
import fg from 'fast-glob'
import matter from 'gray-matter'
import fs from 'node:fs/promises'
import type z from 'zod'

type LocalCollectionContentPath = {
	collection: Collection
	format: 'md' | 'mdx'
	slug?: string
}

export const getLocalCollectionContentPath = ({
	collection,
	format = 'md',
	slug = '',
}: LocalCollectionContentPath) => {
	if (slug) {
		// TODO: replace should check for glob pattern from config
		return `${process.cwd()}${APP_BASE_PATH}/content/collections/${collection.paths.content
			.replace('**/*', '')
			.replace('*', '')}${slug}.${format}`
	}

	return `${process.cwd()}${APP_BASE_PATH}/content/collections/${collection.paths.content}.${format}`
}

export const readItemsInLocalCollection = async ({
	collection,
	format,
}: Omit<LocalCollectionContentPath, 'slug'>) => {
	const path = getLocalCollectionContentPath({ collection, format })
	const entries = await fg(path, { onlyFiles: true })
	const data = await Promise.all(
		entries.map(async (entry) => {
			const file = await fs.readFile(entry, 'utf8')
			const { data: metadata } = matter(file)
			return metadata
		}),
	)
	return data
}

type LocalCollectionItemPath = {
	id: string
	schema: z.ZodType
} & Omit<LocalCollectionContentPath, 'slug'>

export const readItemInLocalCollection = async ({
	collection,
	format = 'md',
	id,
	schema,
}: LocalCollectionItemPath) => {
	// TODO: use the index to get the file name instead of parsing every file
	const items = await readItemsInLocalCollection({ collection, format })
	const data = items.find((item) => item.id === id)
	const metadata = schema.parse(data)
	const path = getLocalCollectionContentPath({
		collection,
		format,
		slug: metadata.slug,
	})
	const file = await fs.readFile(path, 'utf8')
	const { content } = matter(file)
	return { content, ...metadata }
}
