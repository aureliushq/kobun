import { expect, test } from "vitest"
import { draftState, isDraftDirty } from "./draft-state"

test("keeps unpublished and newer revisions dirty", () => {
	expect(isDraftDirty({ publishedRevision: null, revision: 0 })).toBe(true)
	expect(isDraftDirty({ publishedRevision: 2, revision: 3 })).toBe(true)
})

test("recognizes a published revision as clean", () => {
	expect(isDraftDirty({ publishedRevision: 3, revision: 3 })).toBe(false)
})

test("names a draft with nothing in the repository behind it", () => {
	expect(draftState({ publishedRevision: null, revision: 1 })).toBe(
		"never-published",
	)
})

test("names a draft holding changes its source does not have", () => {
	expect(draftState({ publishedRevision: 2, revision: 3 })).toBe("dirty")
})

test("names a draft its source has caught up with", () => {
	expect(draftState({ publishedRevision: 3, revision: 3 })).toBe("clean")
})
