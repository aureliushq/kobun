import { and, eq, isNull, sql } from "drizzle-orm"
import type { SQLiteColumn } from "drizzle-orm/sqlite-core"
import invariant from "tiny-invariant"
import { canonicalMetadata } from "@/core/content"
import { serializeDocument } from "@/core/content/document.server"
import {
	findCollectionItemBySlug,
	isMarkdownCollectionFile,
} from "@/core/editor/collection-items.server"
import {
	applyMetadataDefaults,
	type FieldRecord,
	getSlugField,
	validateMetadata,
} from "@/core/editor/collection-metadata"
import { editorDraft } from "@/db/schema/app-schema"
import { isDraftDirty } from "./draft-state"
import type {
	DraftRow,
	DraftsContext,
	OpenInput,
	OpenResult,
	PublishInput,
	PublishResult,
	ResolvedSaveInput,
	ResolvedSource,
	SaveInput,
	SaveResult,
	WriteDraftResult,
} from "./types"

/** A Slug has to survive being a filename in the repository. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i

/**
 * Guard a nullable column against the value we read from it. `= NULL` matches
 * nothing in SQL, so an unpublished Draft needs `IS NULL` where a published one
 * needs an equality.
 */
function eqOrNull(column: SQLiteColumn, value: string | number | null) {
	return value === null ? isNull(column) : eq(column, value)
}

