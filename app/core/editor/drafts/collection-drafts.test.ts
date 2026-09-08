import { afterEach, expect, test } from "vitest"
import { listCollectionDrafts } from "./collection-drafts"
import {
	createDraftsTestHarness,
	type DraftsTestHarness,
	TEST_COLLECTION,
	TEST_COLLECTION_SLUG,
	TEST_DIRECTORY_PATH,
} from "./test-harness"

const SOURCE_PATH = `${TEST_DIRECTORY_PATH}/hello.md`

let harness: DraftsTestHarness

function setup() {
	harness = createDraftsTestHarness()
	return harness
}

/** The Project the harness seeds, as this module addresses one. */
const PROJECT = {
	id: "project-1",
	repoName: "blog",
	repoOwnerLogin: "acme",
}

function list() {
	return listCollectionDrafts(
		harness.db,
		PROJECT,
		TEST_COLLECTION,
		TEST_COLLECTION_SLUG,
	)
}

afterEach(() => {
	harness?.close()
})

test("lists only the drafts of the collection it was asked about", async () => {
	const { seedDraft } = setup()
	seedDraft({ markdown: "Mine", revision: 1 })
	seedDraft({ collectionSlug: "pages", markdown: "Theirs", revision: 1 })

	expect((await list()).map((draft) => draft.heading)).toEqual(["Mine…"])
})

test("lists only the drafts of the project it was asked about", async () => {
	const { seedDraft } = setup()
	seedDraft({ markdown: "Mine", revision: 1 })

	const drafts = await listCollectionDrafts(
		harness.db,
		{ ...PROJECT, id: "project-2" },
		TEST_COLLECTION,
		TEST_COLLECTION_SLUG,
	)

	expect(drafts).toEqual([])
})

test("leaves out a clean draft, which holds nothing its source lacks", async () => {
	const { seedDraft } = setup()
	seedDraft({
		markdown: "Published",
		committedRevision: 2,
		revision: 2,
		sourcePath: SOURCE_PATH,
	})

	expect(await list()).toEqual([])
})

test("keeps a draft whose revision has run ahead of its committed one", async () => {
	const { seedDraft } = setup()
	seedDraft({
		markdown: "Edited since",
		committedRevision: 2,
		revision: 3,
		sourcePath: SOURCE_PATH,
	})

	expect(await list()).toHaveLength(1)
})

test("points a draft with no source at the editor that carries its id", async () => {
	const { seedDraft } = setup()
	const draft = seedDraft({ markdown: "Something new", revision: 1 })

	const [listed] = await list()

	expect(listed.href).toBe(
		`/acme/blog/collections/posts/editor/new?draft=${draft.id}`,
	)
	expect(listed.sourcePath).toBeNull()
})

test("points a draft over a source at that item's editor", async () => {
	const { seedDraft } = setup()
	seedDraft({
		itemSlug: "hello",
		markdown: "Edited",
		committedRevision: 1,
		revision: 2,
		sourcePath: SOURCE_PATH,
	})

	const [listed] = await list()

	expect(listed.href).toBe("/acme/blog/collections/posts/editor/item/hello")
	expect(listed.sourcePath).toBe(SOURCE_PATH)
})

test("heads a draft by its title, and by its body when it has none", async () => {
	const { seedDraft } = setup()
	seedDraft({
		markdown: "body",
		metadata: JSON.stringify({ title: "A Title" }),
		revision: 1,
	})
	seedDraft({ markdown: "# Just a body", revision: 1 })

	const headings = (await list()).map((draft) => draft.heading)

	expect(headings).toContain("A Title")
	expect(headings).toContain("Just a body…")
})

test("hands back the draft's own data, for the columns derived from it", async () => {
	const { seedDraft } = setup()
	seedDraft({
		markdown: "body",
		metadata: JSON.stringify({ date: "2026-01-01", title: "A Title" }),
		revision: 1,
	})

	const [listed] = await list()

	expect(listed.data).toEqual({ date: "2026-01-01", title: "A Title" })
})

test("survives metadata no writer could have meant", async () => {
	const { seedDraft } = setup()
	seedDraft({ markdown: "body", metadata: "not json", revision: 1 })

	const [listed] = await list()

	expect(listed.data).toEqual({})
	expect(listed.heading).toBe("body…")
})

test("lists the most recently edited draft first", async () => {
	const { seedDraft } = setup()
	seedDraft({
		markdown: "Older",
		revision: 1,
		updatedAt: new Date("2026-01-01"),
	})
	seedDraft({
		markdown: "Newer",
		revision: 1,
		updatedAt: new Date("2026-06-01"),
	})

	expect((await list()).map((draft) => draft.heading)).toEqual([
		"Newer…",
		"Older…",
	])
})
