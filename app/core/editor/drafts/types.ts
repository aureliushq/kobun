import type { DrizzleD1Database } from "drizzle-orm/d1"
import type { Collection } from "@/config/types"
import type { FieldRecord } from "@/core/editor/collection-metadata"
import type * as schema from "@/db/schema"
import type { editorDraft } from "@/db/schema/app-schema"
import type { SourceStore } from "./source-store"

/**
 * Production runs on D1; tests run the same schema on in-memory SQLite and cast
 * to this type. The cast holds as long as the module sticks to plain queries:
 * never call `.batch()` or `.transaction()`, which differ between the drivers.
 */
export type DraftsDatabase = DrizzleD1Database<typeof schema>

export type DraftRow = typeof editorDraft.$inferSelect

/** A Source the caller has already located and parsed. */
export interface ResolvedSource {
	body: string
	frontmatter: FieldRecord
	itemSlug: string
	path: string
	sha: string
	/**
	 * The bytes preceding the Body — today's serializer re-emits them verbatim
	 * when the Data is unchanged. Leaves with the serializer (ADR-0002).
	 */
	sourcePrefix: string
}

export interface DraftsContext {
	collection: Collection
	collectionSlug: string
	db: DraftsDatabase
	/** Where this collection's Source files live in the repository. */
	directoryPath: string
	project: { id: string }
	sourceStore: SourceStore
}

export type OpenInput =
	| { draftId: string | null; mode: "new" }
	| { mode: "item"; slug: string }

export type OpenResult =
	/** A Draft was minted; the caller sends the writer to it to open it. */
	| { created: true; draftId: string; ok: true }
	/** What the editor opens with, Effective Content already decided. */
	| {
			content: string
			created: false
			draftId: string | null
			fields: FieldRecord
			ok: true
			revision: number | null
			/** Absent for a new item, which has no Source until it is published. */
			source: ResolvedSource | null
	  }
	| { code: "not-found"; ok: false }

export interface SaveInput {
	draftId: string | null
	expectedRevision: number | null
	fields: FieldRecord
	markdown: string
	source: ResolvedSource | null
}

export type WriteDraftResult =
	| { draft: DraftRow; ok: true; outcome: "saved" | "unchanged" }
	| { code: "not-found" | "revision-conflict"; ok: false }

export type SaveResult =
	| WriteDraftResult
	| {
			draftId: string | null
			ok: true
			outcome: "matches-source"
			revision: number | null
	  }

/** Publishing carries the same content a save does; only the intent differs. */
export type PublishInput = SaveInput

/**
 * A publish the module refused. Every gate reports itself, so the caller can
 * tell a writer what to fix without re-deriving it.
 */
export type PublishRefusal =
	| { code: "duplicate-slug"; ok: false; slug: string }
	| { code: "not-found" | "revision-conflict" | "stale-source"; ok: false }
	| { code: "validation"; errors: string[]; ok: false }

export type PublishResult =
	| PublishRefusal
	/** The content already matched the Source: the Draft is gone, nothing was committed. */
	| { draftId: string; itemSlug: string; ok: true; outcome: "matches-source" }
	/** Committed and synced; the Draft is deleted unless a later save left it Dirty. */
	| {
			commitSha?: string
			draftDeleted: boolean
			draftId: string
			itemSlug: string
			ok: true
			outcome: "published"
			revision: number | null
	  }
	/**
	 * Committed, but another session moved the Draft while we were committing, so
	 * the guarded sync missed it. The Draft survives, re-pointed at the Source the
	 * commit created, so the writer's next save doesn't conflict on a stale sha.
	 */
	| {
			commitSha?: string
			draftId: string
			itemSlug: string
			ok: true
			outcome: "published-unsynced"
	  }
