import type { InstallationID } from "@/types/github"

/**
 * Which repository to read from. GitHub coordinates, deliberately: "repo" is
 * GitHub-side vocabulary, and a Project is the thing a user connects to one.
 *
 * Stated here because the Config was the first thing read through it, but it
 * says nothing about Configs — the Collection listing's port addresses a
 * repository the same way (ADR 0011).
 */
export interface RepositoryAddress {
	installationId: InstallationID
	name: string
	owner: string
}

/**
 * One conditional read. An `etag` is only meaningful for the exact path it came
 * back from, so a probe — which is looking for a Config somewhere else entirely
 * — omits it, and so does any read the module has nothing cached to fall back
 * on. Sending one otherwise risks a `not-modified` with nothing to serve.
 */
export interface ConfigSourceRequest {
	etag?: string | null
	path: string
}

/**
 * What the read found. `not-modified` is the answer worth having: it costs no
 * GitHub rate limit and tells the module its cached parse is still current.
 */
export type ConfigSourceRead =
	| { content: string; etag: string | null; kind: "content"; sha: string }
	| { kind: "not-found" }
	| { kind: "not-modified" }

/**
 * Where a Project's Config file lives, as the module sees it: one file, read by
 * path, conditionally. Deliberately narrower than "give me the Config" — every
 * decision above it (when to ask, what a 404 means, which paths to try, what to
 * remember) is cache policy, and cache policy is the module's own (ADR-0003).
 */
export interface ConfigSource {
	read(
		repository: RepositoryAddress,
		request: ConfigSourceRequest,
	): Promise<ConfigSourceRead>
}
