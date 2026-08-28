import type { Collection, Singleton } from "@/config/types"
import type { ProjectContextOk } from "./types"

/** A Config declares no paths; where its entities live is a convention. */
function repositoryPath(...segments: string[]) {
	return segments.join("/").replace(/\/+/g, "/")
}

function notFound(what: string): never {
	throw new Response(`${what} not found`, { status: 404 })
}

/**
 * The Collection a URL names, and the directory its Sources live in.
 *
 * Narrowing is deliberately not part of the resolver: a route that addresses no
 * entity — an asset, a layout — has no slug to narrow by, and the two callers
 * that do want one want different entities. A slug the Config does not declare
 * is a not-found, the same answer a mistyped URL gets anywhere else.
 */
export function requireCollection(
	ctx: Pick<ProjectContextOk, "config">,
	slug: string,
): { collection: Collection; directoryPath: string } {
	const collection = ctx.config.collections[slug]
	if (!collection) notFound("Collection")

	return {
		collection,
		directoryPath: repositoryPath(ctx.config.basePath, slug),
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
