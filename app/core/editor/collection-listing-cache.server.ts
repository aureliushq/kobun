import { and, eq } from "drizzle-orm"
import { parseDocument } from "@/core/content/document.server"
import type { RepositoryAddress } from "@/core/project-context"
import { collectionListing } from "@/db/schema/app-schema"
import {
	collectionFileFormat,
	isMarkdownCollectionFile,
} from "./collection-items.server"
import type {
	CollectionListingDatabase,
	CollectionListingEntry,
	CollectionListingRead,
	CollectionListingSource,
	CollectionSourceFile,
} from "./collection-listing-source"
import type { CollectionItem } from "./collection-table"
import type { SourceStore } from "./drafts/source-store"

/**
 * How long a listing is trusted without asking the repository again. A commit
 * made through kobun invalidates the directory it wrote into, so this bounds
 * only what changed on GitHub some other way — but there is no webhook, so it
 * is the staleness bound rather than an optimization knob (ADR-0003).
 */
export const COLLECTION_LISTING_CACHE_TTL_MS = 60_000

/**
 * How many changed files are read one request each before the whole directory
 * is read in one query instead. Bounded by the Workers subrequest limit (50 on
 * the free plan), which the rest of the request shares.
 */
export const INCREMENTAL_READ_LIMIT = 10

/** What deciding whether a stored listing can be served takes, and no more. */
type ListingRow = typeof collectionListing.$inferSelect

/**
 * A row that can be served, and what it parses to. The two travel together
 * because the row is only ever a validator on the strength of the listing it
 * would fall back on — separating them is how a `not-modified` ends up with
 * nothing to answer.
 */
interface Cached {
	items: CollectionItem[]
	row: ListingRow
}

/**
 * The repository answered "unchanged" to a question this module did not ask.
 * Unreachable by construction — an ETag is only ever sent alongside a listing
 * to fall back on — and a throw rather than an empty listing because the reader
 * being told their Collection is empty is the one wrong answer here.
 */
class UnvalidatedListingError extends Error {
	constructor(directoryPath: string) {
		super(
			`${directoryPath} was reported unchanged with nothing cached to serve`,
		)
		this.name = "UnvalidatedListingError"
	}
}

/**
 * The stored listing, if the row actually holds one.
 *
 * An **empty array is a listing** — a Collection nobody has written into yet —
 * so this is careful to tell `[]` apart from nothing cached at all. Everything
 * else, including a row written in a shape this version no longer recognises,
 * reads as nothing: unservable, and so never trusted as a validator either.
 */
function storedListing(items: string): CollectionItem[] | null {
	let parsed: unknown
	try {
		parsed = JSON.parse(items)
	} catch {
		return null
	}

	if (!Array.isArray(parsed)) return null
	const ok = parsed.every(
		(item) =>
			typeof item === "object" &&
			item !== null &&
			typeof item.name === "string" &&
			typeof item.path === "string" &&
			typeof item.sha === "string" &&
			typeof item.data === "object" &&
			item.data !== null,
	)
	return ok ? (parsed as CollectionItem[]) : null
}

/**
 * The directory's identity as one comparable string: every entry's name and
 * blob sha, sorted, hashed.
 *
 * Not the ETag alone, because GitHub computes a directory's ETag over a body
 * that carries a per-entry download URL — and on a private repository that URL
 * carries a short-lived token, so the validator can rotate over a directory
 * that never changed. A blob sha is content addressed and cannot. This is the
 * job `project.config_sha` does in ADR-0003, for the same reason: it is what
 * makes a rotated validator cost nothing.
 */
async function fingerprint(entries: CollectionListingEntry[]): Promise<string> {
	const canonical = entries
		.map(({ name, sha }) => `${name}:${sha}`)
		.sort()
		.join("\n")
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(canonical),
	)
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("")
}

/**
 * The listing, as the Collection page renders it. The Format comes from the
 * file rather than from `collection.format`, because a directory holds whatever
 * it holds (see `collectionFileFormat`).
 *
 * This throws on a Content Document kobun cannot parse, and is meant to: the
 * route hands its promise to `Await`, so the failure reaches that section's
 * error state. It runs before anything is written, so a broken file is never
 * remembered as an absence.
 */
function toItems(files: CollectionSourceFile[]): CollectionItem[] {
	return files.filter(isMarkdownCollectionFile).map((file) => ({
		data: parseDocument(file.content, collectionFileFormat(file)).data,
		name: file.name,
		path: file.path,
		sha: file.sha,
	}))
}

/**
 * What a fresh entry list changed against the row: the cached items it still
 * names at the same sha, by name — their parse is still the file's — and the
 * md/mdx entries that need reading (ADR 0012). Null when the whole directory is
 * cheaper to read in one query: nothing is cached, or more changed than is
 * worth a request each.
 */
