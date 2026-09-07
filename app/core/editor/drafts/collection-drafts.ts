import { and, desc, eq, isNull, or, sql } from "drizzle-orm"
import type { Collection } from "@/config/types"
import { editorDraft } from "@/db/schema/app-schema"
import { getDraftEditorPath, type ProjectLocation } from "./draft-paths"
import { draftData, draftHeading } from "./draft-summary"
import type { DraftsDatabase } from "./types"

/**
 * Which Project's Drafts these are, and under whose name they are addressed —
 * the location the paths are built from, plus the id the rows are scoped by.
 */
type DraftsProject = ProjectLocation & { id: string }

/**
 * A Dirty Draft, as the Collection's list shows one. It carries its own Data
 * rather than a rendered date because which Field a date comes off is the
 * list's question, answered against the same schema it answers it against for
 * a committed item.
 */
export interface CollectionDraft {
	/** The Draft row's own moment, for a Draft whose Data names none. */
	createdAt: number
	data: Record<string, unknown>
	heading: string
	href: string
	id: string
	committedRevision: number | null
	revision: number
	sourcePath: string | null
}

/**
 * Every Dirty Draft this Collection holds, newest first.
 *
 * Dirty is expressed here as SQL rather than filtered in memory — the same
 * predicate `isDraftDirty` states, on the other side of the wire — because a
 * writer's Clean Drafts are rows this page has no row to put them in, and
 * fetching them to drop them is a page of the listing wasted.
 *
 * Scoping by Project is what keeps a writer to their own Drafts: a Project is
 * resolved by the session's user before this is ever called, so a Draft reached
 * through one belongs to whoever is asking.
 */
export async function listCollectionDrafts(
	db: DraftsDatabase,
	project: DraftsProject,
	collection: Collection,
	collectionSlug: string,
): Promise<CollectionDraft[]> {
	const drafts = await db.query.editorDraft.findMany({
		orderBy: [desc(editorDraft.updatedAt)],
		where: and(
			eq(editorDraft.projectId, project.id),
			eq(editorDraft.collectionSlug, collectionSlug),
			or(
				isNull(editorDraft.committedRevision),
				sql`${editorDraft.revision} > ${editorDraft.committedRevision}`,
			),
		),
	})

	return drafts.map((draft) => ({
		createdAt: draft.createdAt.getTime(),
		data: draftData(draft.metadata) ?? {},
		heading: draftHeading(draft, collection),
		href: getDraftEditorPath(draft, project),
		id: draft.id,
		committedRevision: draft.committedRevision,
		revision: draft.revision,
		sourcePath: draft.sourcePath,
	}))
}
