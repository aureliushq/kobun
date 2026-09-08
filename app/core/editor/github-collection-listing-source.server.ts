import {
	hasStatus,
	listGithubDirectoryEntriesConditional,
	listGithubDirectoryFiles,
} from "@/github/octokit.server"
import type { CollectionListingSource } from "./collection-listing-source"

/**
 * A Collection's directory, as a `CollectionListingSource`.
 *
 * Octokit reports a directory that is absent and one that has not changed by
 * throwing; both are ordinary answers to this port, and translating them is
 * this adapter's whole job — the same division the drafts module's SourceStore
 * draws (ADR-0001), so neither the cache nor its tests ever meets a GitHub
 * client.
 *
 * GitHub identity travels in the address rather than this closure: which
 * installation to read through is a fact of the Project, and no Project is
 * known until the route has resolved one.
 */
export function createGithubCollectionListingSource(
	env: Env,
): CollectionListingSource {
	return {
		// No 404 catch here, deliberately. `read` has already answered whether
		// this directory is there, so a 404 arriving at this point is the
		// installation's auth exchange failing rather than an empty Collection,
		// and it must reach the section's error state instead of being flattened
		// into one.
		files: ({ installationId, name, owner }, path) =>
			listGithubDirectoryFiles(env, installationId, owner, name, path),

		read: async ({ installationId, name, owner }, { etag, path }) => {
			try {
				const listing = await listGithubDirectoryEntriesConditional(
					env,
					installationId,
					owner,
					name,
					path,
					etag,
				)
				return {
					entries: listing.entries,
					etag: listing.etag,
					kind: "entries",
				}
			} catch (error) {
				// An unchanged directory costs a 304, which GitHub does not charge
				// against the installation's rate limit.
				if (hasStatus(error, 304)) return { kind: "not-modified" }
				if (hasStatus(error, 404)) return { kind: "not-found" }
				throw error
			}
		},
	}
}
