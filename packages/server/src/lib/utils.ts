import { APP_BASE_PATH, type Collection } from '@rescribe/common'
import fg from 'fast-glob'
import matter from 'gray-matter'
import fs from 'node:fs/promises'

export const getLocalCollectionContentPath = ({
	collection,
	format = 'md',
	slug = '',
}: {
	collection: Collection
	format: 'md' | 'mdx'
	slug?: string
}) => {
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
}: { collection: Collection; format: 'md' | 'mdx' }) => {
	const path = getLocalCollectionContentPath({ collection, format })
	const entries = await fg(path, { onlyFiles: true })
	const data = await Promise.all(
		entries.map(async (entry) => {
			const file = await fs.readFile(entry, 'utf8')
			const { data: frontmatter } = matter(file)
			return frontmatter
		}),
	)
	return data
}
