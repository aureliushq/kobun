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
import type { CommitInput, DraftContent } from "./types"

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

function publishItem(overrides: Partial<DraftContent> = {}): CommitInput {
	return {
		expectedRevision: null,
		fields: FIELDS,
		markdown: DRAFT_BODY,
		...overrides,
		mode: "item",
		slug: "hello",
	}
}

function newItem(overrides: Partial<DraftContent> = {}): CommitInput {
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
		outcome: "committed",
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

test("backfills the three timestamps and a status onto a source that lacks them", async () => {
	const { drafts } = setup()
	putSource(FIELDS)

	const result = await drafts.publish(publishItem())

	expect(result).toMatchObject({ ok: true, outcome: "committed" })
	// Publish is the one thing that writes Publication State and it always writes
	// `published` — including onto a pre-existing Source with no `status` key,
	// which #87 forbade. The button exists only where the config author turned the
	// Feature on, which is itself the statement that `status` is Kobun's to manage
	// here (ADR-0008).
	expect(committedData()).toEqual({
		...FIELDS,
		createdAt: CREATED,
		publishedAt: CREATED,
		status: "published",
		updatedAt: CREATED,
	})
})

test("advances updatedAt on a later publish and keeps createdAt and publishedAt", async () => {
	const { drafts } = setup()
	const stamped = {
		...FIELDS,
		createdAt: CREATED,
		publishedAt: CREATED,
		status: "published",
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

	// Backdating an imported post's publication date is ordinary writing work
	// (ADR-0005, as amended). Taking it back to a draft is too — but through Save
	// to GitHub, since Publish is the act of declaring it published.
	await drafts.publish(
		publishItem({ fields: { ...source, publishedAt: BACKDATED } }),
	)

	expect(committedData()).toMatchObject({
		publishedAt: BACKDATED,
		status: "published",
	})
})

test("commits a publication state transition with nothing else to commit", async () => {
	const { drafts } = setup()
	const source = { ...FIELDS, status: "draft" }
	putSource(source)

	// Byte for byte what the Source already holds — except the state the writer
	// pressed Publish to declare.
	const result = await drafts.publish(
		publishItem({ fields: source, markdown: SOURCE_BODY }),
	)

	// The intent stamp lands before the comparison, so the transition is itself
	// the change and the matches-Source short-circuit cannot swallow it.
	expect(result).toMatchObject({ ok: true, outcome: "committed" })
	expect(committedData()).toMatchObject({ status: "published" })
})

test("flips a committed draft to published when nothing else changed", async () => {
	const { drafts } = setup()
	const opened = await drafts.open({ draftId: null, mode: "new" })
	invariant(opened.ok, "a new item always opens")

	// Save to GitHub commits whatever the writer's fields already said, which for
	// a new item is the `draft` the Status Field defaults to.
	const committed = await drafts.commit(
		newItem({ fields: { ...opened.fields, ...FIELDS } }),
	)
	expect(committed).toMatchObject({ ok: true, outcome: "committed" })
	expect(committedData()).toMatchObject({ publishedAt: "", status: "draft" })

	// Reopening reads Publication State from the Source; the Draft is gone.
	const reopened = await drafts.open({ mode: "item", slug: "hello" })
	invariant(reopened.ok, "the committed item opens")
	expect(reopened.fields).toMatchObject({ status: "draft" })
	tick(LATER)

	const published = await drafts.publish(
		publishItem({
			expectedRevision: reopened.revision,
			fields: reopened.fields,
			markdown: reopened.content,
		}),
	)

	expect(published).toMatchObject({ ok: true, outcome: "committed" })
	expect(committedData()).toMatchObject({
		createdAt: CREATED,
		// Only the action that publishes may write it, so this is the first time.
		publishedAt: LATER,
		status: "published",
		updatedAt: LATER,
	})
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
		committedRevision: 1,
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

	expect(first).toMatchObject({ ok: true, outcome: "committed-unsynced" })
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
		committedRevision: 1,
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
	// Exactly what the writer typed, and nothing the refused publish would have
	// stamped: the stamps go in only once every gate has passed. A `status:
	// published` left behind here is the one that matters — the next Save to
	// GitHub would commit it verbatim.
	expect(await draftData(seeded.id)).toEqual({
		publishedAt: BACKDATED,
		slug: "taken",
		title: "Hello",
	})
})

test("names the commit for the publication it is", async () => {
	const { drafts, sourceStore } = setup()
	putSource(FIELDS)
	const write = vi.spyOn(sourceStore, "write")

	await drafts.publish(publishItem())

	// The publish is the notable event in a reviewer's history; a plain commit is
	// a file change (ADR-0008).
	expect(write.mock.calls[0]?.[0]).toMatchObject({
		message: `Publish ${SOURCE_PATH} with Kobun`,
	})
})

test("stamps nothing into the draft when a refused publish never happened", async () => {
	const { drafts } = setup()
	const source = putSource({ ...FIELDS, status: "draft" })
	const seeded = harness.seedDraft({
		itemSlug: "hello",
		markdown: DRAFT_BODY,
		metadata: JSON.stringify(FIELDS),
		committedRevision: 1,
		revision: 2,
		sourcePath: SOURCE_PATH,
		sourceSha: source.sha,
	})

	const result = await drafts.publish(
		publishItem({
			expectedRevision: 2,
			fields: { ...FIELDS, status: "draft", title: 42 },
		}),
	)

	expect(result).toMatchObject({ code: "validation", ok: false })
	expect(await draftData(seeded.id)).toMatchObject({ status: "draft" })

	// The publish did not happen, so the Save to GitHub after it commits the
	// writer's own `draft` — not an intent the refusal left lying around.
	await drafts.commit(
		publishItem({
			expectedRevision: 3,
			fields: { ...FIELDS, status: "draft" },
		}),
	)

	expect(committedData()).toMatchObject({ status: "draft" })
})

test("keeps what the writer typed when validation refuses the publish", async () => {
	const { drafts } = setup()
	const source = putSource(FIELDS)
	const seeded = harness.seedDraft({
		itemSlug: "hello",
		markdown: DRAFT_BODY,
		metadata: JSON.stringify(FIELDS),
		committedRevision: 1,
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
		committedRevision: 1,
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
