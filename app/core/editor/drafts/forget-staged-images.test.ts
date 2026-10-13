import { eq } from "drizzle-orm"
import { afterEach, expect, test } from "vitest"
import { stagedImageIds } from "@/core/editor/staged-images"
import { editorDraft } from "@/db/schema/app-schema"
import { forgetStagedImages } from "./forget-staged-images.server"
import {
	createDraftsTestHarness,
	type DraftsTestHarness,
	TEST_DIRECTORY_PATH,
} from "./test-harness"

/**
 * Discarding a Draft (#215): the route deletes the row, then forgets the
 * images its Body linked to, unless another Draft of the Project links them.
 */

const CAT = "0b6f1c8e-4b1a-4d8e-9f2a-3c5d7e9f1a2b.png"
const DOG = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.jpg"
const BYTES = new Uint8Array([1, 2, 3])

let harness: DraftsTestHarness

afterEach(() => {
	harness?.close()
})

async function discard(draftId: string) {
	const { db, projectId, stagedImages } = harness
	const draft = await harness.readDraft(draftId)
	await db.delete(editorDraft).where(eq(editorDraft.id, draftId))
	await forgetStagedImages(
		db,
		projectId,
		stagedImages,
		stagedImageIds(draft?.markdown ?? "", stagedImages.baseUrl),
	)
}

test("discarding a Draft forgets the images it linked to", async () => {
	harness = createDraftsTestHarness()
	const cat = harness.stagedImages.put(CAT, BYTES)
	const dog = harness.stagedImages.put(DOG, BYTES)
	const draft = harness.seedDraft({
		markdown: `![A cat](${cat})\n\n![A dog](http://localhost:5173${dog})\n`,
	})

	await discard(draft.id)

	expect(harness.stagedImages.has(CAT)).toBe(false)
	expect(harness.stagedImages.has(DOG)).toBe(false)
})

test("discarding a Draft keeps an image another Draft still links to", async () => {
	harness = createDraftsTestHarness()
	const cat = harness.stagedImages.put(CAT, BYTES)
	const dog = harness.stagedImages.put(DOG, BYTES)
	const draft = harness.seedDraft({ markdown: `![](${cat})\n![](${dog})\n` })
	harness.seedDraft({
		markdown: `![](${cat})\n`,
		sourcePath: `${TEST_DIRECTORY_PATH}/other.md`,
	})

	await discard(draft.id)

	expect(harness.stagedImages.has(CAT)).toBe(true)
	expect(harness.stagedImages.has(DOG)).toBe(false)
})
