import { eq } from "drizzle-orm"
import { afterEach, expect, test, vi } from "vitest"
import { editorDraft } from "@/db/schema/app-schema"
import {
	createSingletonDraftsTestHarness,
	type SingletonDraftsTestHarness,
	TEST_DATA_SINGLETON,
	TEST_SINGLETON_PATH,
	TEST_SINGLETON_SLUG,
} from "./test-harness"

/**
 * A Singleton's Drafts: one fixed Source path that may not exist yet, no Slug,
 * no directory to collide in — and otherwise the same lifecycle a Collection
 * Item runs (ADR-0001).
 */

const CONTENT = {
	expectedRevision: null,
	fields: { title: "About us" },
	markdown: "We make things.\n",
}

const SOURCE_CONTENT = "---\ntitle: About\n---\nSource body\n"

let harness: SingletonDraftsTestHarness

function setup(
	options: Parameters<typeof createSingletonDraftsTestHarness>[0] = {},
) {
	harness = createSingletonDraftsTestHarness(options)
	return harness
}

/** The one Draft the Singleton holds. */
async function onlyDraft() {
	const [draft, ...rest] = await harness.db.select().from(editorDraft)
	expect(rest).toEqual([])
	return draft
}

/** Create or replace the Singleton's Source, which mints it a fresh sha. */
function putSource(content = SOURCE_CONTENT) {
	return harness.sourceStore.put({ content, path: TEST_SINGLETON_PATH })
}

afterEach(() => {
	harness?.close()
})

test("opens a Singleton with no Source on its schema defaults without minting a draft", async () => {
	const { db, drafts } = setup()

	const result = await drafts.open()

	expect(result).toEqual({
		content: "",
		dirty: false,
		draftId: null,
		fields: { title: "" },
		ok: true,
		revision: null,
		source: null,
	})
	expect(await db.select().from(editorDraft)).toEqual([])
})

test("mints a draft at the Singleton's fixed path on the first save that carries something", async () => {
	const { db, drafts, projectId } = setup()

	const result = await drafts.save({
		expectedRevision: null,
		fields: { title: "About us" },
		markdown: "We make things.",
	})

	expect(result).toMatchObject({ ok: true, outcome: "saved" })
	expect(await db.select().from(editorDraft)).toEqual([
		expect.objectContaining({
			collectionSlug: null,
			committedRevision: null,
			itemSlug: null,
			markdown: "We make things.",
			metadata: JSON.stringify({ title: "About us" }),
			projectId,
			revision: 1,
			singletonSlug: TEST_SINGLETON_SLUG,
			sourcePath: TEST_SINGLETON_PATH,
			sourceSha: null,
		}),
	])
})

test("reopens the draft of a Singleton that does not exist yet as dirty", async () => {
	const { drafts, seedDraft } = setup()
	const seeded = seedDraft({
		markdown: "We make things.",
		metadata: JSON.stringify({ title: "About us" }),
		revision: 2,
	})

	const result = await drafts.open()

	expect(result).toEqual({
		content: "We make things.",
		dirty: true,
		draftId: seeded.id,
		fields: { title: "About us" },
		ok: true,
		revision: 2,
		source: null,
	})
})

test("publishing a Singleton that does not exist yet creates its Source and deletes the draft", async () => {
	const { db, drafts, sourceStore } = setup()
	const write = vi.spyOn(sourceStore, "write")
	await drafts.save(CONTENT)

	const result = await drafts.publish({ ...CONTENT, expectedRevision: 1 })

	expect(result).toMatchObject({
		draftDeleted: true,
		itemSlug: null,
		ok: true,
		outcome: "committed",
	})
	expect(write).toHaveBeenCalledWith(
		expect.objectContaining({
			expectedSha: undefined,
			message: `Publish ${TEST_SINGLETON_PATH} with Kobun`,
			path: TEST_SINGLETON_PATH,
		}),
	)
	expect(sourceStore.get(TEST_SINGLETON_PATH)?.content).toBe(
		"---\ntitle: About us\n---\nWe make things.\n",
	)
	expect(await db.select().from(editorDraft)).toEqual([])
})

