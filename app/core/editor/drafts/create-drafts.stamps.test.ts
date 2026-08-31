import { eq } from "drizzle-orm"
import invariant from "tiny-invariant"
import { afterEach, expect, test, vi } from "vitest"
import { parseDocument } from "@/core/content/document.server"
import { editorDraft } from "@/db/schema/app-schema"
import { stringifyFrontmatter } from "@/lib/frontmatter"
import {
	createDraftsTestHarness,
	type DraftsTestHarness,
	TEST_COLLECTION_WITH_FEATURES,
	TEST_DIRECTORY_PATH,
} from "./test-harness"
import type { DraftContent, PublishInput } from "./types"

/**
 * The values a Feature contributes are the system's to write — and never over
 * the writer's. These are the stamping rules of ADR-0005, driven through the
 * whole module so the ordering they depend on is exercised rather than asserted.
 */

const FIELDS = { slug: "hello", title: "Hello" }
const SOURCE_PATH = `${TEST_DIRECTORY_PATH}/hello.md`
// Bodies end in a newline, which is what the serializer emits, so a Source
// round-trips through a commit byte for byte.
const SOURCE_BODY = "Source body\n"
const DRAFT_BODY = "Draft body\n"

/** Three distinguishable instants: when the editor opened, later, and one only a writer would pick. */
const CREATED = "2026-08-31T09:14:00.000Z"
const LATER = "2026-09-02T11:30:00.000Z"
const BACKDATED = "2024-01-05T18:45:00.000Z"

let harness: DraftsTestHarness
let clock: Date

/** A Collection with every Feature on, and a clock the test moves by hand. */
function setup() {
	clock = new Date(CREATED)
	harness = createDraftsTestHarness({
		collection: TEST_COLLECTION_WITH_FEATURES,
		now: () => clock,
	})
	return harness
}

/** Move the clock on, so a later stamp is distinguishable from an earlier one. */
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

/** The Data the Draft is holding onto. */
async function draftData(id: string) {
	const draft = await harness.readDraft(id)
	return JSON.parse(draft?.metadata ?? "null") as Record<string, unknown>
}

function publishItem(overrides: Partial<DraftContent> = {}): PublishInput {
	return {
		expectedRevision: null,
		fields: FIELDS,
		markdown: DRAFT_BODY,
		...overrides,
		mode: "item",
		slug: "hello",
	}
}

function newItem(overrides: Partial<DraftContent> = {}): PublishInput {
	return {
		expectedRevision: null,
		fields: FIELDS,
		markdown: DRAFT_BODY,
		...overrides,
		draftId: null,
		mode: "new",
	}
}

afterEach(() => {
	harness?.close()
})

test("opens a new item on a stamped Created and a Status of Draft", async () => {
	const { drafts } = setup()

	const opened = await drafts.open({ draftId: null, mode: "new" })

	// Created is a fact the moment the writer starts; the other three are facts
	// about a publish that has not happened.
	expect(opened).toMatchObject({
		draftId: null,
		fields: {
			createdAt: CREATED,
			publishedAt: "",
			status: "draft",
			updatedAt: "",
		},
		ok: true,
	})
})

test("mints no draft from the values it stamped itself", async () => {
	const { db, drafts } = setup()
	const opened = await drafts.open({ draftId: null, mode: "new" })
	invariant(opened.ok, "a new item always opens")

	const result = await drafts.save(
		newItem({ fields: opened.fields, markdown: "" }),
	)

	expect(result).toEqual({
		draftId: null,
		ok: true,
		outcome: "unwritten",
		revision: null,
	})
	expect(await db.select().from(editorDraft)).toEqual([])
})

test("stamps createdAt into the draft it mints", async () => {
	const { drafts } = setup()

	const result = await drafts.save(newItem())

	invariant(result.ok && "draft" in result, "the save mints a draft")
	expect(await draftData(result.draft.id)).toEqual({
		...FIELDS,
		createdAt: CREATED,
	})
})

