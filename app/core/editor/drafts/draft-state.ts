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