test("drops a clean draft whose Source was deleted, and opens on the schema defaults", async () => {
	const { db, drafts, seedDraft } = setup()
	// Level with a Source that has since been deleted on GitHub: it holds nothing
	// the writer typed, and nothing is left for it to be Clean against.
	seedDraft({ committedRevision: 2, revision: 2, sourceSha: "sha-gone" })

	const result = await drafts.open()

	expect(result).toMatchObject({ dirty: false, draftId: null, revision: null })
	expect(await db.select().from(editorDraft)).toEqual([])
})

test("a save carrying nothing but the defaults mints no draft", async () => {
	const { db, drafts } = setup()

	const result = await drafts.save({
		expectedRevision: null,
		fields: { title: "" },
		markdown: "",
	})

	expect(result).toEqual({
		draftId: null,
		ok: true,
		outcome: "unwritten",
		revision: null,
	})
	expect(await db.select().from(editorDraft)).toEqual([])
})

test("a save against a stale revision is a revision conflict", async () => {
	const { drafts, readDraft, seedDraft } = setup()
	const seeded = seedDraft({ markdown: "Theirs", revision: 2 })

	const result = await drafts.save({ ...CONTENT, expectedRevision: 1 })

	expect(result).toEqual({ code: "revision-conflict", ok: false })
	expect(await readDraft(seeded.id)).toMatchObject({
		markdown: "Theirs",
		revision: 2,
	})
})

test("two sessions minting the Singleton's draft at once is a revision conflict", async () => {
	const { db, drafts, seedDraft } = setup()
	const seeded = seedDraft({ markdown: "Theirs", revision: 1 })
	// Both lookups missed the other session's Draft; the unique index on
	// (projectId, sourcePath) is what reports the race.
	vi.spyOn(db.query.editorDraft, "findFirst")
		.mockResolvedValueOnce(undefined)
		.mockResolvedValueOnce(undefined)

	const result = await drafts.save(CONTENT)

	expect(result).toEqual({ code: "revision-conflict", ok: false })
	expect(await db.select().from(editorDraft)).toEqual([
		expect.objectContaining({ id: seeded.id, markdown: "Theirs" }),
	])
})

test("no other draft can point at the Singleton's Source", () => {
	const { seedDraft } = setup()
	seedDraft({ revision: 1 })

	expect(() =>
		seedDraft({ collectionSlug: "posts", singletonSlug: null }),
	).toThrow(/UNIQUE/)
})

test("a draft belongs to exactly one of a Collection and a Singleton", () => {
	const { seedDraft } = setup()

	expect(() => seedDraft({ collectionSlug: "posts" })).toThrow(/CHECK/)
	expect(() => seedDraft({ singletonSlug: null })).toThrow(/CHECK/)
})

test("Save to GitHub creates the Singleton's Source, then updates it", async () => {
	const { drafts, sourceStore } = setup()
	const write = vi.spyOn(sourceStore, "write")

	const created = await drafts.commit(CONTENT)
	const source = sourceStore.get(TEST_SINGLETON_PATH)
	const updated = await drafts.commit({ ...CONTENT, markdown: "Edited.\n" })

	expect(created).toMatchObject({ ok: true, outcome: "committed" })
	expect(updated).toMatchObject({ ok: true, outcome: "committed" })
	expect(write.mock.calls.map(([input]) => input)).toEqual([
		expect.objectContaining({
			expectedSha: undefined,
			message: `Create ${TEST_SINGLETON_PATH} with Kobun`,
		}),
		expect.objectContaining({
			expectedSha: source?.sha,
			message: `Update ${TEST_SINGLETON_PATH} with Kobun`,
		}),
	])
})