/** Where a commit landed: the Source the Draft is now reconciled against. */
interface CommittedSource {
	itemSlug: string
	path: string
	sha: string
}

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

	/** What a new item's Fields hold before anyone has typed into them. */
	const defaultFields = applyMetadataDefaults(collection.schema, {})

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

	function findDraft(input: ResolvedSaveInput) {
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

	function matchesSource(input: ResolvedSaveInput) {
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
	 * Both `save` and `publish` land here, but neither delegates the whole
	 * transition to it: each has its own answer for content that already matches
	 * the Source.
	 *
	 * This is also where a new item's Draft comes into existence — on the first
	 * save that carries something, not on opening the editor.
	 */
	async function writeDraft(
		input: ResolvedSaveInput,
	): Promise<WriteDraftResult> {
		const existing = await findDraft(input)
		// The caller named a Draft this collection no longer holds: discarded from
		// the dashboard, or published out from another session.
		if (!input.source && !existing && input.draftId) {
			return { code: "not-found", ok: false }
		}

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

		if (input.expectedRevision !== null) {
			return { code: "revision-conflict", ok: false }
		}
		try {
			const [created] = await db
				.insert(editorDraft)
				.values({
					collectionSlug,
					id: crypto.randomUUID(),
					itemSlug: input.source?.itemSlug ?? null,
					markdown: input.markdown,
					metadata: JSON.stringify(input.fields),
					projectId: project.id,
					// A new item has never been published, which is what leaves it
					// Dirty; an existing item's first Draft starts level with its Source.
					publishedRevision: input.source ? 0 : null,
					revision: 1,
					sourcePath: input.source?.path ?? null,
					sourceSha: input.source?.sha ?? null,
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
	 * Whether this save has nothing to mint a Draft from: it addresses a new item
	 * that has no Draft yet — no Source, no id — and carries nothing the schema
	 * did not put there itself. A Draft is what keeps the writer's work, so there
	 * is nothing to keep until there is work; minting one on sight is what filled
	 * the dashboard with empty Drafts. Fields the caller left out are defaulted
	 * first, so "untouched" means the same thing however completely they spelled
	 * the record.
	 */
	function hasNothingToMint(input: ResolvedSaveInput) {
		return (
			input.source === null &&
			input.draftId === null &&
			input.markdown.trim() === "" &&
			canonicalMetadata(
				applyMetadataDefaults(collection.schema, input.fields),
			) === canonicalMetadata(defaultFields)
		)
	}

	/**
	 * Persist the writer's content as the Draft. Content that already matches the
	 * Source needs no Draft at all: short-circuiting keeps a no-op autosave from
	 * inflating the Revision and triggering spurious conflicts elsewhere. Neither
	 * does a new item the writer has not written into.
	 */
	async function saveResolved(input: ResolvedSaveInput): Promise<SaveResult> {
		if (hasNothingToMint(input)) {
			return { draftId: null, ok: true, outcome: "unwritten", revision: null }
		}
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

	/** The Slug these fields name, which is what the item will be addressed by. */
	function effectiveSlug(fields: FieldRecord) {
		const slugField = getSlugField(collection.schema)
		return slugField ? String(fields[slugField] ?? "").trim() : ""
	}

	/**
	 * Everything that must hold before a Draft may reach the repository, reported
	 * together so the writer sees every problem at once rather than one per
	 * attempt.
	 */
	function validatePublish(input: ResolvedSaveInput, slug: string) {
		const errors = validateMetadata(collection.schema, input.fields)
		const documentRequired = Object.values(collection.schema).some(
			(field) => field.type === "document" && field.required,
		)
		if (documentRequired && !input.markdown.trim()) {
			errors.push("Document content is required")
		}
		// The Slug becomes a filename, so it is constrained beyond being present.
		if (!slug || !SLUG_PATTERN.test(slug)) {
			errors.push("Slug must be a valid nonempty filename slug")
		}
		return errors
	}

	/**
	 * Whether some other item in this collection already answers to `slug`. A
	 * Collection Item is addressed by its Slug, so committing over a taken one
	 * would publish this Draft on top of someone else's item.
	 */
	async function isSlugTaken(slug: string, source: ResolvedSource | null) {
		const files = await sourceStore.list(directoryPath)
		return files.filter(isMarkdownCollectionFile).some((file) => {
			if (source && file.path === source.path) return false
			return findCollectionItemBySlug(collection, [file], slug) !== null
		})
	}

	/**
	 * Mark the Draft as published at the Source the commit created. Guarded on
	 * everything the commit assumed — the Revision it published, the Source
	 * version it built on — so a session that saved while we were committing is
	 * not silently marked as published.
	 */
	async function syncDraft(draft: DraftRow, source: CommittedSource) {
		const [synced] = await db
			.update(editorDraft)
			.set({
				itemSlug: source.itemSlug,
				publishedAt: new Date(),
				publishedRevision: draft.revision,
				sourcePath: source.path,
				sourceSha: source.sha,
			})
			.where(
				and(
					eq(editorDraft.id, draft.id),
					eq(editorDraft.projectId, project.id),
					eq(editorDraft.revision, draft.revision),
					eqOrNull(editorDraft.sourceSha, draft.sourceSha),
					eqOrNull(editorDraft.publishedRevision, draft.publishedRevision),
				),
			)
			.returning()
		return synced
	}

	/**
	 * Point a Draft the sync could not claim at the Source the commit created.
	 * Its Revisions are another session's business now — all we owe it is the sha
	 * we committed, so its next save is not refused against a version that is
	 * gone. Guarded on the Source the commit built on, so a third publish landing
	 * in between keeps its own result.
	 */
	async function repointDraft(
		draft: DraftRow,
		expectedSha: string | null,
		source: CommittedSource,
	) {
		await db
			.update(editorDraft)
			.set({
				itemSlug: source.itemSlug,
				sourcePath: source.path,
				sourceSha: source.sha,
			})
			.where(
				and(
					eq(editorDraft.id, draft.id),
					eq(editorDraft.projectId, project.id),
					eqOrNull(editorDraft.sourceSha, expectedSha),
				),
			)
	}

	/** Drop a Draft at the Revision we believe it is at, and say whether it went. */
	async function deleteDraft(draft: DraftRow) {
		const [deleted] = await db
			.delete(editorDraft)
			.where(
				and(
					eq(editorDraft.id, draft.id),
					eq(editorDraft.projectId, project.id),
					eq(editorDraft.revision, draft.revision),
				),
			)
			.returning({ id: editorDraft.id })
		return deleted !== undefined
	}

	/** Drop a Draft the Source has caught up with; the Source alone remains. */
	async function deleteSyncedDraft(draft: DraftRow) {
		const [deleted] = await db
			.delete(editorDraft)
			.where(
				and(
					eq(editorDraft.id, draft.id),
					eq(editorDraft.projectId, project.id),
					eq(editorDraft.revision, draft.revision),
					eq(editorDraft.publishedRevision, draft.revision),
				),
			)
			.returning({ id: editorDraft.id })
		return deleted !== undefined
	}

	/**
	 * Commit the writer's content and reconcile the Draft with what landed. Every
	 * gate has passed by the time this runs; what is left is the chain that must
	 * not come apart — commit, sync, delete-when-Synced (ADR-0001).
	 */
	async function commit(
		input: ResolvedSaveInput,
		draft: DraftRow,
		itemSlug: string,
	): Promise<PublishResult> {
		const { source } = input
		// A new item has no Source yet, so its Slug decides where it lands.
		const path =
			source?.path ?? `${directoryPath}/${itemSlug}.${collection.format}`
		const committed = await sourceStore.write({
			// The Source's own bytes go to the serializer, which re-emits the
			// frontmatter block untouched when the Data is unchanged; a new item has
			// none to preserve. The Format is the Collection's, not the file's:
			// writing is what puts the extension on `path` above, so the same
			// declaration has to decide the bytes that go under it.
			content: serializeDocument(
				{ body: input.markdown, data: input.fields },
				collection.format,
				source ? { raw: source.raw } : undefined,
			),
			expectedSha: source?.sha,
			message: `${source ? "Update" : "Create"} ${path} with Kobun`,
			path,
		})
		if (!committed.ok) return { code: "stale-source", ok: false }

		const published: CommittedSource = {
			itemSlug,
			path,
			sha: committed.contentSha,
		}
		const synced = await syncDraft(draft, published)
		if (!synced) {
			await repointDraft(draft, source?.sha ?? null, published)
			return {
				commitSha: committed.commitSha,
				draftId: draft.id,
				itemSlug,
				ok: true,
				outcome: "published-unsynced",
			}
		}
		const draftDeleted = await deleteSyncedDraft(synced)
		return {
			commitSha: committed.commitSha,
			draftDeleted,
			draftId: draft.id,
			itemSlug,
			ok: true,
			outcome: "published",
			revision: draftDeleted ? null : draft.revision,
		}
	}

	/**
	 * Commit a Draft to its Source and reconcile the two. Every gate the writer
	 * can fail — invalid metadata, a missing required document, a Slug that is
	 * empty, malformed, or already taken, a Source that moved underneath them —
	 * is reported as a typed refusal, never thrown, because none of them is a bug
	 * (ADR-0001). What follows the gates is a chain that must not be split across
	 * a seam: commit, sync the Draft to what landed, and delete it once the Source
	 * has caught up.
	 */
	async function publishResolved(
		input: ResolvedSaveInput,
	): Promise<PublishResult> {
		// The writer's content is persisted before any gate runs: a publish we
		// refuse must still keep what they typed.
		const written = await writeDraft(input)
		if (!written.ok) return written

		const slug = effectiveSlug(input.fields)
		const errors = validatePublish(input, slug)
		if (errors.length) return { code: "validation", errors, ok: false }
		if (await isSlugTaken(slug, input.source)) {
			return { code: "duplicate-slug", ok: false, slug }
		}

		const draft = written.draft
		// The Draft was built on a version of the Source that is no longer there:
		// publishing would drop whatever replaced it.
		if (
			input.source &&
			draft.sourceSha &&
			draft.sourceSha !== input.source.sha
		) {
			return { code: "stale-source", ok: false }
		}

		// Content the Source already holds needs no commit — and no Draft. Skipping
		// it keeps a publish the writer changed nothing in out of the history.
		if (matchesSource(input)) {
			if (!(await deleteDraft(draft))) {
				return { code: "revision-conflict", ok: false }
			}
			return {
				draftId: draft.id,
				itemSlug: slug,
				ok: true,
				outcome: "matches-source",
			}
		}
		return commit(input, draft, slug)
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
		if (!draftId) {
			// An empty editor, and no Draft to show it from: the first save that
			// carries something mints one, and the caller adopts the id it returns.
			return {
				content: "",
				draftId: null,
				fields: defaultFields,
				ok: true,
				revision: null,
				source: null,
			}
		}

		const draft = await findNewItemDraft(draftId)
		if (!draft) return { code: "not-found", ok: false }
		return {
			content: draft.markdown,
			draftId: draft.id,
			fields: draftFields(draft, defaultFields),
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
	 * Hand the editor everything it opens with. Opening mints nothing: a new item
	 * opens on its schema defaults, and an existing item's Draft is reconciled
	 * against its Source — rebased when the Source moved under a Clean Draft, left
	 * alone when the Draft is Dirty. The content is already the Effective Content,
	 * so callers never interpret dirtiness themselves.
	 */
	async function open(input: OpenInput): Promise<OpenResult> {
		if (input.mode === "new") return openNewItem(input.draftId)
		const source = await resolveSource(input.slug)
		if (!source) return { code: "not-found", ok: false }
		return openSource(source)
	}

	/**
	 * Locate what the caller addressed. A new item has no Source until it is
	 * published; an existing one is named by a Slug this collection may no longer
	 * hold, which is the one thing resolution can fail at.
	 */
	async function resolveTarget(
		input: SaveInput,
	): Promise<ResolvedSaveInput | null> {
		const content = {
			expectedRevision: input.expectedRevision,
			fields: input.fields,
			markdown: input.markdown,
		}
		if (input.mode === "new") {
			return { ...content, draftId: input.draftId, source: null }
		}
		const source = await resolveSource(input.slug)
		return source ? { ...content, draftId: null, source } : null
	}

	/**
	 * Persist the writer's content as the Draft for the item they addressed. The
	 * Source is resolved here rather than by the caller, so the transition always
	 * reconciles against the version of the Source that is there now.
	 */
	async function save(input: SaveInput): Promise<SaveResult> {
		const resolved = await resolveTarget(input)
		if (!resolved) return { code: "not-found", ok: false }
		return saveResolved(resolved)
	}

	/** Commit the Draft for the item the caller addressed to its Source. */
	async function publish(input: PublishInput): Promise<PublishResult> {
		const resolved = await resolveTarget(input)
		if (!resolved) return { code: "not-found", ok: false }
		return publishResolved(resolved)
	}

	return { open, publish, save }
}
