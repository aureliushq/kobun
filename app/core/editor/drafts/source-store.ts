/**
 * Where Source files live, as the drafts module sees it: a place to read and to
 * write. Everything the real store needs to know about GitHub — the app
 * installation, the owner, the repository — is closed over by its adapter, so
 * the module never sees any of it (ADR-0001).
 */
export interface SourceStore {
	/**
	 * One file by its path; null when it is absent. Listing a directory is not
	 * this port's job: the Collection listing cache names files without their
	 * bytes, and the module reads only the one it wants (ADR 0012).
	 */
	read(path: string): Promise<SourceFile | null>
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
	/**
	 * Images the content links to, written in the same commit: a refused write
	 * leaves none of them behind.
	 */
	images?: SourceImage[]
	message: string
	path: string
}

/** An image's bytes and the repository path they are written to. */
export interface SourceImage {
	bytes: Uint8Array
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
