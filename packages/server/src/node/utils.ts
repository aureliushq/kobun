// biome-ignore lint/style/useNodejsImportProtocol: <explanation>
import { promises as fs } from 'fs'
import { APP_BASE_PATH, type Collection } from '@kobun/common'
import fg from 'fast-glob'
import matter from 'gray-matter'
import type z from 'zod'

type LocalCollectionContentPath = {
	collection: Collection
	filters?: Record<string, string>
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
	filters,
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
	if (filters) {
		return data.filter((item) => {
			return Object.entries(filters).every(([key, value]) => {
				return item[key] === value
			})
		})
	}
	return data
}

type ReadLocalCollectionItemPath = {
	id?: string
	schema: z.ZodType
	slug?: string
} & Omit<LocalCollectionContentPath, 'slug'>

export const readItemInLocalCollection = async ({
	collection,
	format = 'md',
	id,
	schema,
	slug,
}: ReadLocalCollectionItemPath) => {
	let path: string
	if (!slug) {
		// TODO: use the index to get the file name instead of parsing every file
		const items = await readItemsInLocalCollection({ collection, format })
		const data = items.find((item) => item.id === id)
		const metadata = schema.parse(data)
		path = getLocalCollectionContentPath({
			collection,
			format,
			slug: metadata.slug,
		})
	} else {
		path = getLocalCollectionContentPath({
			collection,
			format,
			slug,
		})
	}
	const file = await fs.readFile(path, 'utf8')
	const { content, data } = matter(file)
	console.log('data', data)
	const metadata = schema.parse(data)
	return { content, ...metadata }
}

type WriteLocalCollectionItemPath = {
	fileContent: string
	oldSlug?: string
	slug: string
} & LocalCollectionContentPath

export const writeItemToLocalCollection = async ({
	collection,
	fileContent,
	format = 'md',
	oldSlug = '',
	slug,
}: WriteLocalCollectionItemPath) => {
	const path = getLocalCollectionContentPath({ collection, format, slug })
	if (oldSlug) {
		const oldPath = getLocalCollectionContentPath({
			collection,
			format,
			slug: oldSlug,
		})
		await fs.rename(oldPath, path)
		await fs.writeFile(path, fileContent)
	} else {
		const fileName = path.split('/').pop() as string
		const dir = path.replace(fileName, '')
		try {
			await fs.access(dir)
		} catch (error) {
			await fs.mkdir(dir, { recursive: true })
		}
		await fs.writeFile(path, fileContent)
	}
}
