// biome-ignore lint/style/useNodejsImportProtocol: <explanation>
import { promises as fs } from 'fs'
import {
	APP_BASE_PATH,
	type Collection,
	type ContentFormat,
	type ContentPath,
	type Singleton,
	type SingletonFormat,
	safeFileOperation,
	NotFoundError,
	ValidationError,
	StorageError,
} from '@kobun/common'
import fg from 'fast-glob'
import matter from 'gray-matter'
import type z from 'zod'
import { readFile } from 'node:fs/promises'

type LocalCollectionContentPath = {
	collection: Collection
	filters?: Record<string, string>
	format: ContentFormat
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
		if (!data) return {}
		const result = schema.safeParse(data)
		if (!result.success) return {}
		path = getLocalCollectionContentPath({
			collection,
			format,
			slug: result.data.slug,
		})
	} else {
		path = getLocalCollectionContentPath({
			collection,
			format,
			slug,
		})
	}
	return await safeFileOperation(
		async () => {
			const file = await fs.readFile(path, 'utf8')
			const { content, data } = matter(file)
			const result = schema.safeParse(data)

			if (!result.success) {
				throw new ValidationError('Failed to validate item metadata', {
					path,
					id,
					errors: result.error.errors,
				})
			}

			return { content, ...result.data }
		},
		'read collection item',
		path,
	)
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

type ReadLocalSingletonPath = {
	singleton: Singleton
	format: SingletonFormat
	schema: z.ZodType
}

export const getLocalSingletonContentPath = ({
	format = 'json',
	singleton,
}: {
	format?: SingletonFormat
	singleton: Singleton
}): string => {
	const contentPath = singleton.paths.content as string
	return `${process.cwd()}${APP_BASE_PATH}/content/singletons/${contentPath}.${format}`
}

export const readLocalSingleton = async ({
	format = 'json',
	schema,
	singleton,
}: ReadLocalSingletonPath) => {
	const path = getLocalSingletonContentPath({
		format,
		singleton,
	})
	try {
		const content = await readFile(path, 'utf-8')
		const data = JSON.parse(content)
		const result = schema.safeParse(data)
		if (!result.success) return {}
		return result.data
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			// Return empty object if file doesn't exist
			return {}
		}
		throw error
	}
}

type WriteLocalSingletonPath = {
	singleton: Singleton
	format: SingletonFormat
	fileContent: string
}

export const writeLocalSingleton = async ({
	fileContent,
	format = 'json',
	singleton,
}: WriteLocalSingletonPath) => {
	const path = getLocalSingletonContentPath({
		format,
		singleton,
	})
	const dir = path.split('/').slice(0, -1).join('/')
	try {
		await fs.access(dir)
	} catch (error) {
		await fs.mkdir(dir, { recursive: true })
	}
	await fs.writeFile(path, fileContent)
}
