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

/**
 * The module's refusal code -> HTTP map (ADR-0001), the only one the routes
 * own. Every refusal answers in the same shape, so the editor reads one error
 * the same way whichever intent and whichever gate produced it.
 */
export function draftRefusalResponse(refusal: DraftRefusal) {
	switch (refusal.code) {
		case "duplicate-slug":
			return Response.json(
				{
					ok: false,
					error: `Another item already uses slug “${refusal.slug}”`,
				},
				{ status: 409 },
			)
		case "not-found":
			return Response.json(
				{ ok: false, error: "Draft not found" },
				{ status: 404 },
			)
		case "revision-conflict":
			return Response.json(
				{ ok: false, error: "Draft changed in another session" },
				{ status: 409 },
			)
		case "stale-source":
			return Response.json(
				{ ok: false, error: STALE_SOURCE_MESSAGE },
				{ status: 409 },
			)
		case "validation":
			return Response.json(
				{ ok: false, error: refusal.errors.join("\n") },
				{ status: 422 },
			)
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
	draftId?: string | null
	expectedRevision: number | null
	intent: EditorActionIntents
	markdown: string
	fields: FieldRecord
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
		!value.fields ||
		typeof value.fields !== "object" ||
		Array.isArray(value.fields)
	) {
		throw new Response("Invalid editor action", { status: 400 })
	}
	return {
		draftId: typeof value.draftId === "string" ? value.draftId : null,
		expectedRevision:
			typeof value.expectedRevision === "number"
				? value.expectedRevision
				: null,
		intent: value.intent,
		markdown: value.markdown,
		fields: value.fields as FieldRecord,
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
