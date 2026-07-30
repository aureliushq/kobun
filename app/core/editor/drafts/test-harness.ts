import invariant from "tiny-invariant"
import {
	editorDraft,
	githubInstallation,
	project,
} from "@/db/schema/app-schema"
import { user } from "@/db/schema/auth-schema"
import { createInMemoryDb } from "@/db/testing"
import { createDrafts } from "./create-drafts"
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
	seedDraft(values: Partial<DraftRow>): DraftRow
	sourceStore: FakeSourceStore
}

export const TEST_COLLECTION_SLUG = "posts"
export const TEST_DIRECTORY_PATH = "content/posts"

export function createDraftsTestHarness(
	options: { files?: SourceFile[] } = {},
): DraftsTestHarness {
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
		drafts: createDrafts({
			collectionSlug: TEST_COLLECTION_SLUG,
			db,
			project: { id: projectId },
			sourceStore,
		}),
		projectId,
		seedDraft: (values: Partial<DraftRow>) => {
			const [row] = sqliteDb
				.insert(editorDraft)
				.values({
					collectionSlug: TEST_COLLECTION_SLUG,
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
