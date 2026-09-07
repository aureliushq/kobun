import { expect, test } from "vitest"
import { draftState, isDraftDirty } from "./draft-state"

test("keeps uncommitted and newer revisions dirty", () => {
	expect(isDraftDirty({ committedRevision: null, revision: 0 })).toBe(true)
	expect(isDraftDirty({ committedRevision: 2, revision: 3 })).toBe(true)
})

test("recognizes a committed revision as clean", () => {
	expect(isDraftDirty({ committedRevision: 3, revision: 3 })).toBe(false)
})

test("names a draft with nothing in the repository behind it", () => {
	expect(draftState({ committedRevision: null, revision: 1 })).toBe(
		"never-published",
	)
})

test("names a draft holding changes its source does not have", () => {
	expect(draftState({ committedRevision: 2, revision: 3 })).toBe("dirty")
})

test("names a draft its source has caught up with", () => {
	expect(draftState({ committedRevision: 3, revision: 3 })).toBe("clean")
})
