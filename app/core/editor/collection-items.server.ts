import { parseFrontmatter, stringifyFrontmatter } from "@/lib/frontmatter"
import { canonicalMetadata, normalizeMetadata } from "./collection-metadata"

interface CollectionConfig {
	format: string
	schema: Record<string, { type: string }>
}

export interface RepositoryCollectionFile {
	content: string
	name: string
	path: string
	sha: string
}

export interface ResolvedCollectionItem {
	body: string
	frontmatter: Record<string, unknown>
	itemSlug: string
	name: string
	path: string
	sha: string
	sourcePrefix: string
}

export function isMarkdownCollectionFile(file: { name: string }) {
	return file.name.endsWith(".md") || file.name.endsWith(".mdx")
}

function getEffectiveSlug(
	collection: CollectionConfig,
	file: RepositoryCollectionFile,
	frontmatter: Record<string, unknown>,
) {
	const slugField = Object.entries(collection.schema).find(
		([, field]) => field.type === "slug",
	)?.[0]
	const filenameSlug = file.name.replace(/\.mdx?$/, "")
	const configuredSlug = slugField ? frontmatter[slugField] : undefined
	return configuredSlug == null || configuredSlug === ""
		? filenameSlug
		: String(configuredSlug)
}

export function findCollectionItemBySlug(
	collection: CollectionConfig,
	files: RepositoryCollectionFile[],
	slug: string,
): ResolvedCollectionItem | null {
	const matches = files.flatMap((file) => {
		const parsed = parseFrontmatter(file.content)
		const frontmatter = normalizeMetadata(parsed.data) as Record<
			string,
			unknown
		>
		const itemSlug = getEffectiveSlug(collection, file, frontmatter)
		const sourcePrefix = file.content.slice(
			0,
			file.content.length - parsed.content.length,
		)
		return itemSlug === slug
			? [
					{
						body: parsed.content,
						frontmatter,
						itemSlug,
						name: file.name,
						path: file.path,
						sha: file.sha,
						sourcePrefix,
					},
				]
			: []
	})

	if (matches.length > 1) {
		throw new Error(`Multiple collection items use slug "${slug}"`)
	}
	return matches[0] ?? null
}

export function serializeCollectionItem(
	markdown: string,
	sourcePrefix: string,
	frontmatter?: Record<string, unknown>,
	originalFrontmatter?: Record<string, unknown>,
) {
	if (
		frontmatter &&
		originalFrontmatter &&
		canonicalMetadata(frontmatter) !== canonicalMetadata(originalFrontmatter)
	) {
		return stringifyFrontmatter(markdown, frontmatter)
	}
	return `${sourcePrefix}${markdown}`
}

export function collectionItemBodyMatches(
	item: Pick<ResolvedCollectionItem, "body">,
	markdown: string,
) {
	return item.body === markdown
}
