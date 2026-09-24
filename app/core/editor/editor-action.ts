import type { OpenedContent } from "@/core/editor/collection-item-editor"
import type { FieldRecord } from "@/core/editor/collection-metadata"
import type { DraftRefusal } from "@/core/editor/drafts"
import type {
	CommitResult,
	OpenResult,
	SaveResult,
} from "@/core/editor/drafts/types"
import { EditorActionIntents } from "@/ui/lib/types"

/**
 * What every editor route answers the editor with. The editor posts the same
 * payload and reads the same responses whichever entity it is editing, so the
 * shapes live here once rather than in each route.
 */

const STALE_SOURCE_MESSAGE =
	"This item changed on GitHub. Copy your draft or discard it before reloading."

/** Why the drafts module refused a request, as the editor is told it. */
export type EditorRefusalCode = DraftRefusal["code"]

const REFUSAL_CODES: Record<EditorRefusalCode, true> = {
	"duplicate-slug": true,
	"not-found": true,
	"revision-conflict": true,
	"stale-source": true,
	validation: true,
}

function refusalMessage(refusal: DraftRefusal) {
	switch (refusal.code) {
		case "duplicate-slug":
			return `Another item already uses slug “${refusal.slug}”`
		case "not-found":
			return "Draft not found"
		case "revision-conflict":
			return "Draft changed in another session"
		case "stale-source":
			return STALE_SOURCE_MESSAGE
		case "validation":
			return refusal.errors.join("\n")
	}
}

const REFUSAL_STATUS: Record<EditorRefusalCode, number> = {
	"duplicate-slug": 409,
	"not-found": 404,
	"revision-conflict": 409,
	"stale-source": 409,
	validation: 422,
}

/**
 * The module's refusal code -> HTTP map (ADR-0001), the only one the routes
 * own. Every refusal answers in the same shape, so the editor reads one error
 * the same way whichever intent and whichever gate produced it — and names its
 * code, because a status is shared by refusals the editor must tell apart: a
 * Revision Conflict is a normal outcome, a duplicate Slug is not (#166).
 */
export function draftRefusalResponse(refusal: DraftRefusal) {
	return Response.json(
		{ code: refusal.code, error: refusalMessage(refusal), ok: false },
		{ status: REFUSAL_STATUS[refusal.code] },
	)
}

/** The refusal code a response named, if it named one this editor knows. */
export function readRefusalCode(value: unknown): EditorRefusalCode | null {
	return typeof value === "string" && Object.hasOwn(REFUSAL_CODES, value)
		? (value as EditorRefusalCode)
		: null
}

/**
 * A request the editor sent that did not go through, keeping the refusal's
 * code where the server named one. A dropped connection or a proxy's error
 * page has none.
 */
export class EditorActionError extends Error {
	readonly code: EditorRefusalCode | null

	constructor(message: string, code: EditorRefusalCode | null = null) {
		super(message)
		this.name = "EditorActionError"
		this.code = code
	}
}

/** What the header is told about a request that did not go through. */
export interface EditorSaveError {
	code: EditorRefusalCode | null
	message: string
}

export function toEditorSaveError(
	error: unknown,
	fallback: string,
): EditorSaveError {
	return {
		code: error instanceof EditorActionError ? error.code : null,
		message: error instanceof Error ? error.message : fallback,
	}
}

/** The half of `open`'s answer the editor actually opens with. */
export function openedContent(
	opened: Extract<OpenResult, { ok: true }>,
): OpenedContent {
	return {
		content: opened.content,
		draftId: opened.draftId,
		fields: opened.fields,
		revision: opened.revision,
		dirty: opened.dirty,
	}
}

interface EditorActionPayload {
	/**
	 * The Fields as the editor last saw the server hold them. Only an editor
	 * addressed by a position — a Singleton's row — has a use for it.
	 */
	baseFields: FieldRecord | null
	draftId?: string | null
	expectedRevision: number | null
	intent: EditorActionIntents
	markdown: string
	fields: FieldRecord
}

function isFieldRecord(value: unknown): value is FieldRecord {
	return !!value && typeof value === "object" && !Array.isArray(value)
}

export async function readEditorActionPayload(
	request: Request,
): Promise<EditorActionPayload> {
	const value = (await request.json()) as Partial<EditorActionPayload>
	if (
		(value.intent !== EditorActionIntents.SAVE &&
			value.intent !== EditorActionIntents.COMMIT &&
			value.intent !== EditorActionIntents.PUBLISH) ||
		typeof value.markdown !== "string" ||
		!isFieldRecord(value.fields)
	) {
		throw new Response("Invalid editor action", { status: 400 })
	}
	return {
		baseFields: isFieldRecord(value.baseFields) ? value.baseFields : null,
		draftId: typeof value.draftId === "string" ? value.draftId : null,
		expectedRevision:
			typeof value.expectedRevision === "number"
				? value.expectedRevision
				: null,
		intent: value.intent,
		markdown: value.markdown,
		fields: value.fields,
	}
}

/** The answer to a save, whether or not it kept anything. */
export function saveResponse(saved: SaveResult) {
	if (!saved.ok) return draftRefusalResponse(saved)
	// Nothing was kept, so there is no Draft to name and no Revision to move on
	// to: the content matched the Source, or nobody has typed into the new item
	// yet.
	if (saved.outcome === "matches-source" || saved.outcome === "unwritten") {
		return Response.json({
			ok: true,
			commitSha: null,
			draftId: saved.draftId,
			revision: saved.revision,
		})
	}
	return Response.json({
		ok: true,
		draftId: saved.draft.id,
		revision: saved.draft.revision,
	})
}

/** Where the editor goes once a commit lands, when anywhere. */
interface CommitNavigation {
	collectionPath?: string
	itemPath?: string
}

/** The answer to a commit that got past every gate. */
export function commitResponse(
	committed: Extract<CommitResult<string | null>, { ok: true }>,
	{ collectionPath, itemPath }: CommitNavigation,
) {
	if (committed.outcome === "matches-source") {
		return Response.json({
			ok: true,
			commitSha: null,
			draftDeleted: true,
			draftId: committed.draftId,
			collectionPath,
		})
	}
	// The Data as it was committed, so the properties panel reflects what the
	// system stamped without a reload. A Save to GitHub leaves the writer in the
	// editor, so state holding pre-stamp values would read as Dirty against the
	// Source it just created.
	if (committed.outcome === "committed-unsynced") {
		return Response.json({
			ok: true,
			commitSha: committed.commitSha,
			draftId: committed.draftId,
			draftSynced: false,
			collectionPath,
			fields: committed.fields,
			itemPath,
		})
	}
	return Response.json({
		ok: true,
		commitSha: committed.commitSha,
		draftDeleted: committed.draftDeleted,
		draftId: committed.draftId,
		revision: committed.revision,
		collectionPath,
		fields: committed.fields,
		itemPath,
	})
}
