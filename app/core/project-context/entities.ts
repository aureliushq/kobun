import type { Collection, Singleton, Subcollection } from "@/config/types"
import type { ProjectContextOk } from "./types"

/** A Config declares no paths; where its entities live is a convention. */
function repositoryPath(...segments: string[]) {
	return segments.join("/").replace(/\/+/g, "/")
}

function notFound(what: string): never {
	throw new Response(`${what} not found`, { status: 404 })
}

/**
 * A directory of Collection Items: where their Sources live, the Collection
 * whose schema, label and Format they share, and the key their Drafts are
 * owned under. Pages and Drafts work from this rather than from a URL's
 * Collection key, so a top-level Collection is one way of resolving it.
 */
export interface ContentDirectory {
	collection: Collection
	collectionSlug: string
	directoryPath: string
}

/**
 * The Collection a URL names, as the content directory its Sources live in.
 *
 * Narrowing is deliberately not part of the resolver: a route that addresses no
 * entity — an asset, a layout — has no slug to narrow by, and the two callers
 * that do want one want different entities. A slug the Config does not declare
 * is a not-found, the same answer a mistyped URL gets anywhere else.
 */
export function requireCollection(
	ctx: Pick<ProjectContextOk, "config">,
	slug: string,
): ContentDirectory {
	const collection = ctx.config.collections[slug]
	if (!collection) notFound("Collection")

	return {
		collection,
		collectionSlug: slug,
		directoryPath: repositoryPath(ctx.config.basePath, slug),
	}
}

/**
 * The Subcollection a URL names, and the directory one Parent Item's items of
 * it live in: beside the Parent Item's file, named after its filename stem
 * (ADR-0012). Whether that Parent Item has a Source is the caller's to check —
 * it takes a listing, and this stays as pure as its siblings.
 */
export function requireSubcollection(
	ctx: Pick<ProjectContextOk, "config">,
	collectionSlug: string,
	subcollectionKey: string,
	parentStem: string,
): {
	directoryPath: string
	parent: ContentDirectory
	subcollection: Subcollection
} {
	const parent = requireCollection(ctx, collectionSlug)
	const subcollection = parent.collection.subcollections?.[subcollectionKey]
	if (!subcollection) notFound("Subcollection")

	return {
		directoryPath: repositoryPath(
			parent.directoryPath,
			parentStem,
			subcollectionKey,
		),
		parent,
		subcollection,
	}
}

/** The Singleton a URL names, and the one file it lives in. */
export function requireSingleton(
	ctx: Pick<ProjectContextOk, "config">,
	slug: string,
): { filePath: string; singleton: Singleton } {
	const singleton = ctx.config.singletons[slug]
	if (!singleton) notFound("Singleton")

	return {
		filePath: repositoryPath(
			ctx.config.basePath,
			"singletons",
			`${slug}.${singleton.format}`,
		),
		singleton,
	}
}
