import { eq } from "drizzle-orm"
import { afterEach, expect, test, vi } from "vitest"
import { collectionSchema } from "@/config/schema"
import { editorDraft } from "@/db/schema/app-schema"
import {
	createDraftsTestHarness,
	type DraftsTestHarness,
	TEST_DIRECTORY_PATH,
} from "./test-harness"
import type { DraftContent, PublishInput } from "./types"

const FIELDS = { slug: "hello", title: "Hello" }
const SOURCE_PATH = `${TEST_DIRECTORY_PATH}/hello.md`
const SOURCE_PREFIX = "---\nslug: hello\ntitle: Hello\n---\n"
const SOURCE_BODY = "Source body"
const SOURCE_CONTENT = `${SOURCE_PREFIX}${SOURCE_BODY}`

let harness: DraftsTestHarness

/** A collection holding one item, `hello`, and the Source the writer publishes over. */
function setup(options: Parameters<typeof createDraftsTestHarness>[0] = {}) {
	harness = createDraftsTestHarness(options)
	const source = harness.sourceStore.put({
		content: SOURCE_CONTENT,
		path: SOURCE_PATH,
	})
	return { ...harness, source }
}

const CONTENT: DraftContent = {
	expectedRevision: null,
	fields: FIELDS,
	markdown: "Published body",
}

function publishItem(overrides: Partial<DraftContent> = {}): PublishInput {
	return { ...CONTENT, ...overrides, mode: "item", slug: "hello" }
}

function publishNewItem(
	draftId: string | null,
	overrides: Partial<DraftContent> = {},
): PublishInput {
	return { ...CONTENT, ...overrides, draftId, mode: "new" }
}

function seedSourceBackedDraft(
	values: Parameters<DraftsTestHarness["seedDraft"]>[0],
) {
	return harness.seedDraft({
		itemSlug: "hello",
		metadata: JSON.stringify(FIELDS),
		sourcePath: SOURCE_PATH,
		...values,
	})
}

afterEach(() => {
	harness?.close()
})

test("refuses a publish whose metadata is invalid, keeping the draft", async () => {
	const { drafts, source } = setup()
	const seeded = seedSourceBackedDraft({
		markdown: "Draft body",
		publishedRevision: 1,
		revision: 2,
		sourceSha: source.sha,
	})

	const result = await drafts.publish(
		publishItem({
			expectedRevision: 2,
			fields: { slug: "hello", title: 42 },
		}),
	)

	expect(result).toEqual({
		code: "validation",
		errors: ["Title must be text"],
		ok: false,
	})
	// A refused publish is still a save: the writer keeps what they typed.
	expect(await harness.readDraft(seeded.id)).toMatchObject({
		markdown: "Published body",
		revision: 3,
	})
})

test("refuses a publish with no body when the document is required", async () => {
	const { drafts } = setup({
		collection: collectionSchema.parse({
			format: "md",
			label: "Posts",
			schema: {
				content: { label: "Content", required: true, type: "document" },
				slug: { from: "title", label: "Slug", type: "slug" },
				title: { label: "Title", type: "text" },
			},
		}),
	})

	const result = await drafts.publish(publishItem({ markdown: "  \n " }))

	expect(result).toEqual({
		code: "validation",
		errors: ["Document content is required"],
		ok: false,
	})
})

const BAD_SLUG_ERRORS = ["Slug must be a valid nonempty filename slug"]

test("refuses a publish whose slug is empty", async () => {
	const { drafts } = setup()

	const result = await drafts.publish(
		publishItem({ fields: { slug: "  ", title: "Hello" } }),
	)

	expect(result).toEqual({
		code: "validation",
		errors: BAD_SLUG_ERRORS,
		ok: false,
	})
})

test("refuses a publish whose slug would not survive as a filename", async () => {
	const { drafts } = setup()

	const result = await drafts.publish(
		publishItem({ fields: { slug: "../secrets", title: "Hello" } }),
	)

	expect(result).toEqual({
		code: "validation",
		errors: BAD_SLUG_ERRORS,
		ok: false,
	})
})

test("refuses a publish whose slug another item already uses", async () => {
	const { drafts } = setup()
	const seeded = harness.seedDraft({ markdown: "Draft body", revision: 1 })

	const result = await drafts.publish(
		publishNewItem(seeded.id, { expectedRevision: 1 }),
	)

	expect(result).toEqual({ code: "duplicate-slug", ok: false, slug: "hello" })
})

test("refuses a publish whose source moved on github", async () => {
	const { drafts, source } = setup()
	seedSourceBackedDraft({
		markdown: "Draft body",
		publishedRevision: 1,
		revision: 2,
		sourceSha: "sha-the-draft-was-built-on",
	})

	const result = await drafts.publish(publishItem({ expectedRevision: 2 }))

	expect(result).toEqual({ code: "stale-source", ok: false })
	expect(harness.sourceStore.get(SOURCE_PATH)?.sha).toBe(source.sha)
})

test("refuses a publish the source store reports as stale", async () => {
	const { drafts, source, sourceStore } = setup()
	seedSourceBackedDraft({
		markdown: "Draft body",
		publishedRevision: 1,
		revision: 2,
		sourceSha: source.sha,
	})
	// The source moved between our listing and our commit — a window no
	// pre-check can close, so the store is the one that reports it.
	sourceStore.setStale(SOURCE_PATH)

	const result = await drafts.publish(publishItem({ expectedRevision: 2 }))

	expect(result).toEqual({ code: "stale-source", ok: false })
})

