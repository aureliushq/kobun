import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { lastKnownConfig } from "@/core/project-context"
import { editorDraft, project } from "@/db/schema/app-schema"
import type { ProjectLocation } from "./draft-paths"
import { draftHeading } from "./draft-summary"
import type { DraftsDatabase } from "./types"

/**
 * How many Drafts the dashboard shows before it offers the rest.
 *
 * A number rather than a Preference: an unbounded list is wrong at any setting,
 * and ADR-0010 says outright that "a value a module declares as its contract
 * does not become a Preference merely because it is a number".
 */
export const DASHBOARD_DRAFT_LIMIT = 5

/** A Draft, as the dashboard's list shows one. */
export interface DashboardDraft {
	collectionLabel: string
	collectionSlug: string
	heading: string
	id: string
	itemSlug: string | null
	project: ProjectLocation
	committedRevision: number | null
	revision: number
	sourcePath: string | null
	updatedAt: Date
}

export interface DashboardDrafts {
	drafts: DashboardDraft[]
	/**
	 * Whether these are all of them. Answered here rather than by comparing
	 * `drafts.length` to `total` in the view: the two numbers come off separate
	 * queries, so a row written between them would make the view's arithmetic
	 * disagree with what was actually asked for.
	 */
	showingAll: boolean
	/** Every Draft the writer has, so the list can say how many it is not showing. */
	total: number
}

/**
 * Every Draft the writer holds, across every Project, newest edited first —
 * bounded, because this is a section of a page rather than the page.
 *
 * Three round-trips before a single Draft can be listed, and a fourth on the
 * bounded path so the list can say how many it is not showing. None of them
 * decides whether the dashboard may be seen, so the page does not wait on them
 * (ADR 0006).
 *
 * The cleanup delete runs first, so nothing below lists or counts a row that is
 * about to go. It only removes Drafts that are Synced, so running it late,
 * twice, or — if the reader closes the tab mid-stream — not at all costs
 * nothing: the next dashboard load does it.
 *
 * A card is headed by the Draft's Title and names its Collection by that
 * Collection's label, both of which need the Project's Config — and the Config
 * the cache last stored is already on the Project row, so neither costs a
 * round-trip of its own. It is read here rather than in the card because the
 * row carries a whole parsed Config, which no browser needs to hold to render a
 * heading.
 */
export async function loadDashboardDrafts(
	db: DraftsDatabase,
	userId: string,
	{ all = false }: { all?: boolean } = {},
): Promise<DashboardDrafts> {
	const userProjects = await db.query.project.findMany({
		where: eq(project.userId, userId),
	})
	const projectIds = userProjects.map((projectRow) => projectRow.id)
	if (projectIds.length === 0) return { drafts: [], showingAll: true, total: 0 }

	await db
		.delete(editorDraft)
		.where(
			and(
				inArray(editorDraft.projectId, projectIds),
				isNotNull(editorDraft.committedRevision),
				isNotNull(editorDraft.committedAt),
				sql`${editorDraft.revision} = ${editorDraft.committedRevision}`,
			),
		)

	// Read once per Project rather than once per Draft: a writer with a dozen
	// Drafts in one Collection has one Config between them.
	const configs = new Map(
		userProjects.map((projectRow) => [
			projectRow.id,
			lastKnownConfig(projectRow),
		]),
	)

	const drafts = await db.query.editorDraft.findMany({
		limit: all ? undefined : DASHBOARD_DRAFT_LIMIT,
		where: inArray(editorDraft.projectId, projectIds),
		with: { project: true },
		orderBy: [desc(editorDraft.updatedAt)],
	})

	// Counted in the database rather than by reading every row and measuring it,
	// which is the one thing the limit exists to stop — and not counted at all on
	// the path that has just read every row anyway.
	const total = all ? drafts.length : await countDrafts(db, projectIds)

	return {
		drafts: drafts.map((draft) => {
			// A Collection the Config no longer declares still has Drafts, and they
			// are still reachable — so the card falls back to the slug rather than
			// dropping the row.
			const collection =
				configs.get(draft.projectId)?.collections[draft.collectionSlug] ?? null
			return {
				collectionLabel: collection?.label ?? draft.collectionSlug,
				collectionSlug: draft.collectionSlug,
				heading: draftHeading(draft, collection),
				id: draft.id,
				itemSlug: draft.itemSlug,
				project: {
					repoName: draft.project.repoName,
					repoOwnerLogin: draft.project.repoOwnerLogin,
				},
				committedRevision: draft.committedRevision,
				revision: draft.revision,
				sourcePath: draft.sourcePath,
				updatedAt: draft.updatedAt,
			}
		}),
		showingAll: all,
		total,
	}
}

async function countDrafts(db: DraftsDatabase, projectIds: string[]) {
	const [row] = await db
		.select({ drafts: count() })
		.from(editorDraft)
		.where(inArray(editorDraft.projectId, projectIds))

	return row?.drafts ?? 0
}
