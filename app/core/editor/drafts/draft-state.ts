/**
 * Whether the Draft holds anything its Source does not. A Draft that has never
 * been published is Dirty by definition; one published at an older Revision has
 * been typed into since. Every transition turns on this question — which is why
 * it is a pure function of two columns, callable from a browser that has a Draft
 * row and nothing else.
 */
export function isDraftDirty(draft: {
	publishedRevision: number | null
	revision: number
}) {
	return (
		draft.publishedRevision === null || draft.revision > draft.publishedRevision
	)
}

/**
 * The three states a Draft can be found in, in the glossary's own words. Dirty
 * and Clean are the pair `isDraftDirty` answers; a Draft with no Published
 * Revision is Dirty too, but it is not the same news to a writer — it has
 * nothing in the repository behind it at all, so it gets its own name.
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
	publishedRevision: number | null
	revision: number
}): DraftState {
	if (draft.publishedRevision === null) return "never-published"
	return isDraftDirty(draft) ? "dirty" : "clean"
}
