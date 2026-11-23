import type { Field, Format } from "@/config/types"
import { parseDocument } from "@/core/content/document.server"
import { getEffectiveSlug } from "./collection-metadata"
import type { SourceFile } from "./drafts/source-store"
import type { ResolvedSource } from "./drafts/types"

/**
 * Whether a Collection keeps each item in a folder of its own, as
 * `<name>/index.<format>`, rather than as `<name>.<format>` (ADR-0014). A
 * Collection with Subcollections does: each item's folder also holds its
 * Subcollections' items, so the item and everything it owns live in one place.
 */
export function hasFolderItems(collection: {
	subcollections?: Record<string, unknown>
}) {
	return Object.keys(collection.subcollections ?? {}).length > 0
}

/**
 * An item's name without its extension: the file's stem, or for a folder item
 * (ADR-0014) the folder's name, since every such Source is called `index`.
 */
export const itemStem = (path: string) =>
	path
		.replace(/(\/index)?\.mdx?$/, "")
		.split("/")
		.pop() ?? path

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
export function collectionFileFormat(file: { path: string }): Format {
	return file.path.endsWith(".mdx") ? "mdx" : "md"
}

/** A Source file, parsed into the shape the Draft lifecycle opens. */
export function toResolvedSource(
	file: SourceFile,
	format: Format,
): ResolvedSource {
	const document = parseDocument(file.content, format)
	return {
		// A document Format always parses to a string Body: the coalesce narrows
		// the type rather than covering for a case that can arise.
		body: document.body ?? "",
		frontmatter: document.data,
		itemSlug: null,
		path: file.path,
		raw: file.content,
		sha: file.sha,
	}
}

/**
 * The file as a Collection Item, when it answers to `slug`. A read file of a
 * folder item is named `index`, so its stem comes from its path.
 */
export function findCollectionItemBySlug(
	collection: { schema: Record<string, Field> },
	file: SourceFile,
	slug: string,
): ResolvedSource | null {
	const source = toResolvedSource(file, collectionFileFormat(file))
	const itemSlug = getEffectiveSlug(collection.schema, {
		data: source.frontmatter,
		name: itemStem(file.path),
	})
	return itemSlug === slug ? { ...source, itemSlug } : null
}
