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
 * The three states a Draft can be found in. Dirty and Clean are the pair
 * `isDraftDirty` answers; a Draft with no Committed Revision is Dirty too, but
 * it is not the same news to a writer — it has nothing in the repository behind
 * it at all, so it gets its own name.
 *
 * That third member still spells the pre-ADR-0008 vocabulary: it means *no
 * Committed Revision*, and is renamed with the labels it feeds (#127).
 *
 * Named for the lifecycle rather than for what a screen calls it. A surface
 * that shows a Draft has a reader to write for and picks its own words; what
 * must not be duplicated is the classification, and that is what this is.
 */
export type DraftState = "clean" | "dirty" | "never-published"

/**
 * Which of the three a Draft is in. It lives beside `isDraftDirty` rather than
 * in either caller because the dashboard and the Collection list both ask it,
 * and two copies of a lifecycle drift.
 */
export function draftState(draft: {
	committedRevision: number | null
	revision: number
}): DraftState {
	if (draft.committedRevision === null) return "never-published"
	return isDraftDirty(draft) ? "dirty" : "clean"
}
