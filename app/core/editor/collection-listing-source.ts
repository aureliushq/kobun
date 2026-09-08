import type { DrizzleD1Database } from "drizzle-orm/d1"
import type { RepositoryAddress } from "@/core/project-context"
import type * as schema from "@/db/schema"

/**
 * Production runs on D1; tests run the same schema on in-memory SQLite and cast
 * to this type. The cast holds as long as the module sticks to plain queries:
 * never call `.batch()` or `.transaction()`, which differ between the drivers.
 */
export type CollectionListingDatabase = DrizzleD1Database<typeof schema>

/**
 * One directory entry, as the validator sees it: identity and nothing else. The
 * whole point of this half of the port is that it costs no file bytes.
 */
export interface CollectionListingEntry {
	name: string
	sha: string
}

/**
 * One conditional read of a directory. An `etag` is only meaningful for the
 * path it came back from, and a read the module has nothing cached to fall back
 * on omits it — a `not-modified` with nothing to serve would pin the Collection
 * empty past every window (ADR-0003).
 */
export interface CollectionListingRequest {
	etag?: string | null
	path: string
}

/**
 * What the read found.
 *
 * `not-modified` is the answer worth having: it costs no GitHub rate limit and
 * tells the module its cached parse is still current.
 *
 * `not-found` is a directory nobody has written into yet, which is an empty
 * Collection rather than a failure — and never the same thing as a repository
 * that could not be reached, which arrives as a throw.
 */
export type CollectionListingRead =
	| { entries: CollectionListingEntry[]; etag: string | null; kind: "entries" }
	| { kind: "not-found" }
	| { kind: "not-modified" }

/** A Source file with its bytes: what the expensive half of the port returns. */
export interface CollectionSourceFile {
	content: string
	name: string
	path: string
	sha: string
}

/**
 * Where a Collection's files live, as the cache sees it — deliberately in two
 * halves, because the two cost wildly different things. `read` lists a
 * directory's entries without their bytes and answers conditionally; `files`
 * pulls the full text of every file in it, and is the call this whole module
 * exists to stop spending on a hover (#125).
 *
 * The split is also what keeps cache policy out of the adapter: whether a fresh
 * entry list is worth the text behind it is decided by comparing it against
 * what the cache remembers, and only the cache remembers anything.
 */
export interface CollectionListingSource {
	files(
		repository: RepositoryAddress,
		path: string,
	): Promise<CollectionSourceFile[]>
	read(
		repository: RepositoryAddress,
		request: CollectionListingRequest,
	): Promise<CollectionListingRead>
}