test("commits a dirty draft, syncs it, and deletes it", async () => {
	const { db, drafts, source, sourceStore } = setup()
	const seeded = seedSourceBackedDraft({
		markdown: "Draft body",
		publishedRevision: 1,
		revision: 2,
		sourceSha: source.sha,
	})

	const result = await drafts.publish(publishItem({ expectedRevision: 2 }))

	expect(result).toMatchObject({
		draftDeleted: true,
		draftId: seeded.id,
		itemSlug: "hello",
		ok: true,
		outcome: "published",
		revision: null,
	})
	expect(sourceStore.get(SOURCE_PATH)?.content).toBe(
		`${SOURCE_PREFIX}Published body`,
	)
	expect(await db.select().from(editorDraft)).toEqual([])
})

test("creates the source file when publishing a new item", async () => {
	const { db, drafts, sourceStore } = setup()
	const seeded = harness.seedDraft({ markdown: "Draft body", revision: 1 })
	const fields = { slug: "new-post", title: "New post" }

	const result = await drafts.publish(
		publishNewItem(seeded.id, { expectedRevision: 1, fields }),
	)

	expect(result).toMatchObject({
		draftDeleted: true,
		draftId: seeded.id,
		itemSlug: "new-post",
		ok: true,
		outcome: "published",
	})
	expect(sourceStore.get(`${TEST_DIRECTORY_PATH}/new-post.md`)?.content).toBe(
		"---\nslug: new-post\ntitle: New post\n---\nPublished body\n",
	)
	expect(await db.select().from(editorDraft)).toEqual([])
})

test("refuses a publish carrying a stale expected revision", async () => {
	const { drafts, source } = setup()
	const seeded = seedSourceBackedDraft({
		markdown: "Draft body",
		publishedRevision: 1,
		revision: 2,
		sourceSha: source.sha,
	})

	const result = await drafts.publish(publishItem({ expectedRevision: 1 }))

	expect(result).toEqual({ code: "revision-conflict", ok: false })
	expect(await harness.readDraft(seeded.id)).toMatchObject({
		markdown: "Draft body",
		revision: 2,
	})
})

test("reports not-found when the slug names no item", async () => {
	const { drafts } = setup()

	const result = await drafts.publish({
		...CONTENT,
		mode: "item",
		slug: "nothing-here",
	})

	expect(result).toEqual({ code: "not-found", ok: false })
})

test("reports not-found when a new item's draft is gone", async () => {
	const { drafts } = setup()

	const result = await drafts.publish(publishNewItem("missing"))

	expect(result).toEqual({ code: "not-found", ok: false })
})

test("deletes the draft without committing when the content matches the source", async () => {
	const { db, drafts, source, sourceStore } = setup()
	const seeded = seedSourceBackedDraft({
		markdown: "Draft body",
		publishedRevision: 1,
		revision: 2,
		sourceSha: source.sha,
	})

	const result = await drafts.publish(
		publishItem({ expectedRevision: 2, markdown: SOURCE_BODY }),
	)

	expect(result).toEqual({
		draftId: seeded.id,
		itemSlug: "hello",
		ok: true,
		outcome: "matches-source",
	})
	// Nothing was committed: the Source still carries the sha it was seeded with.
	expect(sourceStore.get(SOURCE_PATH)?.sha).toBe(source.sha)
	expect(await db.select().from(editorDraft)).toEqual([])
})

test("refuses a matching publish whose draft moved before the delete", async () => {
	const { db, drafts, source, sourceStore } = setup()
	const seeded = seedSourceBackedDraft({
		markdown: SOURCE_BODY,
		publishedRevision: 1,
		revision: 2,
		sourceSha: source.sha,
	})
	// The other session saves while we are scanning the directory for a duplicate
	// slug — the draft we were about to drop now holds work of its own, and only
	// the guarded delete can say so. The first listing is the one that resolves
	// the source, so the race belongs to the second.
	const list = sourceStore.list
	let listings = 0
	vi.spyOn(sourceStore, "list").mockImplementation(async (path) => {
		if (++listings === 2) {
			await db
				.update(editorDraft)
				.set({ markdown: "Later work", revision: 3 })
				.where(eq(editorDraft.id, seeded.id))
		}
		return list(path)
	})

	const result = await drafts.publish(
		publishItem({ expectedRevision: 2, markdown: SOURCE_BODY }),
	)

	expect(result).toEqual({ code: "revision-conflict", ok: false })
	expect(await harness.readDraft(seeded.id)).toMatchObject({
		markdown: "Later work",
		revision: 3,
	})
})

test("repoints the draft at the new source when the sync loses the race", async () => {
	const { db, drafts, source, sourceStore } = setup()
	const seeded = seedSourceBackedDraft({
		markdown: "Draft body",
		publishedRevision: 1,
		revision: 2,
		sourceSha: source.sha,
	})
	// The other session saves while we are committing — the one window where the
	// guarded sync can miss, since the commit is the slow leg of the publish.
	const write = sourceStore.write
	vi.spyOn(sourceStore, "write").mockImplementationOnce(async (input) => {
		await db
			.update(editorDraft)
			.set({ revision: 4 })
			.where(eq(editorDraft.id, seeded.id))
		return write(input)
	})

	const result = await drafts.publish(publishItem({ expectedRevision: 2 }))

	const committed = sourceStore.get(SOURCE_PATH)
	expect(result).toEqual({
		commitSha: `commit-${committed?.sha}`,
		draftId: seeded.id,
		itemSlug: "hello",
		ok: true,
		outcome: "published-unsynced",
	})
	// The draft keeps the other session's work, but now tracks what we committed,
	// so its next save is not refused against a sha that no longer exists.
	expect(await harness.readDraft(seeded.id)).toMatchObject({
		itemSlug: "hello",
		publishedRevision: 1,
		revision: 4,
		sourcePath: SOURCE_PATH,
		sourceSha: committed?.sha,
	})
})
