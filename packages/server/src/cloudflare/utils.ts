import type z from 'zod'

import type { CloudflareR2FileStorage } from './r2'
import matter from 'gray-matter'

type R2CollectionContentProps = {
	filters?: Record<string, string>
	format: 'md' | 'mdx'
	prefix: string
	r2Storage: CloudflareR2FileStorage
	slug?: string
}

export const readItemsInR2Collection = async ({
	filters,
	format,
	prefix,
	r2Storage,
}: Omit<R2CollectionContentProps, 'slug'>) => {
	const files = await r2Storage.list(prefix)
	const data = await Promise.all(
		files
			.filter((file) => file.endsWith(format))
			.map(async (filePath) => {
				const fileContent = await r2Storage.get(filePath)
				const { data: metadata } = matter(fileContent as string)
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

type R2CollectionItemContentProps = {
	id?: string
	schema: z.ZodType
	slug?: string
} & Omit<R2CollectionContentProps, 'slug' | 'filters'>

export const readItemInR2Collection = async ({
	format = 'md',
	id,
	prefix,
	r2Storage,
	schema,
	slug,
}: R2CollectionItemContentProps) => {
	if (!slug) {
		// TODO: use the index to get the file name instead of parsing every file
		const items = await readItemsInR2Collection({
			format,
			prefix,
			r2Storage,
		})
		const item = items.find((item) => item.id === id)
		if (!item) return {}
		const result = schema.safeParse(item)
		if (!result.success) {
			// Return partial data with empty values for invalid fields
			const partialData = { ...item } as Record<string, unknown>
			// biome-ignore lint/complexity/noForEach: <explanation>
			result.error.errors.forEach((error) => {
				const path = error.path.join('.')
				partialData[path] = ''
			})
			return partialData
		}
		const data = await r2Storage.get(
			`${prefix}/${result.data.slug}.${format}`,
		)
		if (!data) return {}
		const { content, data: metadata } = matter(data as string)
		return { content, ...metadata }
	}

	const data = await r2Storage.get(`${prefix}/${slug}.${format}`)
	if (!data) return {}
	const { content, data: metadata } = matter(data)
	const result = schema.safeParse(metadata)
	if (!result.success) {
		// Return partial data with empty values for invalid fields
		const partialData = { ...metadata, content: data } as Record<
			string,
			unknown
		>
		// biome-ignore lint/complexity/noForEach: <explanation>
		result.error.errors.forEach((error) => {
			const path = error.path.join('.')
			partialData[path] = ''
		})
		return partialData
	}
	return { content, ...result.data }
}

export const readR2Singleton = async ({
	format = 'json',
	prefix,
	r2Storage,
	schema,
	slug,
}: {
	format?: string
	prefix: string
	r2Storage: CloudflareR2FileStorage
	schema: z.ZodType
	slug: string
}) => {
	const path = `${prefix}/${slug}.${format}`
	try {
		const content = await r2Storage.get(path)
		if (!content) return {}
		const data = JSON.parse(content as string)
		const result = schema.safeParse(data)
		if (!result.success) return {}
		return result.data
	} catch (error) {
		// Return empty object if file doesn't exist or other errors occur
		return {}
	}
}
