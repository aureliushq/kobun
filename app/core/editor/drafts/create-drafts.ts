import { and, eq, isNull, sql } from "drizzle-orm"
import invariant from "tiny-invariant"
import {
	findCollectionItemBySlug,
	isMarkdownCollectionFile,
} from "@/core/editor/collection-items.server"
import {
	applyMetadataDefaults,
	canonicalMetadata,
	type FieldRecord,
} from "@/core/editor/collection-metadata"
import { isDraftDirty } from "@/core/editor/drafts"
import { editorDraft } from "@/db/schema/app-schema"
import type {
	DraftRow,
	DraftsContext,
	OpenInput,
	OpenResult,
	ResolvedSource,
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
	const {
		collection,
		collectionSlug,
		db,
		directoryPath,
		project,
		sourceStore,
	} = context

	function findDraftBySourcePath(sourcePath: string) {
		return db.query.editorDraft.findFirst({
			where: and(
				eq(editorDraft.projectId, project.id),
				eq(editorDraft.sourcePath, sourcePath),
			),
		})
	}

	function findNewItemDraft(draftId: string) {
		return db.query.editorDraft.findFirst({
			where: and(
				eq(editorDraft.id, draftId),
				eq(editorDraft.projectId, project.id),
				eq(editorDraft.collectionSlug, collectionSlug),
				isNull(editorDraft.sourcePath),
			),
		})
	}

	function findDraft(input: SaveInput) {
		// An existing item's Draft is identified by the Source it tracks; a new
		// item's Draft has no Source yet, so the caller carries its id.
		if (input.source) return findDraftBySourcePath(input.source.path)
		if (!input.draftId) return undefined
		return findNewItemDraft(input.draftId)
	}

	function draftFields(draft: DraftRow, fallback: FieldRecord): FieldRecord {
		return draft.metadata
			? (JSON.parse(draft.metadata) as FieldRecord)
			: fallback
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

	/**
	 * The Source a Slug names, or null when this collection holds no such item.
	 * Matching a Slug against a directory listing is collection-specific — the
	 * transition below is not.
	 */
	async function resolveSource(slug: string): Promise<ResolvedSource | null> {
		const files = await sourceStore.list(directoryPath)
		return findCollectionItemBySlug(
			collection,
			files.filter(isMarkdownCollectionFile),
			slug,
		)
	}

	/**
	 * Bring a Clean Draft up to a Source that moved underneath it. The guard
	 * carries both Revisions, so a session that saved between our read and our
	 * write keeps its work — we re-read to see what it left rather than
	 * reporting a conflict the writer can do nothing about.
	 */
	async function rebase(draft: DraftRow, source: ResolvedSource) {
		invariant(
			draft.publishedRevision !== null,
			"A synchronized draft must have a published revision",
		)
		const nextRevision = draft.revision + 1
		const [rebased] = await db
			.update(editorDraft)
			.set({
				markdown: source.body,
				metadata: null,
				publishedRevision: nextRevision,
				revision: nextRevision,
				sourceSha: source.sha,
			})
			.where(
				and(
					eq(editorDraft.id, draft.id),
					eq(editorDraft.projectId, project.id),
					eq(editorDraft.revision, draft.revision),
					eq(editorDraft.publishedRevision, draft.publishedRevision),
				),
			)
			.returning()
		if (rebased) return rebased
		return db.query.editorDraft.findFirst({
			where: eq(editorDraft.id, draft.id),
		})
	}

	async function openNewItem(draftId: string | null): Promise<OpenResult> {
		const defaults = applyMetadataDefaults(collection.schema, {})
		if (!draftId) {
			// A new item's Draft is minted on sight so that autosave has somewhere
			// to land from the writer's first keystroke.
			const [created] = await db
				.insert(editorDraft)
				.values({
					collectionSlug,
					id: crypto.randomUUID(),
					markdown: "",
					metadata: JSON.stringify(defaults),
					projectId: project.id,
					revision: 0,
				})
				.returning()
			// Nothing to display yet: the caller sends the writer to the new Draft,
			// which opens it for real.
			return { created: true, draftId: created.id, ok: true }
		}

		const draft = await findNewItemDraft(draftId)
		if (!draft) return { code: "not-found", ok: false }
		return {
			content: draft.markdown,
			created: false,
			draftId: draft.id,
			fields: draftFields(draft, defaults),
			ok: true,
			revision: draft.revision,
			source: null,
		}
	}

	/**
	 * Reconcile the Draft tracking a Source with that Source. Takes the Source
	 * already resolved, so whatever located it — a Slug here, a fixed path for a
	 * singleton — stays outside the transition.
	 */
	async function openSource(source: ResolvedSource): Promise<OpenResult> {
		let draft = await findDraftBySourcePath(source.path)
		if (draft && !isDraftDirty(draft) && draft.sourceSha !== source.sha) {
			draft = await rebase(draft, source)
		}

		// Effective Content: only a Dirty Draft holds anything the Source lacks.
		const dirty = draft && isDraftDirty(draft) ? draft : null
		return {
			content: dirty ? dirty.markdown : source.body,
			created: false,
			draftId: draft?.id ?? null,
			fields: dirty
				? draftFields(dirty, source.frontmatter)
				: source.frontmatter,
			ok: true,
			revision: draft?.revision ?? null,
			source,
		}
	}

	/**
	 * Hand the editor everything it opens with. A new item's Draft is minted
	 * here; an existing item's is reconciled against its Source — rebased when
	 * the Source moved under a Clean Draft, left alone when the Draft is Dirty —
	 * and the content is already the Effective Content, so callers never
	 * interpret dirtiness themselves.
	 */
	async function open(input: OpenInput): Promise<OpenResult> {
		if (input.mode === "new") return openNewItem(input.draftId)
		const source = await resolveSource(input.slug)
		if (!source) return { code: "not-found", ok: false }
		return openSource(source)
	}

	return { open, save, writeDraft }
}
