import { afterEach, expect, test } from "vitest"
import { parseDocument } from "@/core/content/document.server"
import { stringifyFrontmatter } from "@/lib/frontmatter"
import {
	createDraftsTestHarness,
	createSingletonDraftsTestHarness,
	type DraftsTestHarness,
	type SingletonDraftsTestHarness,
	TEST_COLLECTION_WITH_FEATURES,
	TEST_DIRECTORY_PATH,
	TEST_MEDIA_PATH,
	TEST_SINGLETON_PATH,
} from "./test-harness"
import type { CommitInput } from "./types"

/**
 * A Staged Image reaches the repository the way a Draft does: by a Commit. The
 * images the Body uses land in the media directory in the same commit as the
 * Body, which links them by their repository path, and the staged copies are
 * forgotten only once that commit has landed.
 */

const FIELDS = { slug: "hello", title: "Hello" }
const SOURCE_PATH = `${TEST_DIRECTORY_PATH}/hello.md`
const CAT = "0b6f1c8e-4b1a-4d8e-9f2a-3c5d7e9f1a2b.png"
const DOG = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.jpg"
const CAT_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff])
const DOG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x80])

let harness: DraftsTestHarness | SingletonDraftsTestHarness

afterEach(() => {
	harness?.close()
})

function setup(options: Parameters<typeof createDraftsTestHarness>[0] = {}) {
	const created = createDraftsTestHarness(options)
	harness = created
	created.sourceStore.put({
		content: stringifyFrontmatter("Old body\n", FIELDS),
		path: SOURCE_PATH,
	})
	return created
}

function commitItem(markdown: string): CommitInput {
	return {
		expectedRevision: null,
		fields: FIELDS,
		markdown,
		mode: "item",
		slug: "hello",
	}
}

function committedBody(path = SOURCE_PATH) {
	return parseDocument(harness.sourceStore.get(path)?.content ?? "", "md").body
}

test("Save to GitHub writes each Staged Image to the media directory and links it there", async () => {
	const { drafts, sourceStore, stagedImages } = setup()
	const cat = stagedImages.put(CAT, CAT_BYTES)

	const result = await drafts.commit(commitItem(`Look:\n\n![A cat](${cat})\n`))

	expect(result).toMatchObject({
		images: { [cat]: `${TEST_MEDIA_PATH}/${CAT}` },
		ok: true,
		outcome: "committed",
	})
	expect(sourceStore.getImage(`${TEST_MEDIA_PATH}/${CAT}`)).toEqual(CAT_BYTES)
	expect(committedBody()).toBe(`Look:\n\n![A cat](${TEST_MEDIA_PATH}/${CAT})\n`)
	expect(stagedImages.has(CAT)).toBe(false)
})

test("Publish writes the images in the commit that publishes the item", async () => {
	const { drafts, sourceStore, stagedImages } = setup({
		collection: TEST_COLLECTION_WITH_FEATURES,
	})
	const cat = stagedImages.put(CAT, CAT_BYTES)
	const dog = stagedImages.put(DOG, DOG_BYTES)

	const result = await drafts.publish(
		commitItem(`![A cat](${cat})\n\n![A dog](${dog} "Dog")\n`),
	)

	expect(result).toMatchObject({ ok: true, outcome: "committed" })
	expect(sourceStore.getImage(`${TEST_MEDIA_PATH}/${CAT}`)).toEqual(CAT_BYTES)
	expect(sourceStore.getImage(`${TEST_MEDIA_PATH}/${DOG}`)).toEqual(DOG_BYTES)
	expect(committedBody()).toBe(
		`![A cat](${TEST_MEDIA_PATH}/${CAT})\n\n![A dog](${TEST_MEDIA_PATH}/${DOG} "Dog")\n`,
	)
	expect(stagedImages.has(CAT)).toBe(false)
	expect(stagedImages.has(DOG)).toBe(false)
})

test("an image the writer removed from the Body is not committed", async () => {
	const { drafts, sourceStore, stagedImages } = setup()
	const cat = stagedImages.put(CAT, CAT_BYTES)
	stagedImages.put(DOG, DOG_BYTES)

	await drafts.commit(commitItem(`![A cat](${cat})\n`))

	expect(sourceStore.getImage(`${TEST_MEDIA_PATH}/${DOG}`)).toBeUndefined()
	expect(stagedImages.has(DOG)).toBe(true)
})

test("a commit the repository refuses keeps every image staged", async () => {
	const { drafts, sourceStore, stagedImages } = setup()
	const cat = stagedImages.put(CAT, CAT_BYTES)
	sourceStore.setStale(SOURCE_PATH)

	const result = await drafts.commit(commitItem(`![A cat](${cat})\n`))

	expect(result).toEqual({ code: "stale-source", ok: false })
	expect(sourceStore.getImage(`${TEST_MEDIA_PATH}/${CAT}`)).toBeUndefined()
	expect(stagedImages.has(CAT)).toBe(true)
	// The Draft still links the staged copy: the repository path it would have
	// had names nothing, and a retry has to find the image to commit it.
	const opened = await drafts.open({ mode: "item", slug: "hello" })
	expect(opened).toMatchObject({ content: `![A cat](${cat})\n`, ok: true })
})

test("refuses a Body linking to an image that is no longer staged, and keeps what the writer typed", async () => {
	const { drafts, sourceStore, stagedImages } = setup()
	const cat = `${stagedImages.baseUrl}/${CAT}`
	const markdown = `![A cat](${cat})\n`

	const result = await drafts.commit(commitItem(markdown))

	expect(result).toEqual({ code: "missing-image", ok: false })
	expect(committedBody()).toBe("Old body\n")
	const opened = await drafts.open({ mode: "item", slug: "hello" })
	expect(opened).toMatchObject({ content: markdown, ok: true })
	expect(sourceStore.getImage(`${TEST_MEDIA_PATH}/${CAT}`)).toBeUndefined()
})

test("a Singleton's Body commits its images the same way", async () => {
	const singletonHarness = createSingletonDraftsTestHarness()
	harness = singletonHarness
	const { drafts, sourceStore, stagedImages } = singletonHarness
	const cat = stagedImages.put(CAT, CAT_BYTES)

	const result = await drafts.commit({
		expectedRevision: null,
		fields: { title: "About" },
		markdown: `![A cat](${cat})\n`,
	})

	expect(result).toMatchObject({ ok: true, outcome: "committed" })
	expect(sourceStore.getImage(`${TEST_MEDIA_PATH}/${CAT}`)).toEqual(CAT_BYTES)
	expect(committedBody(TEST_SINGLETON_PATH)).toBe(
		`![A cat](${TEST_MEDIA_PATH}/${CAT})\n`,
	)
})
