import type { RepositoryAddress, SourceRequest } from "@/core/project-context"
import type { SourceFile } from "./drafts/source-store"

/**
 * One directory entry, as the validator sees it: identity and nothing else. The
 * whole point of this half of the port is that it costs no file bytes.
 */
export interface CollectionListingEntry {
	name: string
	sha: string
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
	/**
	 * One file with its bytes, for a directory where only a few files changed:
	 * the cache reads those rather than the whole directory again.
	 */
	file(repository: RepositoryAddress, path: string): Promise<SourceFile>
	files(repository: RepositoryAddress, path: string): Promise<SourceFile[]>
	read(
		repository: RepositoryAddress,
		request: SourceRequest,
	): Promise<CollectionListingRead>
}
