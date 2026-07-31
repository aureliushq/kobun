import { afterEach, expect, test, vi } from "vitest"
import { editorDraft } from "@/db/schema/app-schema"
import {
	createDraftsTestHarness,
	type DraftsTestHarness,
	TEST_DIRECTORY_PATH,
} from "./test-harness"
import type { DraftContent, SaveInput } from "./types"

const FIELDS = { title: "Hello" }
const SOURCE_PATH = `${TEST_DIRECTORY_PATH}/hello.md`
const SOURCE_PREFIX = "---\ntitle: Hello\n---\n"
const SOURCE_BODY = "Source body"
const SOURCE_SHA = "sha-source"

let harness: DraftsTestHarness

/** A collection holding one item, `hello`, which the Draft under test tracks. */
function setup() {
	harness = createDraftsTestHarness({
		files: [
			{
				content: `${SOURCE_PREFIX}${SOURCE_BODY}`,
				name: "hello.md",
				path: SOURCE_PATH,
				sha: SOURCE_SHA,
			},
		],
	})
	return harness
}

const CONTENT: DraftContent = {
	expectedRevision: null,
	fields: FIELDS,
	markdown: "Draft body",
}

function saveItem(overrides: Partial<DraftContent> = {}): SaveInput {
	return { ...CONTENT, ...overrides, mode: "item", slug: "hello" }
}

function saveNewItem(
	draftId: string | null,
	overrides: Partial<DraftContent> = {},
): SaveInput {
	return { ...CONTENT, ...overrides, draftId, mode: "new" }
}

function seedSourceBackedDraft(
	values: Parameters<DraftsTestHarness["seedDraft"]>[0],
) {
	return harness.seedDraft({
		itemSlug: "hello",
		metadata: JSON.stringify(FIELDS),
		publishedRevision: 0,
		sourcePath: SOURCE_PATH,
		sourceSha: SOURCE_SHA,
		...values,
	})
}

afterEach(() => {
	harness?.close()
})

test("refuses a save carrying a stale expected revision", async () => {
	const { drafts } = setup()
	const seeded = seedSourceBackedDraft({ markdown: "a", revision: 3 })

	const result = await drafts.save(
		saveItem({ expectedRevision: 2, markdown: "b" }),
	)

	expect(result).toEqual({ code: "revision-conflict", ok: false })
	const row = await harness.readDraft(seeded.id)
	expect(row).toMatchObject({ markdown: "a", revision: 3 })
})

test("refuses a save whose draft moved between the read and the write", async () => {
	const { db, drafts } = setup()
	const seeded = seedSourceBackedDraft({ markdown: "a", revision: 3 })
	// The other session's save lands after we read the draft: the revision we
	// were handed no longer exists, so only the `UPDATE ... WHERE revision`
	// guard can catch it.
	vi.spyOn(db.query.editorDraft, "findFirst").mockResolvedValueOnce({
		...seeded,
		revision: 4,
	})

	const result = await drafts.save(
		saveItem({ expectedRevision: 4, markdown: "b" }),
	)

	expect(result).toEqual({ code: "revision-conflict", ok: false })
	const row = await harness.readDraft(seeded.id)
	expect(row).toMatchObject({ markdown: "a", revision: 3 })
})

test("short-circuits a save whose content already matches the source", async () => {
	const { db, drafts } = setup()

	const result = await drafts.save(saveItem({ markdown: SOURCE_BODY }))

	expect(result).toEqual({
		draftId: null,
		ok: true,
		outcome: "matches-source",
		revision: null,
	})
	expect(await db.select().from(editorDraft)).toEqual([])
})

test("keeps an existing draft when the content catches up to the source", async () => {
	const { drafts } = setup()
	const seeded = seedSourceBackedDraft({ markdown: "a", revision: 3 })

	const result = await drafts.save(
		saveItem({ expectedRevision: 3, markdown: SOURCE_BODY }),
	)

	expect(result).toEqual({
		draftId: seeded.id,
		ok: true,
		outcome: "matches-source",
		revision: 3,
	})
	const row = await harness.readDraft(seeded.id)
	expect(row).toMatchObject({ markdown: "a", revision: 3 })
})

test("refuses a source-matching save that expects a draft revision", async () => {
	const { drafts } = setup()

	const result = await drafts.save(
		saveItem({ expectedRevision: 0, markdown: SOURCE_BODY }),
	)

	expect(result).toEqual({ code: "revision-conflict", ok: false })
})

test("leaves the revision alone when the draft already holds the content", async () => {
	const { drafts } = setup()
	const seeded = seedSourceBackedDraft({ markdown: "x", revision: 4 })

	const result = await drafts.save(
		saveItem({ expectedRevision: 4, markdown: "x" }),
	)

	expect(result).toMatchObject({ ok: true, outcome: "unchanged" })
	const row = await harness.readDraft(seeded.id)
	expect(row).toMatchObject({ markdown: "x", revision: 4 })
})

test("inserts a draft on the first save of an existing item, tracking the source its slug names", async () => {
	const { drafts, projectId } = setup()

	const result = await drafts.save(saveItem())

	expect(result).toMatchObject({ ok: true, outcome: "saved" })
	const rows = await harness.db.select().from(editorDraft)
	expect(rows).toHaveLength(1)
	expect(rows[0]).toMatchObject({
		collectionSlug: "posts",
		itemSlug: "hello",
		markdown: "Draft body",
		metadata: JSON.stringify(FIELDS),
		projectId,
		publishedRevision: 0,
		revision: 1,
		sourcePath: SOURCE_PATH,
		sourceSha: SOURCE_SHA,
	})
})

test("maps a first-save unique-constraint race to a revision conflict", async () => {
	const { db, drafts } = setup()
	const seeded = seedSourceBackedDraft({ markdown: "a", revision: 3 })
	// The other session created the draft after our lookup missed it; the unique
	// index on (projectId, sourcePath) is what actually reports the race.
	vi.spyOn(db.query.editorDraft, "findFirst").mockResolvedValueOnce(undefined)

	const result = await drafts.save(saveItem({ markdown: "b" }))

	expect(result).toEqual({ code: "revision-conflict", ok: false })
	const rows = await db.select().from(editorDraft)
	expect(rows).toHaveLength(1)
	expect(rows[0]).toMatchObject({ id: seeded.id, revision: 3 })
})

test("reports not-found when the slug names no item", async () => {
	const { drafts } = setup()

	const result = await drafts.save({
		...CONTENT,
		mode: "item",
		slug: "nothing-here",
	})

	expect(result).toEqual({ code: "not-found", ok: false })
})

test("reports not-found when a new item's draft is gone", async () => {
	const { drafts } = setup()

	const result = await drafts.save(saveNewItem("missing"))

	expect(result).toEqual({ code: "not-found", ok: false })
})

test("saves a new item's draft by id", async () => {
	const { drafts } = setup()
	const seeded = harness.seedDraft({ markdown: "", revision: 0 })

	const result = await drafts.save(
		saveNewItem(seeded.id, { expectedRevision: 0 }),
	)

	expect(result).toMatchObject({ ok: true, outcome: "saved" })
	const row = await harness.readDraft(seeded.id)
	expect(row).toMatchObject({
		markdown: "Draft body",
		revision: 1,
		sourcePath: null,
	})
})
