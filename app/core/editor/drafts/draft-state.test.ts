import { expect, test } from "vitest"
import { isDraftDirty } from "./draft-state"

test("keeps unpublished and newer revisions dirty", () => {
	expect(isDraftDirty({ publishedRevision: null, revision: 0 })).toBe(true)
	expect(isDraftDirty({ publishedRevision: 2, revision: 3 })).toBe(true)
})

test("recognizes a published revision as clean", () => {
	expect(isDraftDirty({ publishedRevision: 3, revision: 3 })).toBe(false)
})
