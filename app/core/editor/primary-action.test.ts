import { describe, expect, it } from "vitest"

import {
	DEFAULT_PRIMARY_EDITOR_ACTION,
	isPrimaryEditorAction,
	toPrimaryEditorAction,
} from "./primary-action"

/**
 * Which of the two targets the split control's primary button runs (#107), now
 * that the choice is a row rather than a cookie (#143).
 *
 * The default is pinned here on purpose. It is a decision made on a writer's
 * behalf — the one action whose accidental press costs nothing — and a silent
 * change to it would put a commit in somebody's repository. What the column
 * defaults to is checked against it in `stored-primary-action.test.ts`, from the
 * side where the import runs the right way round.
 */

describe("the primary action a writer has never chosen", () => {
	it("is Save, so a first click cannot reach the repository", () => {
		expect(DEFAULT_PRIMARY_EDITOR_ACTION).toBe("save")
	})

	// No row is the ordinary case, not an error: a row is written the first time
	// a writer changes something, and most never will.
	it("is what a writer with no row at all answers with", () => {
		expect(toPrimaryEditorAction(null)).toBe("save")
	})

	it("is what an unrecognised stored value falls back to rather than throwing", () => {
		expect(toPrimaryEditorAction("publish")).toBe("save")
		expect(toPrimaryEditorAction("")).toBe("save")
	})
})

describe("the choice a writer did make", () => {
	it("comes back out of the row as the target it named", () => {
		for (const action of ["save", "commit"] as const) {
			expect(toPrimaryEditorAction(action)).toBe(action)
		}
	})
})

describe("what counts as a target at all", () => {
	it("admits the two the split control offers", () => {
		expect(isPrimaryEditorAction("save")).toBe(true)
		expect(isPrimaryEditorAction("commit")).toBe(true)
	})

	// Publish is a separate button and never a primary (ADR-0008), so it must
	// not be settable through the same door.
	it("refuses Publish, and anything that is not a string", () => {
		expect(isPrimaryEditorAction("publish")).toBe(false)
		expect(isPrimaryEditorAction(null)).toBe(false)
		expect(isPrimaryEditorAction(undefined)).toBe(false)
	})
})
