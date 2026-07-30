import { and, eq, isNull, sql } from "drizzle-orm"
import invariant from "tiny-invariant"
import { canonicalMetadata } from "@/core/editor/collection-metadata"
import { editorDraft } from "@/db/schema/app-schema"
import type {
	DraftsContext,
	SaveInput,
	SaveResult,
	WriteDraftResult,
} from "./types"

/**
 * The Draft lifecycle for one collection of one project. Every transition is
 * reported as a typed result — a Revision Conflict is a second tab racing an
 * autosave, not an exception — so callers map outcomes instead of catching
 * them (ADR-0001).
 */
export function createDrafts(context: DraftsContext) {
	const { collectionSlug, db, project } = context

	function findDraft(input: SaveInput) {
		// An existing item's Draft is identified by the Source it tracks; a new
		// item's Draft has no Source yet, so the caller carries its id.
		if (input.source) {
			return db.query.editorDraft.findFirst({
				where: and(
					eq(editorDraft.projectId, project.id),
					eq(editorDraft.sourcePath, input.source.path),
				),
			})
		}
		if (!input.draftId) return undefined
		return db.query.editorDraft.findFirst({
			where: and(
				eq(editorDraft.id, input.draftId),
				eq(editorDraft.projectId, project.id),
				eq(editorDraft.collectionSlug, collectionSlug),
				isNull(editorDraft.sourcePath),
			),
		})
	}

	function matchesSource(input: SaveInput) {
		return (
			input.source !== null &&
			input.source.body === input.markdown &&
			canonicalMetadata(input.source.frontmatter) ===
				canonicalMetadata(input.fields)
		)
	}

	/**
	 * Insert or update the Draft, guarding on the Revision the caller expected.
	 * The guard lives in the `UPDATE ... WHERE` clause, so a session that lost
	 * the race between our read and our write is caught by SQL rather than by a
	 * check that can go stale.
	 *
	 * Transitional: the route's publish path calls this directly because publish
	 * must not take `save`'s matches-source short-circuit — it has its own
	 * delete-when-synced branch. It stops being exported once `publish` moves
	 * into the module (aureliushq/kobun#55).
	 */
	async function writeDraft(input: SaveInput): Promise<WriteDraftResult> {
		const existing = await findDraft(input)
		if (!input.source && !existing) return { code: "not-found", ok: false }

		if (existing) {
			if (input.expectedRevision !== existing.revision) {
				return { code: "revision-conflict", ok: false }
			}
			if (
				existing.markdown === input.markdown &&
				existing.metadata !== null &&
				canonicalMetadata(JSON.parse(existing.metadata)) ===
					canonicalMetadata(input.fields)
			) {
				return { draft: existing, ok: true, outcome: "unchanged" }
			}
			const [updated] = await db
				.update(editorDraft)
				.set({
					itemSlug: input.source?.itemSlug ?? existing.itemSlug,
					markdown: input.markdown,
					metadata: JSON.stringify(input.fields),
					revision: sql`${editorDraft.revision} + 1`,
				})
				.where(
					and(
						eq(editorDraft.id, existing.id),
						eq(editorDraft.projectId, project.id),
						eq(editorDraft.revision, existing.revision),
					),
				)
				.returning()
			if (!updated) return { code: "revision-conflict", ok: false }
			return { draft: updated, ok: true, outcome: "saved" }
		}

		invariant(
			input.source,
			"a source is required when creating a draft for an existing item",
		)
		if (input.expectedRevision !== null) {
			return { code: "revision-conflict", ok: false }
		}
		try {
			const [created] = await db
				.insert(editorDraft)
				.values({
					collectionSlug,
					id: crypto.randomUUID(),
					itemSlug: input.source.itemSlug,
					markdown: input.markdown,
					metadata: JSON.stringify(input.fields),
					projectId: project.id,
					publishedRevision: 0,
					revision: 1,
					sourcePath: input.source.path,
					sourceSha: input.source.sha,
				})
				.returning()
			return { draft: created, ok: true, outcome: "saved" }
		} catch (error) {
			// Another session created this item's Draft between our read and our
			// insert; the unique index on (projectId, sourcePath) reports the race.
			if (
				error instanceof Error &&
				error.message.toLowerCase().includes("unique")
			) {
				return { code: "revision-conflict", ok: false }
			}
			throw error
		}
	}

	/**
	 * Persist the writer's content as the Draft. Content that already matches the
	 * Source needs no Draft at all: short-circuiting keeps a no-op autosave from
	 * inflating the Revision and triggering spurious conflicts elsewhere.
	 */
	async function save(input: SaveInput): Promise<SaveResult> {
		if (matchesSource(input)) {
			const existing = await findDraft(input)
			const expected = existing?.revision ?? null
			if (input.expectedRevision !== expected) {
				return { code: "revision-conflict", ok: false }
			}
			return {
				draftId: existing?.id ?? null,
				ok: true,
				outcome: "matches-source",
				revision: existing?.revision ?? null,
			}
		}
		return writeDraft(input)
	}

	return { save, writeDraft }
}
