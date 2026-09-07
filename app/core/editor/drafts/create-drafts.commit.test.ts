import { eq } from "drizzle-orm"
import invariant from "tiny-invariant"
import { afterEach, expect, test, vi } from "vitest"
import { collectionSchema } from "@/config/schema"
import { parseDocument } from "@/core/content/document.server"
import { SLUG_MAX_LENGTH } from "@/core/editor/collection-metadata"
import { editorDraft } from "@/db/schema/app-schema"
import { stringifyFrontmatter } from "@/lib/frontmatter"
import {
	createDraftsTestHarness,
	type DraftsTestHarness,
	TEST_COLLECTION_WITH_FEATURES,
	TEST_COLLECTION_WITHOUT_PUBLISH,
	TEST_DIRECTORY_PATH,
} from "./test-harness"
import type { CommitInput, DraftContent } from "./types"

/**
 * Save to GitHub: a Commit and nothing else. It never touches Publication State,
 * so what it commits is whatever the writer's fields already said, and it is
 * gated only on where the bytes land — never on the content being finished
 * (ADR-0008).
 */

const FIELDS = { slug: "hello", title: "Hello" }
const SOURCE_PATH = `${TEST_DIRECTORY_PATH}/hello.md`
const SOURCE_BODY = "Source body\n"
const DRAFT_BODY = "Draft body\n"

const CREATED = "2026-08-31T09:14:00.000Z"
const LATER = "2026-09-02T11:30:00.000Z"

let harness: DraftsTestHarness
let clock: Date

function setup(options: Parameters<typeof createDraftsTestHarness>[0] = {}) {
	clock = new Date(CREATED)
	harness = createDraftsTestHarness({ now: () => clock, ...options })
	return harness
}

function tick(instant: string) {
	clock = new Date(instant)
}

function putSource(data: Record<string, unknown>, body = SOURCE_BODY) {
	return harness.sourceStore.put({
		content: stringifyFrontmatter(body, data),
		path: SOURCE_PATH,
	})
}

/** The Data the repository now holds — the values, rather than the bytes carrying them. */
function committedData(path = SOURCE_PATH) {
	return parseDocument(harness.sourceStore.get(path)?.content ?? "", "md").data
}

async function draftData(id: string) {
	const draft = await harness.readDraft(id)
	return JSON.parse(draft?.metadata ?? "null") as Record<string, unknown>
}

const CONTENT: DraftContent = {
	expectedRevision: null,
	fields: FIELDS,
	markdown: DRAFT_BODY,
}

function commitItem(overrides: Partial<DraftContent> = {}): CommitInput {
	return { ...CONTENT, ...overrides, mode: "item", slug: "hello" }
}

function commitNewItem(
	draftId: string | null = null,
	overrides: Partial<DraftContent> = {},
): CommitInput {
	return { ...CONTENT, ...overrides, draftId, mode: "new" }
}

afterEach(() => {
	harness?.close()
})

test("commits a new item as the draft its status field already held", async () => {
	const { drafts } = setup({ collection: TEST_COLLECTION_WITH_FEATURES })
	const opened = await drafts.open({ draftId: null, mode: "new" })
	invariant(opened.ok, "a new item always opens")

	const result = await drafts.commit(
		commitNewItem(null, { fields: { ...opened.fields, ...FIELDS } }),
	)

	expect(result).toMatchObject({
		draftDeleted: true,
		itemSlug: "hello",
		ok: true,
		outcome: "committed",
	})
	// Save to GitHub never touches `status`, so what lands is the `draft` the
	// Field defaults to — and `publishedAt` stays unset, because the item has not
	// been published.
	expect(committedData()).toEqual({
		...FIELDS,
		createdAt: CREATED,
		publishedAt: "",
		status: "draft",
		updatedAt: CREATED,
	})
})

