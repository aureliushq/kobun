import { eq } from "drizzle-orm"
import invariant from "tiny-invariant"
import { expandFeatures } from "@/config/features"
import { collectionSchema, singletonSchema } from "@/config/schema"
import type { Collection, Singleton } from "@/config/types"
import {
	editorDraft,
	githubInstallation,
	project,
} from "@/db/schema/app-schema"
import { user } from "@/db/schema/auth-schema"
import { createInMemoryDb } from "@/db/testing"
import { createDrafts, createSingletonDrafts } from "./create-drafts.server"
import type {
	SourceFile,
	SourceStore,
	SourceWriteInput,
	SourceWriteResult,
} from "./source-store"
import type { DraftRow, DraftsDatabase } from "./types"

export interface FakeSourceStore extends SourceStore {
	/** The stored Source file, for asserting on what a write left behind. */
	get(path: string): SourceFile | undefined
	/** Seed or replace a Source file, minting a sha when none is given. */
	put(file: { content: string; path: string; sha?: string }): SourceFile
	/** Make the next write to `path` report a stale sha, whatever it carries. */
	setStale(path: string): void
}

/**
 * A Map standing in for the repository. GitHub is always faked — it is our own
 * narrow port — while the database never is.
 */
export function createFakeSourceStore(
	seed: SourceFile[] = [],
): FakeSourceStore {
	const files = new Map<string, SourceFile>()
	const stale = new Set<string>()
	let shas = 0

	function put(file: { content: string; path: string; sha?: string }) {
		const stored: SourceFile = {
			content: file.content,
			name: file.path.slice(file.path.lastIndexOf("/") + 1),
			path: file.path,
			sha: file.sha ?? `sha-${++shas}`,
		}
		files.set(stored.path, stored)
		return stored
	}

	for (const file of seed) put(file)

	return {
		get: (path: string) => files.get(path),
		list: async (path: string) =>
			[...files.values()].filter(
				(file) =>
					file.path.startsWith(`${path}/`) &&
					!file.path.slice(path.length + 1).includes("/"),
			),
		put,
		setStale: (path: string) => {
			stale.add(path)
		},
		write: async (input: SourceWriteInput): Promise<SourceWriteResult> => {
			const existing = files.get(input.path)
			if (stale.delete(input.path)) return { ok: false, reason: "stale-sha" }
			// A write whose expected sha names a version that is no longer there —
			// or names one where the file has gone — is the stale precondition.
			if (
				input.expectedSha !== undefined &&
				existing?.sha !== input.expectedSha
			) {
				return { ok: false, reason: "stale-sha" }
			}
			// Creating over a file that exists is a caller bug, not a conflict:
			// GitHub rejects it as unprocessable, and the adapter rethrows that.
			invariant(
				input.expectedSha !== undefined || !existing,
				`${input.path} already exists; a write must carry its sha`,
			)
			const written = put({ content: input.content, path: input.path })
			return {
				commitSha: `commit-${written.sha}`,
				contentSha: written.sha,
				ok: true,
			}
		},
	}
}

export interface DraftsTestHarness {
	close(): void
	/** The same handle the module holds, so spies on it are seen by the module. */
	db: DraftsDatabase
	drafts: ReturnType<typeof createDrafts>
	projectId: string
	/** The Draft as it now stands, for asserting on what a transition wrote. */
	readDraft(id: string): Promise<DraftRow | undefined>
	seedDraft(values: Partial<DraftRow>): DraftRow
	sourceStore: FakeSourceStore
}

export const TEST_COLLECTION_SLUG = "posts"
export const TEST_DIRECTORY_PATH = "content/posts"

/** A title, a slug derived from it, and a body. */
const TEST_SCHEMA = {
	content: { label: "Content", type: "document" },
	slug: { from: "title", label: "Slug", type: "slug" },
	title: { label: "Title", type: "text" },
}

/**
 * A Collection as the config layer hands one over: parsed through the real
 * schema and expanded, so a fixture cannot drift from a legal Config and the
 * Managed Fields carry the markers the real ones carry.
 */
function resolveCollection(authored: unknown): Collection {
	const { collection, errors } = expandFeatures(
		collectionSchema.parse(authored),
	)
	invariant(
		collection,
		`the test collection must expand: ${JSON.stringify(errors)}`,
	)
	return collection
}

/** A minimal collection, no Features enabled. */
export const TEST_COLLECTION: Collection = resolveCollection({
	format: "md",
	label: "Posts",
	schema: TEST_SCHEMA,
})

/**
 * The same collection with every Feature on, so its schema carries all four
 * Managed Fields: `createdAt`, `updatedAt`, `publishedAt` and `status`.
 */
export const TEST_COLLECTION_WITH_FEATURES: Collection = resolveCollection({
	features: { publish: true, timestamps: { createdAt: true, updatedAt: true } },
	format: "md",
	label: "Posts",
	schema: TEST_SCHEMA,
})

