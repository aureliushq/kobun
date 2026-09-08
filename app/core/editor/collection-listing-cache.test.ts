import { and, eq } from "drizzle-orm"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import type { RepositoryAddress } from "@/core/project-context"
import {
	collectionListing,
	githubInstallation,
	project,
} from "@/db/schema/app-schema"
import { user } from "@/db/schema/auth-schema"
import { createInMemoryDb } from "@/db/testing"
import { ConfigStatus, ProjectStatus } from "@/db/types"
import {
	COLLECTION_LISTING_CACHE_TTL_MS,
	createCollectionListingCache,
	invalidateCollectionListing,
	withListingInvalidation,
} from "./collection-listing-cache.server"
import type {
	CollectionListingDatabase,
	CollectionListingRead,
	CollectionListingRequest,
	CollectionListingSource,
	CollectionSourceFile,
} from "./collection-listing-source"
import { createFakeSourceStore } from "./drafts/test-harness"

const NOW = new Date("2026-09-07T12:00:00.000Z")
const DIRECTORY = "content/posts"
const PROJECT_ID = "project-1"
const REPOSITORY: RepositoryAddress = {
	installationId: "1",
	name: "blog",
	owner: "acme",
}

function post(title: string) {
	return `---\ntitle: ${title}\n---\n\nBody of ${title}.\n`
}

/** Every call the module made, in order — and which half of the port cost it. */
type SourceCall =
	| ({ kind: "read" } & CollectionListingRequest)
	| { kind: "files"; path: string }

interface FakeListingSource extends CollectionListingSource {
	calls: SourceCall[]
	/** The next `read` throws rather than answering — an outage, not a 404. */
	failNext(error: unknown): void
	/** The next `files` throws: the cheap half answered, the expensive one did not. */
	failNextFiles(error: unknown): void
	/** Write a file, as a new revision: its sha and the directory's ETag change. */
	put(path: string, name: string, content: string): void
	remove(path: string, name: string): void
	/** The directory itself goes away, which is a 404 rather than an empty one. */
	removeDirectory(path: string): void
	/** Rotate the ETag over a directory whose files never changed. */
	touch(path: string): void
}

/**
 * The repository's directories, in a Map. Fetching one is somebody else's port
 * — what this module does with the answer, and how rarely it asks, is the
 * subject under test, so the port is faked and the database never is.
 */
function createFakeListingSource(
	initial: Record<string, Record<string, string>> = {
		[DIRECTORY]: { "first.md": post("First"), "second.md": post("Second") },
	},
): FakeListingSource {
	const calls: SourceCall[] = []
	const directories = new Map<
		string,
		{ etag: string; files: Map<string, { content: string; sha: string }> }
	>()
	let revisions = 0
	let failure: { error: unknown } | null = null
	let filesFailure: { error: unknown } | null = null

	function directory(path: string) {
		const existing = directories.get(path)
		if (existing) return existing
		const created = { etag: `"etag-0"`, files: new Map() }
		directories.set(path, created)
		return created
	}

	function put(path: string, name: string, content: string) {
		const revision = ++revisions
		const dir = directory(path)
		dir.files.set(name, { content, sha: `sha-${revision}` })
		dir.etag = `"etag-${revision}"`
	}

	for (const [path, files] of Object.entries(initial)) {
		for (const [name, content] of Object.entries(files))
			put(path, name, content)
	}

	return {
		calls,
		failNext: (error: unknown) => {
			failure = { error }
		},
		failNextFiles: (error: unknown) => {
			filesFailure = { error }
		},
		files: async (
			_repository: RepositoryAddress,
			path: string,
		): Promise<CollectionSourceFile[]> => {
			calls.push({ kind: "files", path })
			if (filesFailure) {
				const { error } = filesFailure
				filesFailure = null
				throw error
			}
			const dir = directories.get(path)
			if (!dir) throw new Error(`no directory at ${path}`)
			return [...dir.files.entries()].map(([name, file]) => ({
				content: file.content,
				name,
				path: `${path}/${name}`,
				sha: file.sha,
			}))
		},
		put,
		read: async (
			_repository: RepositoryAddress,
			request: CollectionListingRequest,
		): Promise<CollectionListingRead> => {
			calls.push({ ...request, kind: "read" })
			if (failure) {
				const { error } = failure
				failure = null
				throw error
			}
			const dir = directories.get(request.path)
			if (!dir) return { kind: "not-found" }
			if (request.etag && request.etag === dir.etag)
				return { kind: "not-modified" }
			return {
				entries: [...dir.files.entries()].map(([name, file]) => ({
					name,
					sha: file.sha,
				})),
				etag: dir.etag,
				kind: "entries",
			}
		},
		remove: (path: string, name: string) => {
			const dir = directories.get(path)
			if (!dir) return
			dir.files.delete(name)
			dir.etag = `"etag-${++revisions}"`
		},
		removeDirectory: (path: string) => {
			directories.delete(path)
		},
		touch: (path: string) => {
			const dir = directories.get(path)
			if (dir) dir.etag = `"etag-${++revisions}"`
		},
	}
}