function changedSince(
	entries: CollectionListingEntry[],
	cached: Cached | null,
): {
	changed: CollectionListingEntry[]
	kept: Map<string, CollectionItem>
} | null {
	if (!cached) return null
	const current = new Set(entries.map(({ name, sha }) => `${name}:${sha}`))
	const kept = new Map(
		cached.items
			.filter(({ name, sha }) => current.has(`${name}:${sha}`))
			.map((item) => [item.name, item]),
	)
	const changed = entries.filter(
		(entry) => isMarkdownCollectionFile(entry) && !kept.has(entry.name),
	)
	return changed.length > INCREMENTAL_READ_LIMIT ? null : { changed, kept }
}

/** The kept and freshly parsed items, in the order the directory lists them. */
function inEntryOrder(
	entries: CollectionListingEntry[],
	kept: Map<string, CollectionItem>,
	parsed: CollectionItem[],
): CollectionItem[] {
	const fresh = new Map(parsed.map((item) => [item.name, item]))
	return entries.flatMap(({ name }) => {
		const item = fresh.get(name) ?? kept.get(name)
		return item ? [item] : []
	})
}

/**
 * The Collection listing cache: a bounded copy of one directory, revalidated
 * conditionally, so that a reader sweeping the mouse down a sidebar of a dozen
 * Collections does not ask GitHub to read a dozen directories in full (#125).
 *
 * The port beneath it has two halves that cost different things. Everything
 * else — when to ask, when a fresh answer is worth the text behind it, what a
 * missing directory means, what to remember — is here.
 */
export function createCollectionListingCache(deps: {
	db: CollectionListingDatabase
	listingSource: CollectionListingSource
}) {
	const { db, listingSource } = deps

	/**
	 * One read, or the failure that stopped it. Only the port is guarded — a
	 * parse failure is not an unreachable repository and must never be answered
	 * with a stale listing or an empty one. A failed database write is a real
	 * failure and still propagates.
	 */
	async function guard<T>(
		run: () => Promise<T>,
	): Promise<{ ok: true; value: T } | { error: unknown; ok: false }> {
		try {
			return { ok: true, value: await run() }
		} catch (error) {
			return { error, ok: false }
		}
	}

	/**
	 * What to answer when the repository could not be reached. Serving the last
	 * listing we had is the whole point of holding one; with nothing held, the
	 * only true thing left to say is that we could not read it, so the failure
	 * travels on. An empty array would claim the Collection has no items, and
	 * the route would render exactly that instead of its unavailable state
	 * (ADR-0006). Nothing is written either way — the blip was never news about
	 * the repository, so the next request retries rather than the next window.
	 */
	function unreachable(
		cached: Cached | null,
		error: unknown,
	): CollectionItem[] {
		if (cached) return cached.items
		throw error
	}

	/** The window reopens, and nothing else about the row is news. */
	async function recordCheck(
		row: ListingRow,
		now: number,
		etag?: string | null,
	) {
		await db
			.update(collectionListing)
			.set({
				checkedAt: new Date(now),
				...(etag === undefined ? {} : { etag }),
			})
			.where(
				and(
					eq(collectionListing.projectId, row.projectId),
					eq(collectionListing.directoryPath, row.directoryPath),
				),
			)
	}

	async function remember(
		projectId: string,
		directoryPath: string,
		now: number,
		items: CollectionItem[],
		entriesHash: string,
		etag: string | null,
	) {
		// Not capped on size. A row holds Data and no Body, so a listing large
		// enough to trouble D1 would be thousands of items — and a Collection
		// that large cannot be read at all, because the query behind `files`
		// pulls every file's text into one response and GitHub gives out first.
		// A cap here would only add a state where the row is never written, so
		// the window never opens and every hover pays the full read for good.
		const values = {
			checkedAt: new Date(now),
			entriesHash,
			etag,
			items: JSON.stringify(items),
		}
		// One statement, so two loaders revalidating the same directory at once
		// cannot leave a half-written row — and no transaction, which the D1 and
		// SQLite drivers do not share.
		await db
			.insert(collectionListing)
			.values({ ...values, directoryPath, projectId })
			.onConflictDoUpdate({
				set: values,
				target: [collectionListing.projectId, collectionListing.directoryPath],
			})
	}

	async function revalidate(
		projectId: string,
		repository: RepositoryAddress,
		directoryPath: string,
		cached: Cached | null,
		now: number,
		failClosed = false,
	): Promise<CollectionItem[]> {
		// What an unreachable repository is answered with. A read that gates a
		// commit gets the failure instead of the row: a Slug checked against a
		// listing GitHub could not confirm is a check that did not happen.
		const fallback = failClosed ? null : cached
		// An ETag is only sent when there is a listing to fall back on. A
		// `not-modified` against a row holding nothing would pin this Collection
		// empty past every window (ADR-0003) — which is why the validator and
		// the listing it would fall back on are one value here, and cannot come
		// apart.
		const read = await guard<CollectionListingRead>(() =>
			listingSource.read(repository, {
				etag: cached?.row.etag ?? null,
				path: directoryPath,
			}),
		)
		if (!read.ok) return unreachable(fallback, read.error)

		if (read.value.kind === "not-modified") {
			// Nothing changed, so nothing is rewritten — but the window reopens, or
			// an unchanged directory would be revalidated on every hover.
			if (!cached) throw new UnvalidatedListingError(directoryPath)
			await recordCheck(cached.row, now)
			return cached.items
		}

		// A directory that is not there is a Collection nobody has written into
		// yet. It is deliberately not remembered: octokit reports a dead
		// installation's token exchange with the same 404, and writing that down
		// would tell a writer their Collection is empty for a whole window.
		if (read.value.kind === "not-found") return []

		const { entries, etag } = read.value
		const hash = await fingerprint(entries)
		// A rotated validator over a directory that never changed. Shas are
		// content addressed, so there is nothing to re-read and nothing to
		// re-parse — only the ETag worth sending next time.
		if (cached && hash === cached.row.entriesHash) {
			await recordCheck(cached.row, now, etag)
			return cached.items
		}

		// A file that changes between the entry list and its own read is stored
		// at the newer sha under the older hash. The next revalidation sees the
		// sha differ and reads it again, so this costs a read, never a wrong row.
		const delta = changedSince(entries, cached)
		const files = await guard(() =>
			delta
				? Promise.all(
						delta.changed.map((entry) =>
							listingSource.file(repository, `${directoryPath}/${entry.name}`),
						),
					)
				: listingSource.files(repository, directoryPath),
		)
		if (!files.ok) return unreachable(fallback, files.error)

		// Parsed before anything is written, so a file kobun cannot read rejects
		// rather than being remembered as an absence.
		const parsed = toItems(files.value)
		const items = delta ? inEntryOrder(entries, delta.kept, parsed) : parsed
		await remember(projectId, directoryPath, now, items, hash, etag)
		return items
	}

	async function readCached(
		projectId: string,
		directoryPath: string,
	): Promise<Cached | null> {
		const row = await db.query.collectionListing.findFirst({
			where: and(
				eq(collectionListing.projectId, projectId),
				eq(collectionListing.directoryPath, directoryPath),
			),
		})
		const items = row ? storedListing(row.items) : null
		return row && items ? { items, row } : null
	}

	async function resolve(
		project: { id: string },
		repository: RepositoryAddress,
		directoryPath: string,
	): Promise<CollectionItem[]> {
		const now = Date.now()
		const cached = await readCached(project.id, directoryPath)

		if (cached) {
			const age = now - cached.row.checkedAt.getTime()
			// A check time in the future is a clock disagreeing with ours, not a
			// recent check; without the floor such a row would never revalidate.
			if (age >= 0 && age < COLLECTION_LISTING_CACHE_TTL_MS) return cached.items
		}

		return await revalidate(project.id, repository, directoryPath, cached, now)
	}

	/**
	 * The listing as the repository holds it now, for a read that gates a commit
	 * (ADR 0012). The window is skipped, never the row: an unchanged directory
	 * still costs one conditional read and no text, and a changed one costs only
	 * the files that changed. An unreachable repository rejects rather than
	 * serving the row, so the gate fails closed.
	 */
	async function resolveCurrent(
		project: { id: string },
		repository: RepositoryAddress,
		directoryPath: string,
	): Promise<CollectionItem[]> {
		const cached = await readCached(project.id, directoryPath)
		return await revalidate(
			project.id,
			repository,
			directoryPath,
			cached,
			Date.now(),
			true,
		)
	}

	return { resolve, resolveCurrent }
}

