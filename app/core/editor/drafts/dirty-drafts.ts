import { and, count, eq, isNull, or, sql } from "drizzle-orm"
import { editorDraft } from "@/db/schema/app-schema"
import type { DraftsDatabase } from "./types"

/**
 * Dirty, as a `WHERE` clause: `isDraftDirty` said in SQL.
 *
 * The pure form in `draft-state.ts` answers about a row already in hand and has
 * to stay browser-safe, so the two cannot be one function. They can be one
 * phrase in two grammars — which is the point of naming this rather than
 * spelling the `OR` out at every call site.
 */
export function dirtyDraftWhere() {
	return or(
		isNull(editorDraft.committedRevision),
		sql`${editorDraft.revision} > ${editorDraft.committedRevision}`,
	)
}

/**
 * How many of a Project's Drafts hold work its repository does not have.
 *
 * Counted in the database rather than by reading the rows and filtering them:
 * the number is all a Disconnect shows, and the Drafts themselves are about to
 * be deleted unread (#137).
 */
export async function countDirtyDrafts(
	db: DraftsDatabase,
	projectId: string,
): Promise<number> {
	const [row] = await db
		.select({ dirty: count() })
		.from(editorDraft)
		.where(and(eq(editorDraft.projectId, projectId), dirtyDraftWhere()))

	return row?.dirty ?? 0
}