test("writes every managed field when it publishes an item it created", async () => {
	const { drafts } = setup()

	const result = await drafts.publish(
		newItem({ fields: { slug: "world", title: "World" } }),
	)

	expect(result).toMatchObject({
		itemSlug: "world",
		ok: true,
		outcome: "published",
	})
	expect(committedData(`${TEST_DIRECTORY_PATH}/world.md`)).toEqual({
		createdAt: CREATED,
		publishedAt: CREATED,
		slug: "world",
		status: "published",
		title: "World",
		updatedAt: CREATED,
	})
})

test("backfills the three timestamps onto a source that lacks them, and no status", async () => {
	const { drafts } = setup()
	putSource(FIELDS)

	const result = await drafts.publish(publishItem())

	expect(result).toMatchObject({ ok: true, outcome: "published" })
	// Publication State is the writer's intent about content Kobun did not
	// author, and there is no correct guess: the key stays absent.
	expect(committedData()).toEqual({
		...FIELDS,
		createdAt: CREATED,
		publishedAt: CREATED,
		updatedAt: CREATED,
	})
})

test("advances updatedAt on a later publish and keeps createdAt and publishedAt", async () => {
	const { drafts } = setup()
	const stamped = {
		...FIELDS,
		createdAt: CREATED,
		publishedAt: CREATED,
		updatedAt: CREATED,
	}
	putSource(stamped)
	tick(LATER)

	await drafts.publish(publishItem({ fields: stamped }))

	expect(committedData()).toEqual({ ...stamped, updatedAt: LATER })
})

test("commits the writer's updatedAt when they set it themselves", async () => {
	const { drafts } = setup()
	putSource({ ...FIELDS, updatedAt: CREATED })
	tick(LATER)

	// The value differs from the one the Source carries, which is the whole of
	// how a stamp recognises an edit — no dirty-tracking needed.
	await drafts.publish(
		publishItem({ fields: { ...FIELDS, updatedAt: BACKDATED } }),
	)

	expect(committedData()).toMatchObject({ updatedAt: BACKDATED })
})

test("commits a managed field the writer edited", async () => {
	const { drafts } = setup()
	const source = { ...FIELDS, publishedAt: CREATED, status: "published" }
	putSource(source)
	tick(LATER)

	// Backdating an imported post's publication date, and taking it back to a
	// draft, are ordinary writing work (ADR-0005, as amended).
	await drafts.publish(
		publishItem({
			fields: { ...source, publishedAt: BACKDATED, status: "draft" },
		}),
	)

	expect(committedData()).toMatchObject({
		publishedAt: BACKDATED,
		status: "draft",
	})
})

test("leaves a status it did not write untouched", async () => {
	const { drafts } = setup()
	const source = { ...FIELDS, status: "draft" }
	putSource(source)

	await drafts.publish(publishItem({ fields: source }))

	// An ordinary edit must not silently publish a live draft.
	expect(committedData()).toMatchObject({ status: "draft" })
})

test("commits nothing when the writer changed nothing", async () => {
	const { drafts, sourceStore } = setup()
	const stamped = {
		...FIELDS,
		createdAt: CREATED,
		publishedAt: CREATED,
		status: "published",
		updatedAt: CREATED,
	}
	putSource(stamped)
	const before = sourceStore.get(SOURCE_PATH)
	tick(LATER)

	const result = await drafts.publish(
		publishItem({ fields: stamped, markdown: SOURCE_BODY }),
	)

	expect(result).toMatchObject({ ok: true, outcome: "matches-source" })
	expect(sourceStore.get(SOURCE_PATH)).toEqual(before)
})