interface Harness {
	close(): void
	db: CollectionListingDatabase
	listings: ReturnType<typeof createCollectionListingCache>
	readRow(
		directoryPath?: string,
		projectId?: string,
	): typeof collectionListing.$inferSelect | undefined
	seedProject(id: string, userId?: string): void
	seedRow(values: {
		checkedAt: Date
		directoryPath?: string
		entriesHash?: string
		etag?: string | null
		items: string
		projectId?: string
	}): void
	source: FakeListingSource
}

function createHarness(): Harness {
	const { close, db: sqliteDb } = createInMemoryDb()

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

	function seedProject(id: string, userId = "user-1") {
		sqliteDb
			.insert(project)
			.values({
				configPath: ".kobun.json",
				configStatus: ConfigStatus.PRESENT,
				id,
				installationId: "installation-1",
				repoHtmlUrl: "https://github.com/acme/blog",
				repoId: id,
				repoName: "blog",
				repoOwnerLogin: "acme",
				status: ProjectStatus.ACTIVE,
				userId,
			})
			.run()
	}
	seedProject(PROJECT_ID)

	const db = sqliteDb as unknown as CollectionListingDatabase
	const source = createFakeListingSource()

	return {
		close,
		db,
		listings: createCollectionListingCache({ db, listingSource: source }),
		readRow: (directoryPath = DIRECTORY, projectId = PROJECT_ID) =>
			sqliteDb
				.select()
				.from(collectionListing)
				.where(
					and(
						eq(collectionListing.projectId, projectId),
						eq(collectionListing.directoryPath, directoryPath),
					),
				)
				.get(),
		seedProject,
		seedRow: (values) => {
			sqliteDb
				.insert(collectionListing)
				.values({
					checkedAt: values.checkedAt,
					directoryPath: values.directoryPath ?? DIRECTORY,
					entriesHash: values.entriesHash ?? "hash-seeded",
					etag: values.etag ?? null,
					items: values.items,
					projectId: values.projectId ?? PROJECT_ID,
				})
				.run()
		},
		source,
	}
}

let harness: Harness

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(NOW)
	harness = createHarness()
})

afterEach(() => {
	harness?.close()
	vi.useRealTimers()
})

function resolve(directoryPath = DIRECTORY, projectId = PROJECT_ID) {
	return harness.listings.resolve({ id: projectId }, REPOSITORY, directoryPath)
}

test("reads the directory once and remembers what it parsed", async () => {
	const items = await resolve()

	expect(items).toEqual([
		{
			data: { title: "First" },
			name: "first.md",
			path: `${DIRECTORY}/first.md`,
			sha: "sha-1",
		},
		{
			data: { title: "Second" },
			name: "second.md",
			path: `${DIRECTORY}/second.md`,
			sha: "sha-2",
		},
	])
	expect(harness.source.calls).toEqual([
		{ etag: null, kind: "read", path: DIRECTORY },
		{ kind: "files", path: DIRECTORY },
	])
	expect(harness.readRow()).toMatchObject({
		checkedAt: NOW,
		etag: `"etag-2"`,
	})
})

test("serves a listing checked a moment ago without asking GitHub", async () => {
	await resolve()
	harness.source.calls.length = 0

	const items = await resolve()

	expect(items).toHaveLength(2)
	expect(harness.source.calls).toEqual([])
})

test("still serves from the row a moment before the window closes", async () => {
	await resolve()
	harness.source.calls.length = 0
	vi.setSystemTime(NOW.getTime() + COLLECTION_LISTING_CACHE_TTL_MS - 1)

	await resolve()

	expect(harness.source.calls).toEqual([])
})

test("revalidates once the window has closed, carrying the stored ETag", async () => {
	await resolve()
	harness.source.calls.length = 0
	vi.setSystemTime(NOW.getTime() + COLLECTION_LISTING_CACHE_TTL_MS)

	await resolve()

	expect(harness.source.calls).toEqual([
		{ etag: `"etag-2"`, kind: "read", path: DIRECTORY },
	])
})

