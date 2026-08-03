/**
 * Where Source files live, as the drafts module sees it: a place to list and to
 * write. Everything the real store needs to know about GitHub — the app
 * installation, the owner, the repository — is closed over by its adapter, so
 * the module never sees any of it (ADR-0001).
 */
export interface SourceStore {
	/** Direct children of `path`; an empty list when the directory is absent. */
	list(path: string): Promise<SourceFile[]>
	write(input: SourceWriteInput): Promise<SourceWriteResult>
}

export interface SourceFile {
	content: string
	name: string
	path: string
	sha: string
}

export interface SourceWriteInput {
	content: string
	/** The sha the writer believes the Source is at; omitted when creating it. */
	expectedSha?: string
	message: string
	path: string
}

/**
 * A refused write is reported, not thrown: the Source moving under a writer is
 * normal operation. Adapters translate their transport's stale-precondition
 * failure into `stale-sha`; the module translates that into a Stale Source.
 */
export type SourceWriteResult =
	| { commitSha?: string; contentSha: string; ok: true }
	| { ok: false; reason: "stale-sha" }