/**
 * Forget one Collection's directory, because something wrote into it.
 *
 * A standalone function rather than a method on the factory, the same shape
 * `lastKnownConfig` takes: the commit path has a database handle and no use for
 * a listing source, and making it build one to throw away would be wiring for
 * nothing.
 *
 * It expires rather than deletes (ADR 0012). The next resolve revalidates, and
 * the items it keeps are what let it read only the file the write changed
 * instead of the whole directory again. The ETag is dropped: it is already
 * known to be stale, so it could only buy a 304 that cannot happen.
 */
export async function invalidateCollectionListing(
	db: CollectionListingDatabase,
	projectId: string,
	directoryPath: string,
): Promise<void> {
	await db
		.update(collectionListing)
		.set({ checkedAt: new Date(0), etag: null })
		.where(
			and(
				eq(collectionListing.projectId, projectId),
				eq(collectionListing.directoryPath, directoryPath),
			),
		)
}

/**
 * The same store, told to forget the directory it just wrote into.
 *
 * The hook goes here rather than in the route's publish branch because both
 * Save to GitHub and Publish reach the same write, and a third commit path
 * would reach it too — one place that cannot be forgotten instead of a line
 * each caller has to remember. The drafts module commits through a port and
 * knows nothing about who caches what (ADR-0001), and the GitHub adapter closes
 * over an installation and nothing else, so the one place that knows both is
 * where they are composed.
 *
 * A refused write changed nothing in the repository, so it forgets nothing.
 */
export function withListingInvalidation(
	store: SourceStore,
	forget: () => Promise<void>,
): SourceStore {
	return {
		// Called through rather than handed over, so the wrapped store keeps
		// whatever receiver its own implementation expects.
		read: (path) => store.read(path),
		write: async (input) => {
			const result = await store.write(input)
			// Awaited: a publish navigates straight to the Collection page, and the
			// row has to be gone before that loader reads it.
			if (result.ok) await forget()
			return result
		},
	}
}