test("leaves a status the source carries exactly as it found it", async () => {
	const { drafts } = setup({ collection: TEST_COLLECTION_WITH_FEATURES })
	const source = { ...FIELDS, publishedAt: CREATED, status: "published" }
	putSource(source)
	tick(LATER)

	await drafts.commit(commitItem({ fields: source }))

	// A writer backing up a typo fix on a live post must not unpublish it, and
	// `publishedAt` is a fact only the publishing action may write.
	expect(committedData()).toMatchObject({
		publishedAt: CREATED,
		status: "published",
		updatedAt: LATER,
	})
})

test("commits the writer's status verbatim, unpublishing without a button", async () => {
	const { drafts } = setup({ collection: TEST_COLLECTION_WITH_FEATURES })
	const source = { ...FIELDS, publishedAt: CREATED, status: "published" }
	putSource(source)

	await drafts.commit(
		commitItem({
			fields: { ...source, status: "draft" },
			markdown: SOURCE_BODY,
		}),
	)

	expect(committedData()).toMatchObject({ status: "draft" })
})

test("names the commit for the file change it is", async () => {
	const { drafts, sourceStore } = setup()
	putSource(FIELDS)
	const write = vi.spyOn(sourceStore, "write")

	await drafts.commit(commitItem())

	expect(write.mock.calls[0]?.[0]).toMatchObject({
		message: `Update ${SOURCE_PATH} with Kobun`,
	})
})

test("commits metadata that would fail validation", async () => {
	const { drafts } = setup()
	putSource(FIELDS)

	const result = await drafts.commit(
		commitItem({ fields: { slug: "hello", title: 42 } }),
	)

	// "Finished" is a claim Publish makes; holding it against a backup would make
	// the backup useless for the half-written post it exists for.
	expect(result).toMatchObject({ ok: true, outcome: "committed" })
	expect(committedData()).toMatchObject({ title: 42 })
})

test("commits with a required document empty", async () => {
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
	putSource(FIELDS)

	const result = await drafts.commit(commitItem({ markdown: "  \n " }))

	expect(result).toMatchObject({ ok: true, outcome: "committed" })
})

const EMPTY_SLUG_ERRORS = [
	"Slug is required — it becomes the file's name. A title with no letters or digits derives none, so type one.",
]
const MALFORMED_SLUG_ERRORS = [
	"Slug must be lowercase letters and numbers separated by single hyphens",
]

test("refuses a commit whose slug is empty", async () => {
	const { drafts } = setup()

	const result = await drafts.commit(
		commitNewItem(null, { fields: { slug: "  ", title: "Hello" } }),
	)

	expect(result).toEqual({
		code: "validation",
		errors: EMPTY_SLUG_ERRORS,
		ok: false,
	})
})

test("refuses a commit whose slug would not survive as a filename", async () => {
	const { drafts } = setup()

	const result = await drafts.commit(
		commitNewItem(null, { fields: { slug: "../secrets", title: "Hello" } }),
	)

	expect(result).toEqual({
		code: "validation",
		errors: MALFORMED_SLUG_ERRORS,
		ok: false,
	})
})

test("refuses a commit whose slug derivation could never have produced", async () => {
	const { drafts } = setup()

	// A filename this would survive as, but not a Slug `slugify` can emit: the
	// alphabet is one rule, so a hand-typed Slug answers to it too.
	const result = await drafts.commit(
		commitNewItem(null, { fields: { slug: "My_Post", title: "Hello" } }),
	)

	expect(result).toEqual({
		code: "validation",
		errors: MALFORMED_SLUG_ERRORS,
		ok: false,
	})
})

test("refuses a commit whose slug is longer than a Slug may be", async () => {
	const { drafts } = setup()

	const result = await drafts.commit(
		commitNewItem(null, {
			fields: { slug: "a".repeat(SLUG_MAX_LENGTH + 1), title: "Hello" },
		}),
	)

	expect(result).toEqual({
		code: "validation",
		errors: [`Slug must be ${SLUG_MAX_LENGTH} characters or fewer`],
		ok: false,
	})
})

test("refuses a commit whose slug another item already uses", async () => {
	const { drafts } = setup()
	putSource(FIELDS)
	const seeded = harness.seedDraft({ markdown: DRAFT_BODY, revision: 1 })

	const result = await drafts.commit(
		commitNewItem(seeded.id, { expectedRevision: 1 }),
	)

	// Committing over a taken Slug would land this Draft on top of another item.
	expect(result).toEqual({ code: "duplicate-slug", ok: false, slug: "hello" })
})