test("revalidates a row whose last check is in the future", async () => {
	harness.seedRow({
		checkedAt: new Date(NOW.getTime() + 60_000),
		items: JSON.stringify([]),
	})

	await resolve()

	expect(harness.source.calls[0]).toMatchObject({ kind: "read" })
})

test("asks unconditionally when the row holds no listing it can parse", async () => {
	harness.seedRow({ checkedAt: NOW, etag: `"etag-2"`, items: "not json" })
	vi.setSystemTime(NOW.getTime() + COLLECTION_LISTING_CACHE_TTL_MS)

	await resolve()

	expect(harness.source.calls[0]).toEqual({
		etag: null,
		kind: "read",
		path: DIRECTORY,
	})
})

test("spends no text read when GitHub reports the directory unchanged", async () => {
	await resolve()
	const before = harness.readRow()
	harness.source.calls.length = 0
	vi.setSystemTime(NOW.getTime() + COLLECTION_LISTING_CACHE_TTL_MS)

	const items = await resolve()

	expect(items).toHaveLength(2)
	expect(harness.source.calls).toEqual([
		{ etag: `"etag-2"`, kind: "read", path: DIRECTORY },
	])
	expect(harness.readRow()).toMatchObject({
		entriesHash: before?.entriesHash,
		etag: before?.etag,
		items: before?.items,
	})
})

test("an unchanged directory reopens the window rather than revalidating on every hover", async () => {
	await resolve()
	vi.setSystemTime(NOW.getTime() + COLLECTION_LISTING_CACHE_TTL_MS)
	await resolve()
	harness.source.calls.length = 0

	await resolve()

	expect(harness.source.calls).toEqual([])
})

test("spends no text read when a rotated ETag turns out to be the same directory", async () => {
	await resolve()
	const before = harness.readRow()
	harness.source.touch(DIRECTORY)
	harness.source.calls.length = 0
	vi.setSystemTime(NOW.getTime() + COLLECTION_LISTING_CACHE_TTL_MS)

	const items = await resolve()

	expect(items).toHaveLength(2)
	expect(harness.source.calls).toEqual([
		{ etag: `"etag-2"`, kind: "read", path: DIRECTORY },
	])
	const after = harness.readRow()
	expect(after?.etag).not.toBe(before?.etag)
	expect(after?.items).toBe(before?.items)
})

test("re-parses and rewrites the row when the directory changed", async () => {
	await resolve()
	const before = harness.readRow()
	harness.source.put(DIRECTORY, "third.md", post("Third"))
	vi.setSystemTime(NOW.getTime() + COLLECTION_LISTING_CACHE_TTL_MS)

	const items = await resolve()

	expect(items).toHaveLength(3)
	const after = harness.readRow()
	expect(after?.entriesHash).not.toBe(before?.entriesHash)
	expect(after?.items).not.toBe(before?.items)
})

test("serves the cached listing when the repository is unreachable, and writes nothing", async () => {
	await resolve()
	const before = harness.readRow()
	vi.setSystemTime(NOW.getTime() + COLLECTION_LISTING_CACHE_TTL_MS)
	harness.source.failNext(new Error("API rate limit exceeded"))

	const items = await resolve()

	expect(items).toHaveLength(2)
	expect(harness.readRow()).toEqual(before)
})

test("rejects when the repository is unreachable and nothing is cached", async () => {
	harness.source.failNext(new Error("API rate limit exceeded"))

	await expect(resolve()).rejects.toThrow("API rate limit exceeded")
	expect(harness.readRow()).toBeUndefined()
})

test("rejects when the text read fails after the entries came back", async () => {
	harness.source.failNextFiles(new Error("API rate limit exceeded"))

	await expect(resolve()).rejects.toThrow("API rate limit exceeded")
	expect(harness.readRow()).toBeUndefined()
})

test("rejects rather than answering an empty Collection when a file will not parse", async () => {
	harness.source.put(
		DIRECTORY,
		"broken.md",
		"---\ntitle: [unclosed\n---\nbody\n",
	)

	await expect(resolve()).rejects.toThrow()
	expect(harness.readRow()).toBeUndefined()
})

test("a file that will not parse does not replace a listing that already stood", async () => {
	await resolve()
	const before = harness.readRow()
	harness.source.put(
		DIRECTORY,
		"broken.md",
		"---\ntitle: [unclosed\n---\nbody\n",
	)
	vi.setSystemTime(NOW.getTime() + COLLECTION_LISTING_CACHE_TTL_MS)

	await expect(resolve()).rejects.toThrow()
	expect(harness.readRow()).toEqual(before)
})

