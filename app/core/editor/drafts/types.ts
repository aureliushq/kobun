import type { DrizzleD1Database } from "drizzle-orm/d1"
import type {
	Collection,
	Format,
	ResolvedField,
	Singleton,
} from "@/config/types"
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
	/** The Slug a Collection Item answers to; a Singleton has none. */
	itemSlug: string | null
	path: string
	/**
	 * The Source's bytes as they stand. Handed to the serializer, which decides
	 * for itself what may be re-emitted untouched; how it does that is no
	 * caller's business (ADR-0002).
	 */
	raw: string
	sha: string
}

export interface DraftsContext {
	collection: Collection
	collectionSlug: string
	db: DraftsDatabase
	/** Where this collection's Source files live in the repository. */
	directoryPath: string
	/**
	 * The current time, for the values the system stamps into content. Injected
	 * so a test can say what "now" is rather than race the wall clock.
	 */
	now?: () => Date
	project: { id: string }
	sourceStore: SourceStore
}

/** A Singleton's Drafts, at the one path its Source lives at. */
export interface SingletonDraftsContext {
	db: DraftsDatabase
	/** The Singleton's Source file, whether or not it exists yet. */
	filePath: string
	now?: () => Date
	project: { id: string }
	singleton: Singleton
	singletonSlug: string
	sourceStore: SourceStore
}

/** Whose Draft a row is: a Collection's or a Singleton's, never both. */
export type DraftOwner =
	| { collectionSlug: string; singletonSlug: null }
	| { collectionSlug: null; singletonSlug: string }

/** Where a commit of some content lands, and what is wrong with landing there. */
export interface CommitAddress<ItemSlug extends string | null> {
	errors: string[]
	itemSlug: ItemSlug
	path: string
}

/**
 * What the lifecycle needs from the thing its Drafts belong to. The transitions
 * never ask which one they hold: a Collection Item is addressed by a Slug that
 * has rules to break and a directory to collide in, a Singleton by one fixed
 * path that has neither — and that difference lives here, not in them.
 */
export interface DraftEntity<ItemSlug extends string | null> {
	/**
	 * Where these fields would be committed. `errors` are the address's own
	 * structural gates, which both commit actions refuse on (ADR-0008).
	 */
	address(
		fields: FieldRecord,
		source: ResolvedSource | null,
	): CommitAddress<ItemSlug>
	/** Another Source already at this address, which a commit would destroy. */
	collision(
		address: CommitAddress<ItemSlug>,
		source: ResolvedSource | null,
	): Promise<Extract<DraftRefusal, { code: "duplicate-slug" }> | null>
	format: Format
	owner: DraftOwner
	schema: Record<string, ResolvedField>
}

/**
 * The item a transition addresses, before any Source has been located: a new
 * item carries the Draft it is typing into, an existing one the Slug it is
 * addressed by. Locating the Source from a Slug is the module's business, so
 * every entry point takes the same target.
 */
export type DraftTarget =
	| { draftId: string | null; mode: "new" }
	| { mode: "item"; slug: string }

export type OpenInput = DraftTarget

export type OpenResult =
	/**
	 * What the editor opens with, Effective Content already decided. A new item
	 * opens on nothing but its schema defaults: it has no Draft until the writer
	 * writes something, so `draftId` and `revision` are null until then.
	 */
	| {
			content: string
			draftId: string | null
			fields: FieldRecord
			ok: true
			revision: number | null
			/** Absent for a new item, which has no Source until it is committed. */
			source: ResolvedSource | null
			/**
			 * Whether the Draft holds work the Source lacks — **Dirty**, and the
			 * glossary's word for it. Reported here rather than left to the
			 * caller because a Clean Draft still has a row, so the presence of
			 * one says nothing about whether the repository is behind.
			 */
			dirty: boolean
	  }
	| { code: "not-found"; ok: false }

/** What the writer typed, and the Revision they typed it against. */
export interface DraftContent {
	expectedRevision: number | null
	fields: FieldRecord
	markdown: string
}

export type SaveInput = DraftContent & DraftTarget

/**
 * What the core transitions take: the same content, against a Source already
 * located. Locating it from a Slug is a collection-specific layer above them,
 * so the transitions themselves stay general over "a Draft and its Source".
 */
export interface ResolvedSaveInput extends DraftContent {
	draftId: string | null
	source: ResolvedSource | null
	/**
	 * The path the Draft is keyed by: the Source's when there is one, and a
	 * Singleton's fixed path even while its Source does not exist yet.
	 */
	sourcePath: string | null
}

export type WriteDraftResult =
	| { draft: DraftRow; ok: true; outcome: "saved" | "unchanged" }
	| { code: "not-found" | "revision-conflict"; ok: false }

export type SaveResult =
	| WriteDraftResult
	/** A Body sent for a data-only Format, which has nowhere to hold one. */
	| Extract<DraftRefusal, { code: "validation" }>
	/** The content the Source already holds: nothing to keep that it doesn't. */
	| {
			draftId: string | null
			ok: true
			outcome: "matches-source"
			revision: number | null
	  }
	/** A new item nobody has written into: there is no Draft, and no need for one. */
	| { draftId: null; ok: true; outcome: "unwritten"; revision: null }

/** Committing carries the same content a save does; only the target differs. */
export type CommitInput = SaveInput

/**
 * Which of the two commit paths this is. Both write the Draft's content to its
 * Source; only Publish also declares the item published, and it is the only
 * thing that writes Publication State (ADR-0008).
 */
export type CommitAction = "commit" | "publish"

/**
 * A transition the module refused. Every gate reports itself, so the caller can
 * tell a writer what to fix without re-deriving it. Save reaches for a subset of
 * these codes; one union keeps callers to a single map.
 */
export type DraftRefusal =
	| { code: "duplicate-slug"; ok: false; slug: string }
	| { code: "not-found" | "revision-conflict" | "stale-source"; ok: false }
	| { code: "validation"; errors: string[]; ok: false }

export type CommitResult<ItemSlug extends string | null = string> =
	| DraftRefusal
	/** The content already matched the Source: the Draft is gone, nothing was committed. */
	| { draftId: string; itemSlug: ItemSlug; ok: true; outcome: "matches-source" }
	/** Committed and synced; the Draft is deleted unless a later save left it Dirty. */
	| {
			commitSha?: string
			draftDeleted: boolean
			draftId: string
			/**
			 * The Data as it was committed, stamps included. A Save to GitHub leaves
			 * the writer in the editor, so the caller needs what landed rather than
			 * what it sent — state holding pre-stamp values would read as Dirty
			 * against the Source the commit just created.
			 */
			fields: FieldRecord
			itemSlug: ItemSlug
			ok: true
			outcome: "committed"
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
			fields: FieldRecord
			itemSlug: ItemSlug
			ok: true
			outcome: "committed-unsynced"
	  }
