import type { Format } from "@/config/types"
import { parseDocument } from "@/core/content/document.server"

interface CollectionConfig {
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
	/** The Source's bytes as committed, for whoever serializes over them. */
	raw: string
	sha: string
}

export function isMarkdownCollectionFile(file: { name: string }) {
	return file.name.endsWith(".md") || file.name.endsWith(".mdx")
}

/**
 * The Format of a file `isMarkdownCollectionFile` accepted — the two go
 * together, and this answers for nothing else. Reading a listing means taking
 * the Format from the file rather than from `collection.format`: the listing
 * holds whatever the directory holds, so a Collection configured as json or
 * yaml would otherwise hand the parser a Format its md/mdx files are not in.
 */
export function collectionFileFormat(file: { name: string }): Format {
	return file.name.endsWith(".mdx") ? "mdx" : "md"
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
		const document = parseDocument(file.content, collectionFileFormat(file))
		const itemSlug = getEffectiveSlug(collection, file, document.data)
		return itemSlug === slug
			? [
					{
						// The Format above is always a document one, so this Body is a
						// string: the coalesce narrows the type rather than covering for
						// a case that can arise.
						body: document.body ?? "",
						frontmatter: document.data,
						itemSlug,
						name: file.name,
						path: file.path,
						raw: file.content,
						sha: file.sha,
					},
				]
			: []
	})

	if (matches.length > 1) {
		throw new Error(`Multiple collection items use slug "${slug}"`)
	}
	return matches[0] ?? null
}