/**
 * Timestamps on, `publish` off: the Collection that has no Publication State to
 * declare, and for which Save to GitHub is the only path to the repository.
 */
export const TEST_COLLECTION_WITHOUT_PUBLISH: Collection = resolveCollection({
	features: { timestamps: { createdAt: true, updatedAt: true } },
	format: "md",
	label: "Posts",
	schema: TEST_SCHEMA,
})

export const TEST_SINGLETON_SLUG = "about"
export const TEST_SINGLETON_PATH = "content/singletons/about.md"

/** A Singleton with a title and a body, and no Slug to derive. */
export const TEST_SINGLETON: Singleton = singletonSchema.parse({
	format: "md",
	label: "About",
	schema: {
		content: { label: "Content", type: "document" },
		title: { label: "Title", type: "text" },
	},
})

/** A data-only Singleton: its Source is Data and nothing else. */
export const TEST_DATA_SINGLETON: Singleton = singletonSchema.parse({
	format: "json",
	label: "Site",
	schema: { title: { label: "Title", type: "text" } },
})

export interface SingletonDraftsTestHarness
	extends Omit<DraftsTestHarness, "drafts"> {
	drafts: ReturnType<typeof createSingletonDrafts>
}

/**
 * The project, the database and the repository every harness stands on, with
 * `seedDraft` filling in whose Draft a row is.
 */
function createHarnessBase(options: {
	files?: SourceFile[]
	seedDefaults: Partial<DraftRow>
}): Omit<DraftsTestHarness, "drafts"> {
	const { close, db: sqliteDb } = createInMemoryDb()
	const projectId = "project-1"

	sqliteDb
		.insert(user)
		.values({ email: "writer@example.com", id: "user-1", name: "Writer" })
		.run()
	sqliteDb
		.insert(githubInstallation)
		.values({
			githubInstallationId: "1",
			id: "installation-1",
			repositorySelection: "all",
			targetAvatarUrl: "https://example.com/avatar.png",
			targetHtmlUrl: "https://github.com/acme",
			targetId: "1",
			targetLogin: "acme",
		})
		.run()
	sqliteDb
		.insert(project)
		.values({
			configPath: "kobun.config.ts",
			configStatus: "valid",
			id: projectId,
			installationId: "installation-1",
			repoHtmlUrl: "https://github.com/acme/blog",
			repoId: "1",
			repoName: "blog",
			repoOwnerLogin: "acme",
			status: "active",
			userId: "user-1",
		})
		.run()

	// The schema is real and the SQL is the subject under test; only the driver
	// differs from production, so the module keeps its exact D1 type.
	const db = sqliteDb as unknown as DraftsDatabase
	const sourceStore = createFakeSourceStore(options.files)
	let drafts = 0

	return {
		close,
		db,
		projectId,
		readDraft: (id: string) =>
			db.query.editorDraft.findFirst({ where: eq(editorDraft.id, id) }),
		seedDraft: (values: Partial<DraftRow>) => {
			const [row] = sqliteDb
				.insert(editorDraft)
				.values({
					...options.seedDefaults,
					id: `draft-${++drafts}`,
					markdown: "",
					projectId,
					revision: 0,
					...values,
				})
				.returning()
				.all()
			return row
		},
		sourceStore,
	}
}

export function createDraftsTestHarness(
	options: {
		collection?: Collection
		files?: SourceFile[]
		/** What the module reads as the current time when it stamps a value. */
		now?: () => Date
	} = {},
): DraftsTestHarness {
	const base = createHarnessBase({
		files: options.files,
		seedDefaults: { collectionSlug: TEST_COLLECTION_SLUG },
	})
	return {
		...base,
		drafts: createDrafts({
			collection: options.collection ?? TEST_COLLECTION,
			collectionSlug: TEST_COLLECTION_SLUG,
			db: base.db,
			directoryPath: TEST_DIRECTORY_PATH,
			now: options.now,
			project: { id: base.projectId },
			sourceStore: base.sourceStore,
		}),
	}
}

/**
 * The same world, driving a Singleton's Drafts. A seeded Draft is the
 * Singleton's and sits at its fixed path unless the test says otherwise.
 */
export function createSingletonDraftsTestHarness(
	options: {
		filePath?: string
		files?: SourceFile[]
		now?: () => Date
		singleton?: Singleton
	} = {},
): SingletonDraftsTestHarness {
	const filePath = options.filePath ?? TEST_SINGLETON_PATH
	const base = createHarnessBase({
		files: options.files,
		seedDefaults: {
			collectionSlug: null,
			singletonSlug: TEST_SINGLETON_SLUG,
			sourcePath: filePath,
		},
	})
	return {
		...base,
		drafts: createSingletonDrafts({
			db: base.db,
			filePath,
			now: options.now,
			project: { id: base.projectId },
			singleton: options.singleton ?? TEST_SINGLETON,
			singletonSlug: TEST_SINGLETON_SLUG,
			sourceStore: base.sourceStore,
		}),
	}
}