test("Publish refuses invalid metadata that Save to GitHub commits", async () => {
	const { drafts, sourceStore } = setup()
	const invalid = { ...CONTENT, fields: { title: 42 } }

	const published = await drafts.publish(invalid)

	expect(published).toEqual({
		code: "validation",
		errors: ["Title must be text"],
		ok: false,
	})
	expect(sourceStore.get(TEST_SINGLETON_PATH)).toBeUndefined()

	const committed = await drafts.commit({ ...invalid, expectedRevision: 1 })

	expect(committed).toMatchObject({ ok: true, outcome: "committed" })
})

test("opens an existing Singleton on its Source", async () => {
	const { drafts } = setup()
	const source = putSource()

	const result = await drafts.open()

	expect(result).toMatchObject({
		content: "Source body\n",
		dirty: false,
		draftId: null,
		fields: { title: "About" },
		source: { itemSlug: null, path: TEST_SINGLETON_PATH, sha: source.sha },
	})
})

test("reads the Singleton's one file rather than listing the directory it sits in", async () => {
	const { drafts, sourceStore } = setup()
	putSource()
	const list = vi.spyOn(sourceStore, "list")

	await drafts.open()
	await drafts.save(CONTENT)
	await drafts.commit(CONTENT)

	expect(list).not.toHaveBeenCalled()
})

test("a save matching the Source needs no draft", async () => {
	const { db, drafts } = setup()
	putSource()

	const result = await drafts.save({
		expectedRevision: null,
		fields: { title: "About" },
		markdown: "Source body\n",
	})

	expect(result).toMatchObject({ ok: true, outcome: "matches-source" })
	expect(await db.select().from(editorDraft)).toEqual([])
})

test("refuses to commit over a Source that moved under the draft", async () => {
	const { drafts, sourceStore } = setup()
	putSource()
	await drafts.save(CONTENT)
	const moved = putSource("---\ntitle: Theirs\n---\nTheirs\n")

	const result = await drafts.commit({ ...CONTENT, expectedRevision: 1 })

	expect(result).toEqual({ code: "stale-source", ok: false })
	expect(sourceStore.get(TEST_SINGLETON_PATH)).toEqual(moved)
	expect(await onlyDraft()).toMatchObject({ markdown: CONTENT.markdown })
})

test("refuses to commit over a Source created since the draft was started", async () => {
	const { drafts, sourceStore } = setup()
	await drafts.save(CONTENT)
	const created = putSource()

	const result = await drafts.publish({ ...CONTENT, expectedRevision: 1 })

	expect(result).toEqual({ code: "stale-source", ok: false })
	expect(sourceStore.get(TEST_SINGLETON_PATH)).toEqual(created)
	expect(await onlyDraft()).toMatchObject({ markdown: CONTENT.markdown })
})

test("refuses to commit a draft whose Source was deleted since", async () => {
	const { drafts, seedDraft, sourceStore } = setup()
	seedDraft({ committedRevision: 1, revision: 2, sourceSha: "sha-gone" })

	const result = await drafts.commit({ ...CONTENT, expectedRevision: 2 })

	expect(result).toEqual({ code: "stale-source", ok: false })
	expect(sourceStore.get(TEST_SINGLETON_PATH)).toBeUndefined()
})

test("reports a stale Source when the store refuses the write", async () => {
	const { drafts, sourceStore } = setup()
	putSource()
	sourceStore.setStale(TEST_SINGLETON_PATH)

	const result = await drafts.publish(CONTENT)

	expect(result).toEqual({ code: "stale-source", ok: false })
})

test("keeps a dirty draft over a moved Source and rebases a clean one", async () => {
	const { drafts, readDraft, seedDraft } = setup()
	const original = putSource()
	const dirty = seedDraft({
		committedRevision: 1,
		markdown: "Mine\n",
		revision: 2,
		sourceSha: original.sha,
	})
	const moved = putSource("---\ntitle: Theirs\n---\nTheirs\n")

	expect(await drafts.open()).toMatchObject({
		content: "Mine\n",
		dirty: true,
		draftId: dirty.id,
	})

	await harness.db
		.update(editorDraft)
		.set({ committedRevision: 2 })
		.where(eq(editorDraft.id, dirty.id))

	expect(await drafts.open()).toMatchObject({
		content: "Theirs\n",
		dirty: false,
		draftId: dirty.id,
	})
	expect(await readDraft(dirty.id)).toMatchObject({
		committedRevision: 3,
		revision: 3,
		sourceSha: moved.sha,
	})
})

