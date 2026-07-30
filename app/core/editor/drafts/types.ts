import type { DrizzleD1Database } from "drizzle-orm/d1"
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
}

export interface DraftsContext {
	collectionSlug: string
	db: DraftsDatabase
	project: { id: string }
	sourceStore: SourceStore
}

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
