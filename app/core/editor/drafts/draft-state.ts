/**
 * Whether the Draft holds anything its Source does not. A Draft that has never
 * been committed is Dirty by definition; one committed at an older Revision has
 * been typed into since. Every transition turns on this question — which is why
 * it is a pure function of two columns, callable from a browser that has a Draft
 * row and nothing else.
 */
export function isDraftDirty(draft: {
	committedRevision: number | null
	revision: number
}) {
	return (
		draft.committedRevision === null || draft.revision > draft.committedRevision
	)
}

/**
 * What a surface says about a Draft *beside* its Source's Publication State,
 * never in place of it (ADR-0008). The two answer different questions — is it
 * in the repository, and what should the site do with it once there — and a
 * Draft that hid the Source's answer was the collision this replaced (#127).
 *
 * `NOT_IN_REPOSITORY` is narrower than "no Committed Revision": a Draft opened
 * over a Source that already existed has none either, but the file is in the
 * repository, so the news about it is that the repository is behind.
 *
 * `COMMITTED` is what a Clean Draft is — no news at all — which is why the
 * Collection list, whose query only asks for Dirty Drafts, never shows it.
 */
export type DraftMarker =
	| "COMMITTED"
	| "NOT_IN_REPOSITORY"
	| "UNCOMMITTED_CHANGES"

/**
 * Which of the three a Draft is in. It lives beside `isDraftDirty` rather than
 * in either caller because the dashboard and the Collection list both ask it,
 * and two copies of a lifecycle drift.
 */
export function draftMarker(draft: {
	committedRevision: number | null
	revision: number
	sourcePath: string | null
}): DraftMarker {
	if (!isDraftDirty(draft)) return "COMMITTED"
	return draft.sourcePath === null ? "NOT_IN_REPOSITORY" : "UNCOMMITTED_CHANGES"
}

/**
 * The writer's words for each marker, spelled once. Both surfaces that show a
 * Draft read them from here: the two had drifted apart into label tables that
 * agreed only by luck, and one of them called a Clean Draft "Published" (#127).
 */
export const DRAFT_MARKER_LABELS: Record<DraftMarker, string> = {
	COMMITTED: "In repository",
	NOT_IN_REPOSITORY: "Not in repository",
	UNCOMMITTED_CHANGES: "Uncommitted changes",
}