test("commits nothing on a second publish after the sync lost its race", async () => {
	const { db, drafts, sourceStore } = setup()
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
	// guarded sync can miss, so the Draft survives the publish.
	const write = sourceStore.write
	vi.spyOn(sourceStore, "write").mockImplementationOnce(async (input) => {
		await db
			.update(editorDraft)
			.set({ revision: 4 })
			.where(eq(editorDraft.id, seeded.id))
		return write(input)
	})

	const first = await drafts.publish(publishItem({ expectedRevision: 2 }))

	expect(first).toMatchObject({ ok: true, outcome: "published-unsynced" })
	// The stamp landed before the Draft was persisted, so a Draft that outlives
	// the publish still agrees with the Source the commit created. The other way
	// round it would disagree forever, and every later publish would commit a
	// fresh timestamp (ADR-0005).
	const kept = await draftData(seeded.id)
	expect(kept).toEqual(committedData())

	const committed = sourceStore.get(SOURCE_PATH)
	tick(LATER)

	const second = await drafts.publish(
		publishItem({ expectedRevision: 4, fields: kept }),
	)

	expect(second).toMatchObject({ ok: true, outcome: "matches-source" })
	expect(sourceStore.get(SOURCE_PATH)).toEqual(committed)
})

test("keeps what the writer typed when a gate refuses the publish", async () => {
	const { drafts, sourceStore } = setup()
	const source = putSource(FIELDS)
	sourceStore.put({
		content: stringifyFrontmatter("Other\n", { slug: "taken", title: "Taken" }),
		path: `${TEST_DIRECTORY_PATH}/taken.md`,
	})
	const seeded = harness.seedDraft({
		itemSlug: "hello",
		markdown: DRAFT_BODY,
		metadata: JSON.stringify(FIELDS),
		publishedRevision: 1,
		revision: 2,
		sourcePath: SOURCE_PATH,
		sourceSha: source.sha,
	})

	const result = await drafts.publish(
		publishItem({
			expectedRevision: 2,
			fields: { ...FIELDS, publishedAt: BACKDATED, slug: "taken" },
		}),
	)

	expect(result).toEqual({ code: "duplicate-slug", ok: false, slug: "taken" })
	// The Draft keeps a bumped `updatedAt` it never committed. Harmless: the
	// Draft is not the Source, and the next successful publish restamps it.
	expect(await draftData(seeded.id)).toMatchObject({
		publishedAt: BACKDATED,
		slug: "taken",
		title: "Hello",
		updatedAt: CREATED,
	})
})

test("keeps what the writer typed when validation refuses the publish", async () => {
	const { drafts } = setup()
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

	const result = await drafts.publish(
		publishItem({
			expectedRevision: 2,
			fields: { ...FIELDS, publishedAt: BACKDATED, title: 42 },
		}),
	)

	expect(result).toEqual({
		code: "validation",
		errors: ["Title must be text"],
		ok: false,
	})
	expect(await draftData(seeded.id)).toMatchObject({
		publishedAt: BACKDATED,
		title: 42,
	})
})

test("keeps what the writer typed when the source moved under the publish", async () => {
	const { drafts } = setup()
	putSource(FIELDS)
	const seeded = harness.seedDraft({
		itemSlug: "hello",
		markdown: DRAFT_BODY,
		metadata: JSON.stringify(FIELDS),
		publishedRevision: 1,
		revision: 2,
		sourcePath: SOURCE_PATH,
		// The Draft was built on a version of the Source that is no longer there.
		sourceSha: "sha-gone",
	})

	const result = await drafts.publish(
		publishItem({
			expectedRevision: 2,
			fields: { ...FIELDS, publishedAt: BACKDATED },
		}),
	)

	expect(result).toEqual({ code: "stale-source", ok: false })
	expect(await draftData(seeded.id)).toMatchObject({ publishedAt: BACKDATED })
})

test("mints a draft for an empty new item the writer set a managed field on", async () => {
	const { drafts } = setup()
	const opened = await drafts.open({ draftId: null, mode: "new" })
	invariant(opened.ok, "a new item always opens")

	// Backdating a publication date is work, even before anything else is typed:
	// only the value the system stamped itself is set aside.
	const result = await drafts.save(
		newItem({
			fields: { ...opened.fields, publishedAt: BACKDATED },
			markdown: "",
		}),
	)

	invariant(result.ok && "draft" in result, "the save mints a draft")
	expect(await draftData(result.draft.id)).toMatchObject({
		createdAt: CREATED,
		publishedAt: BACKDATED,
	})
})
