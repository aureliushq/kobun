import { expect, test } from "vitest"
import { draftMarker, isDraftDirty } from "./draft-state"

test("keeps uncommitted and newer revisions dirty", () => {
	expect(isDraftDirty({ committedRevision: null, revision: 0 })).toBe(true)
	expect(isDraftDirty({ committedRevision: 2, revision: 3 })).toBe(true)
})

test("recognizes a committed revision as clean", () => {
	expect(isDraftDirty({ committedRevision: 3, revision: 3 })).toBe(false)
})

test("marks a draft with nothing in the repository behind it", () => {
	expect(
		draftMarker({ committedRevision: null, revision: 1, sourcePath: null }),
	).toBe("NOT_IN_REPOSITORY")
})

// The case the old three-state classification got wrong: opening an existing
// Source and typing leaves no Committed Revision either, but the file is in the
// repository — what is behind is the repository, not the whole item.
test("marks a draft opened over a source kobun never committed", () => {
	expect(
		draftMarker({
			committedRevision: null,
			revision: 1,
			sourcePath: "content/posts/hello.md",
		}),
	).toBe("UNCOMMITTED_CHANGES")
})

test("marks a draft holding changes its source does not have", () => {
	expect(
		draftMarker({
			committedRevision: 2,
			revision: 3,
			sourcePath: "content/posts/hello.md",
		}),
	).toBe("UNCOMMITTED_CHANGES")
})

test("marks a draft its source has caught up with", () => {
	expect(
		draftMarker({
			committedRevision: 3,
			revision: 3,
			sourcePath: "content/posts/hello.md",
		}),
	).toBe("COMMITTED")
})
