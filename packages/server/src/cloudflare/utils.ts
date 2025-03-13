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
		const data = await r2Storage.get(`${prefix}/${item?.slug}.${format}`)
		if (!data) return null
		const metadata = schema.parse(item)
		const { content } = matter(data)
		return { content, ...metadata }
	}

	const data = await r2Storage.get(`${prefix}/${slug}.${format}`)
	if (!data) return null
	const metadata = schema.parse(data)
	const { content } = matter(data)
	return { content, ...metadata }
}
