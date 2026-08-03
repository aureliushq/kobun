import { afterEach, expect, test, vi } from "vitest"
import { editorDraft } from "@/db/schema/app-schema"
import {
	createDraftsTestHarness,
	type DraftsTestHarness,
	TEST_DIRECTORY_PATH,
} from "./test-harness"

const SOURCE_PATH = `${TEST_DIRECTORY_PATH}/hello.md`
const SOURCE_CONTENT = "---\ntitle: Hello\n---\nSource body"
const SOURCE_BODY = "Source body"

let harness: DraftsTestHarness

/** A collection holding one item, `hello`, at the sha the store minted for it. */
function setup() {
	harness = createDraftsTestHarness()
	const source = harness.sourceStore.put({
		content: SOURCE_CONTENT,
		path: SOURCE_PATH,
	})
	return { ...harness, source }
}

function seedSourceBackedDraft(
	values: Parameters<DraftsTestHarness["seedDraft"]>[0],
) {
	return harness.seedDraft({
		itemSlug: "hello",
		sourcePath: SOURCE_PATH,
		...values,
	})
}

/** Replace the Source in the repository, which mints it a fresh sha. */
function moveSource(content: string) {
	return harness.sourceStore.put({ content, path: SOURCE_PATH })
}

afterEach(() => {
	harness?.close()
})

test("mints a draft with the schema defaults on the first open of a new item", async () => {
	const { drafts, projectId } = setup()

	const result = await drafts.open({ draftId: null, mode: "new" })

	const rows = await harness.db.select().from(editorDraft)
	expect(rows).toHaveLength(1)
	expect(result).toEqual({ created: true, draftId: rows[0].id, ok: true })
	expect(rows[0]).toMatchObject({
		collectionSlug: "posts",
		markdown: "",
		metadata: JSON.stringify({ slug: "", title: "" }),
		projectId,
		revision: 0,
		sourcePath: null,
	})
})

test("opens a minted draft by id", async () => {
	const { drafts } = setup()
	const seeded = harness.seedDraft({
		markdown: "Draft body",
		metadata: JSON.stringify({ title: "Hello" }),
		revision: 2,
	})

	const result = await drafts.open({ draftId: seeded.id, mode: "new" })

	expect(result).toEqual({
		content: "Draft body",
		created: false,
		draftId: seeded.id,
		fields: { title: "Hello" },
		ok: true,
		revision: 2,
		source: null,
	})
})

test("reports not-found for an unknown new-item draft", async () => {
	const { drafts } = setup()

	const result = await drafts.open({ draftId: "missing", mode: "new" })

	expect(result).toEqual({ code: "not-found", ok: false })
})

test("reports not-found when no collection item uses the slug", async () => {
	const { drafts } = setup()

	const result = await drafts.open({ mode: "item", slug: "nothing-here" })

	expect(result).toEqual({ code: "not-found", ok: false })
})

test("opens an existing item that has no draft", async () => {
	const { drafts, source } = setup()

	const result = await drafts.open({ mode: "item", slug: "hello" })

	expect(result).toMatchObject({
		content: SOURCE_BODY,
		created: false,
		draftId: null,
		fields: { title: "Hello" },
		ok: true,
		revision: null,
		source: { itemSlug: "hello", path: SOURCE_PATH, sha: source.sha },
	})
})

test("shows the draft's content when the draft is dirty", async () => {
	const { drafts, source } = setup()
	seedSourceBackedDraft({
		markdown: "Draft body",
		metadata: JSON.stringify({ title: "Draft title" }),
		publishedRevision: 1,
		revision: 2,
		sourceSha: source.sha,
	})

	const result = await drafts.open({ mode: "item", slug: "hello" })

	expect(result).toMatchObject({
		content: "Draft body",
		fields: { title: "Draft title" },
		ok: true,
		revision: 2,
	})
})

test("shows the source's content when the draft is clean", async () => {
	const { drafts, source } = setup()
	const seeded = seedSourceBackedDraft({
		markdown: "Stale draft body",
		metadata: JSON.stringify({ title: "Stale title" }),
		publishedRevision: 2,
		revision: 2,
		sourceSha: source.sha,
	})

	const result = await drafts.open({ mode: "item", slug: "hello" })

	expect(result).toMatchObject({
		content: SOURCE_BODY,
		draftId: seeded.id,
		fields: { title: "Hello" },
		ok: true,
		revision: 2,
	})
})

test("rebases a clean draft whose source moved", async () => {
	const { drafts, source } = setup()
	const seeded = seedSourceBackedDraft({
		markdown: "Published body",
		metadata: JSON.stringify({ title: "Hello" }),
		publishedRevision: 2,
		revision: 2,
		sourceSha: source.sha,
	})
	const moved = moveSource("---\ntitle: Hello\n---\nEdited on GitHub")

	const result = await drafts.open({ mode: "item", slug: "hello" })

	expect(result).toMatchObject({
		content: "Edited on GitHub",
		draftId: seeded.id,
		fields: { title: "Hello" },
		ok: true,
		revision: 3,
	})
	expect(await harness.readDraft(seeded.id)).toMatchObject({
		markdown: "Edited on GitHub",
		metadata: null,
		publishedRevision: 3,
		revision: 3,
		sourceSha: moved.sha,
	})
})

test("falls back to a re-read when the rebase loses the race", async () => {
	const { db, drafts, source } = setup()
	const seeded = seedSourceBackedDraft({
		markdown: "Draft body",
		metadata: JSON.stringify({ title: "Draft title" }),
		publishedRevision: 3,
		revision: 4,
		sourceSha: source.sha,
	})
	moveSource("---\ntitle: Hello\n---\nEdited on GitHub")
	// The other session saved between our read and our rebase: the clean draft
	// we were handed has since gone dirty, so the guarded UPDATE matches nothing
	// and only a re-read can say what the draft now holds.
	vi.spyOn(db.query.editorDraft, "findFirst").mockResolvedValueOnce({
		...seeded,
		publishedRevision: 3,
		revision: 3,
	})

	const result = await drafts.open({ mode: "item", slug: "hello" })

	expect(result).toMatchObject({
		content: "Draft body",
		draftId: seeded.id,
		fields: { title: "Draft title" },
		ok: true,
		revision: 4,
	})
	expect(await harness.readDraft(seeded.id)).toMatchObject({
		markdown: "Draft body",
		publishedRevision: 3,
		revision: 4,
		sourceSha: source.sha,
	})
})

test("leaves a dirty draft alone when its source moved", async () => {
	const { drafts, source } = setup()
	const seeded = seedSourceBackedDraft({
		markdown: "Unpublished work",
		metadata: JSON.stringify({ title: "Draft title" }),
		publishedRevision: 2,
		revision: 3,
		sourceSha: source.sha,
	})
	moveSource("---\ntitle: Hello\n---\nEdited on GitHub")

	const result = await drafts.open({ mode: "item", slug: "hello" })

	expect(result).toMatchObject({
		content: "Unpublished work",
		fields: { title: "Draft title" },
		ok: true,
		revision: 3,
	})
	expect(await harness.readDraft(seeded.id)).toMatchObject({
		markdown: "Unpublished work",
		publishedRevision: 2,
		revision: 3,
		sourceSha: source.sha,
	})
})
