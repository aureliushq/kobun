import invariant from "tiny-invariant"
import { afterEach, expect, test } from "vitest"
import { parseDocument } from "@/core/content/document.server"
import type { ContentDirectory } from "@/core/project-context"
import { stringifyFrontmatter } from "@/lib/frontmatter"
import { createDrafts } from "./create-drafts.server"
import {
	createDraftsTestHarness,
	type DraftsTestHarness,
	TEST_COLLECTION_WITH_FEATURES,
} from "./test-harness"
import type { CommitInput, DraftContent } from "./types"

/**
 * A Subcollection's items go through the same Draft lifecycle as a
 * Collection's, in the directory beside their Parent Item's file (ADR-0012) —
 * and their Drafts are owned by the Collection, the Parent Item and the
 * Subcollection together (#182).
 */

const CREATED = "2026-10-07T09:00:00.000Z"
const FIELDS = { slug: "launch", title: "Launch" }

function updatesOf(parentItem: string): ContentDirectory {
	return {
		collection: TEST_COLLECTION_WITH_FEATURES,
		collectionSlug: "projects",
		directoryPath: `content/projects/${parentItem}/updates`,
		parentItem,
		subcollectionKey: "updates",
	}
}

const ACME_UPDATES = updatesOf("acme")
const LAUNCH_PATH = "content/projects/acme/updates/launch.md"

let harness: DraftsTestHarness

function setup() {
	harness = createDraftsTestHarness({
		directory: ACME_UPDATES,
		now: () => new Date(CREATED),
	})
	return harness
}

/** The same project and repository, driving another content directory's Drafts. */
function draftsOver(directory: ContentDirectory) {
	return createDrafts({
		...directory,
		db: harness.db,
		now: () => new Date(CREATED),
		project: { id: harness.projectId },
		sourceStore: harness.sourceStore,
	})
}

const CONTENT: DraftContent = {
	expectedRevision: null,
	fields: FIELDS,
	markdown: "Body\n",
}

function newItem(draftId: string | null = null): CommitInput {
	return { ...CONTENT, draftId, mode: "new" }
}

function putUpdate(path: string, data: Record<string, unknown> = FIELDS) {
	return harness.sourceStore.put({
		content: stringifyFrontmatter("Body\n", data),
		path,
	})
}

afterEach(() => {
	harness?.close()
})

test("a new item's Draft records the Collection, Parent Item and Subcollection", async () => {
	const { drafts } = setup()

	const saved = await drafts.save(newItem())

	invariant(saved.ok && saved.outcome === "saved", "the first save mints")
	expect(await harness.readDraft(saved.draft.id)).toMatchObject({
		collectionSlug: "projects",
		parentItem: "acme",
		singletonSlug: null,
		subcollectionKey: "updates",
	})
})

test("commits a new item beside its Parent Item's file and deletes the Draft", async () => {
	const { drafts } = setup()
	const saved = await drafts.save(newItem())
	invariant(saved.ok && saved.outcome === "saved", "the first save mints")

	const result = await drafts.commit({
		...newItem(saved.draft.id),
		expectedRevision: saved.draft.revision,
	})

	expect(result).toMatchObject({
		draftDeleted: true,
		itemSlug: "launch",
		ok: true,
		outcome: "committed",
	})
	expect(harness.sourceStore.get(LAUNCH_PATH)).toBeDefined()
	expect(await harness.readDraft(saved.draft.id)).toBeUndefined()
})

test("publishes a new item beside its Parent Item's file", async () => {
	const { drafts } = setup()

	const result = await drafts.publish(newItem())

	expect(result).toMatchObject({ ok: true, outcome: "committed" })
	const committed = harness.sourceStore.get(LAUNCH_PATH)
	expect(parseDocument(committed?.content ?? "", "md").data).toMatchObject({
		status: "published",
	})
})

test("opens and edits an existing item by its Slug", async () => {
	const { drafts } = setup()
	putUpdate(LAUNCH_PATH)

	const opened = await drafts.open({ mode: "item", slug: "launch" })

	expect(opened).toMatchObject({ ok: true, source: { path: LAUNCH_PATH } })
})

test("refuses a Slug another item of the same Parent Item's Subcollection holds", async () => {
	const { drafts } = setup()
	putUpdate(LAUNCH_PATH)

	const result = await drafts.commit(newItem())

	expect(result).toEqual({ code: "duplicate-slug", ok: false, slug: "launch" })
})

test("allows a Slug another Parent Item's Subcollection holds", async () => {
	setup()
	putUpdate("content/projects/globex/updates/launch.md")

	const result = await harness.drafts.commit(newItem())

	expect(result).toMatchObject({ ok: true, outcome: "committed" })
	expect(harness.sourceStore.get(LAUNCH_PATH)).toBeDefined()
})

// A `?draft=` id is only good under the Parent Item and Subcollection it was
// minted under: anywhere else it names a Draft this directory does not hold.
test("does not open a new item's Draft under another Parent Item or Subcollection", async () => {
	const { drafts } = setup()
	const saved = await drafts.save(newItem())
	invariant(saved.ok && saved.outcome === "saved", "the first save mints")
	const draft = { draftId: saved.draft.id, mode: "new" } as const

	expect(await draftsOver(updatesOf("globex")).open(draft)).toEqual({
		code: "not-found",
		ok: false,
	})
	expect(
		await draftsOver({ ...ACME_UPDATES, subcollectionKey: "notes" }).open(
			draft,
		),
	).toEqual({ code: "not-found", ok: false })
	expect(
		await draftsOver({
			collection: TEST_COLLECTION_WITH_FEATURES,
			collectionSlug: "projects",
			directoryPath: "content/projects",
		}).open(draft),
	).toEqual({ code: "not-found", ok: false })
	expect(await drafts.open(draft)).toMatchObject({ ok: true })
})

test("refuses a commit whose Source moved on GitHub", async () => {
	const { drafts } = setup()
	putUpdate(LAUNCH_PATH)
	harness.seedDraft({
		committedRevision: 1,
		itemSlug: "launch",
		metadata: JSON.stringify(FIELDS),
		revision: 2,
		sourcePath: LAUNCH_PATH,
		sourceSha: "sha-the-draft-was-built-on",
	})

	const result = await drafts.commit({
		...CONTENT,
		expectedRevision: 2,
		fields: { ...FIELDS, title: "Typed" },
		mode: "item",
		slug: "launch",
	})

	expect(result).toEqual({ code: "stale-source", ok: false })
})

test("refuses a save carrying a stale expected Revision", async () => {
	const { drafts } = setup()
	const source = putUpdate(LAUNCH_PATH)
	harness.seedDraft({
		committedRevision: 1,
		itemSlug: "launch",
		markdown: "a",
		revision: 3,
		sourcePath: LAUNCH_PATH,
		sourceSha: source.sha,
	})

	const result = await drafts.save({
		...CONTENT,
		expectedRevision: 2,
		mode: "item",
		slug: "launch",
	})

	expect(result).toEqual({ code: "revision-conflict", ok: false })
})