test("an absent directory is an empty Collection, and is not remembered", async () => {
	harness.source.removeDirectory(DIRECTORY)

	expect(await resolve()).toEqual([])
	expect(harness.readRow()).toBeUndefined()
	expect(await resolve()).toEqual([])
	expect(harness.source.calls).toEqual([
		{ etag: null, kind: "read", path: DIRECTORY },
		{ etag: null, kind: "read", path: DIRECTORY },
	])
})

test("a directory holding nothing kobun can list caches as an empty listing", async () => {
	harness.source.remove(DIRECTORY, "first.md")
	harness.source.remove(DIRECTORY, "second.md")
	harness.source.put(DIRECTORY, "cover.png", "not markdown")

	expect(await resolve()).toEqual([])
	harness.source.calls.length = 0

	expect(await resolve()).toEqual([])
	expect(harness.source.calls).toEqual([])
})

test("only md and mdx entries become items", async () => {
	harness.source.put(DIRECTORY, "notes.txt", "plain text")
	harness.source.put(DIRECTORY, "third.mdx", post("Third"))

	const items = await resolve()

	expect(items.map((item) => item.name)).toEqual([
		"first.md",
		"second.md",
		"third.mdx",
	])
})

test("invalidating drops the row, so the next resolve reads GitHub again", async () => {
	await resolve()
	harness.source.calls.length = 0

	await invalidateCollectionListing(harness.db, PROJECT_ID, DIRECTORY)

	expect(harness.readRow()).toBeUndefined()
	await resolve()
	expect(harness.source.calls).toEqual([
		{ etag: null, kind: "read", path: DIRECTORY },
		{ kind: "files", path: DIRECTORY },
	])
})

test("invalidating one directory leaves another Project's listing of it alone", async () => {
	harness.seedProject("project-2", "user-1")
	await resolve()
	await resolve(DIRECTORY, "project-2")

	await invalidateCollectionListing(harness.db, PROJECT_ID, DIRECTORY)

	expect(harness.readRow(DIRECTORY, PROJECT_ID)).toBeUndefined()
	expect(harness.readRow(DIRECTORY, "project-2")).toBeDefined()
})

test("two Projects over the same directory keep their own rows", async () => {
	harness.seedProject("project-2", "user-1")

	await resolve()
	await resolve(DIRECTORY, "project-2")

	expect(harness.readRow(DIRECTORY, PROJECT_ID)).toBeDefined()
	expect(harness.readRow(DIRECTORY, "project-2")).toBeDefined()
})

test("two loaders revalidating the same directory at once leave one coherent row", async () => {
	const [first, second] = await Promise.all([resolve(), resolve()])

	expect(first).toEqual(second)
	expect(harness.readRow()).toBeDefined()
})

test("disconnecting the Project takes its cached listings with it", async () => {
	await resolve()

	harness.db.delete(project).where(eq(project.id, PROJECT_ID)).run()

	expect(harness.readRow()).toBeUndefined()
})

test("a committed write forgets the directory it landed in", async () => {
	const store = createFakeSourceStore([
		{
			content: post("First"),
			name: "first.md",
			path: `${DIRECTORY}/first.md`,
			sha: "sha-1",
		},
	])
	const forgotten: number[] = []
	const wrapped = withListingInvalidation(store, async () => {
		forgotten.push(1)
	})

	const result = await wrapped.write({
		content: post("Second"),
		message: "Create with Kobun",
		path: `${DIRECTORY}/second.md`,
	})

	expect(result.ok).toBe(true)
	expect(forgotten).toHaveLength(1)
})

test("a refused write changed nothing, so it forgets nothing", async () => {
	const store = createFakeSourceStore([
		{
			content: post("First"),
			name: "first.md",
			path: `${DIRECTORY}/first.md`,
			sha: "sha-1",
		},
	])
	store.setStale(`${DIRECTORY}/first.md`)
	const forgotten: number[] = []
	const wrapped = withListingInvalidation(store, async () => {
		forgotten.push(1)
	})

	const result = await wrapped.write({
		content: post("Changed"),
		expectedSha: "sha-1",
		message: "Update with Kobun",
		path: `${DIRECTORY}/first.md`,
	})

	expect(result).toEqual({ ok: false, reason: "stale-sha" })
	expect(forgotten).toEqual([])
})

test("listing through the wrapped store is passed straight through", async () => {
	const store = createFakeSourceStore([
		{
			content: post("First"),
			name: "first.md",
			path: `${DIRECTORY}/first.md`,
			sha: "sha-1",
		},
	])
	const wrapped = withListingInvalidation(store, async () => {})

	expect(await wrapped.list(DIRECTORY)).toEqual(await store.list(DIRECTORY))
})