test("refuses a commit whose source moved on github, keeping what the writer typed", async () => {
	const { drafts } = setup()
	const source = putSource(FIELDS)
	const seeded = harness.seedDraft({
		itemSlug: "hello",
		markdown: "Older body\n",
		metadata: JSON.stringify(FIELDS),
		publishedRevision: 1,
		revision: 2,
		sourcePath: SOURCE_PATH,
		sourceSha: "sha-the-draft-was-built-on",
	})

	const result = await drafts.commit(
		commitItem({ expectedRevision: 2, fields: { ...FIELDS, title: "Typed" } }),
	)

	expect(result).toEqual({ code: "stale-source", ok: false })
	expect(harness.sourceStore.get(SOURCE_PATH)?.sha).toBe(source.sha)
	// The content is persisted as the Draft before any gate runs.
	expect(await draftData(seeded.id)).toMatchObject({ title: "Typed" })
	expect(await harness.readDraft(seeded.id)).toMatchObject({
		markdown: DRAFT_BODY,
	})
})

test("commits nothing when the content already matches the source", async () => {
	const { drafts, sourceStore } = setup({
		collection: TEST_COLLECTION_WITH_FEATURES,
	})
	const stamped = {
		...FIELDS,
		createdAt: CREATED,
		publishedAt: "",
		status: "draft",
		updatedAt: CREATED,
	}
	putSource(stamped)
	const before = sourceStore.get(SOURCE_PATH)
	tick(LATER)

	const result = await drafts.commit(
		commitItem({ fields: stamped, markdown: SOURCE_BODY }),
	)

	expect(result).toMatchObject({ ok: true, outcome: "matches-source" })
	expect(sourceStore.get(SOURCE_PATH)).toEqual(before)
})

test("commits nothing on a second commit after the sync lost its race", async () => {
	const { db, drafts, sourceStore } = setup({
		collection: TEST_COLLECTION_WITH_FEATURES,
	})
	const source = putSource(FIELDS)
	const seeded = harness.seedDraft({
		itemSlug: "hello",
		markdown: DRAFT_BODY,
		metadata: JSON.stringify(FIELDS),
		publishedRevision: 1,
		revision: 2,
		sourcePath: SOURCE_PATH,
		sourceSha: source.sha,
	})
	// The other session saves while we are committing — the one window where the
	// guarded sync can miss, so the Draft survives the commit.
	const write = sourceStore.write
	vi.spyOn(sourceStore, "write").mockImplementationOnce(async (input) => {
		await db
			.update(editorDraft)
			.set({ revision: 4 })
			.where(eq(editorDraft.id, seeded.id))
		return write(input)
	})

	const first = await drafts.commit(commitItem({ expectedRevision: 2 }))

	expect(first).toMatchObject({ ok: true, outcome: "committed-unsynced" })
	// The stamp landed before the Draft was persisted, so a Draft that outlives
	// the commit still agrees with the Source the commit created — which is what
	// keeps the churn bug #87 guards against from returning.
	const kept = await draftData(seeded.id)
	expect(kept).toEqual(committedData())

	const committed = sourceStore.get(SOURCE_PATH)
	tick(LATER)

	const second = await drafts.commit(
		commitItem({ expectedRevision: 4, fields: kept }),
	)

	expect(second).toMatchObject({ ok: true, outcome: "matches-source" })
	expect(sourceStore.get(SOURCE_PATH)).toEqual(committed)
})

test("commits for a collection with no publish feature", async () => {
	const { drafts } = setup({ collection: TEST_COLLECTION_WITHOUT_PUBLISH })
	putSource(FIELDS)

	const result = await drafts.commit(commitItem())

	// No Publication State to declare, so there is nothing `status` could say.
	expect(result).toMatchObject({ ok: true, outcome: "committed" })
	expect(committedData()).toEqual({
		...FIELDS,
		createdAt: CREATED,
		updatedAt: CREATED,
	})
})