test("publishing content the Source already holds commits nothing and drops the draft", async () => {
	const { db, drafts, sourceStore } = setup()
	const source = putSource()
	await drafts.save(CONTENT)

	const result = await drafts.publish({
		expectedRevision: 1,
		fields: { title: "About" },
		markdown: "Source body\n",
	})

	expect(result).toMatchObject({
		itemSlug: null,
		ok: true,
		outcome: "matches-source",
	})
	expect(sourceStore.get(TEST_SINGLETON_PATH)).toEqual(source)
	expect(await db.select().from(editorDraft)).toEqual([])
})

test("a draft the sync could not claim survives, pointed at the Source the commit created", async () => {
	const { db, drafts, readDraft, sourceStore } = setup()
	await drafts.save(CONTENT)
	const { id: draftId } = await onlyDraft()
	// Another session saves while we are committing.
	const write = sourceStore.write
	vi.spyOn(sourceStore, "write").mockImplementationOnce(async (input) => {
		await db
			.update(editorDraft)
			.set({ revision: 2 })
			.where(eq(editorDraft.id, draftId))
		return write(input)
	})

	const result = await drafts.publish({ ...CONTENT, expectedRevision: 1 })

	expect(result).toMatchObject({ ok: true, outcome: "committed-unsynced" })
	expect(await readDraft(draftId)).toMatchObject({
		revision: 2,
		sourcePath: TEST_SINGLETON_PATH,
		sourceSha: sourceStore.get(TEST_SINGLETON_PATH)?.sha,
	})
})

test("a data-only Singleton opens with no body and commits its Data alone", async () => {
	const path = "content/singletons/site.json"
	const { drafts, sourceStore } = setup({
		filePath: path,
		singleton: TEST_DATA_SINGLETON,
	})
	sourceStore.put({ content: '{\n\t"title": "Site"\n}\n', path })

	expect(await drafts.open()).toMatchObject({
		content: "",
		fields: { title: "Site" },
	})

	const result = await drafts.publish({
		expectedRevision: null,
		fields: { title: "Renamed" },
		markdown: "",
	})

	expect(result).toMatchObject({ ok: true, outcome: "committed" })
	expect(sourceStore.get(path)?.content).toBe('{\n\t"title": "Renamed"\n}\n')
})

test("refuses to keep a Body for a data-only Singleton rather than dropping it", async () => {
	const path = "content/singletons/site.json"
	const { db, drafts } = setup({
		filePath: path,
		singleton: TEST_DATA_SINGLETON,
	})

	const result = await drafts.save({
		expectedRevision: null,
		fields: { title: "Site" },
		markdown: "A body a json file cannot hold.",
	})

	expect(result).toEqual({
		code: "validation",
		errors: ["A json document has no Body"],
		ok: false,
	})
	expect(await db.select().from(editorDraft)).toEqual([])
})

test("refuses to commit a Body for a data-only Singleton, writing nothing", async () => {
	const path = "content/singletons/site.json"
	const { db, drafts, sourceStore } = setup({
		filePath: path,
		singleton: TEST_DATA_SINGLETON,
	})

	const result = await drafts.commit({
		expectedRevision: null,
		fields: { title: "Site" },
		markdown: "A body a json file cannot hold.",
	})

	expect(result).toEqual({
		code: "validation",
		errors: ["A json document has no Body"],
		ok: false,
	})
	expect(sourceStore.get(path)).toBeUndefined()
	expect(await db.select().from(editorDraft)).toEqual([])
})
