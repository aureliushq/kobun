import { isRouteErrorResponse } from "react-router"
import { describe, expect, it, vi } from "vitest"

import { openCollectionItem } from "./collection-editor"

/**
 * The error contract of the half this route streams (#104).
 *
 * Once the Source read moved behind a `Suspense` the two ways it can fail stopped
 * being interchangeable, because the wire is lossy: the turbo-stream encoder
 * preserves an `ErrorResponse` and nothing else useful — a thrown `Response`
 * arrives as an empty object, and a plain `Error` is sanitized to "Unexpected
 * Server Error" outside development. So the 404 a Slug that names nothing must
 * still answer is the one rejection whose shape is load-bearing, and this pins
 * it. `openCollectionItem` is exported for exactly this.
 */

// Tiptap comes in through the view this route renders, and none of it is under
// test here.
vi.mock("@/editor", () => ({
	EditorWordCount: () => null,
	RichTextEditor: () => null,
}))

const drafts = (open: () => Promise<unknown>) => ({ open }) as never

describe("opening a Collection Item that is not there", () => {
	it("rejects as a 404 the route's error boundary can read", async () => {
		const error = await openCollectionItem(
			drafts(async () => ({ code: "not-found", ok: false })),
			{ mode: "item", slug: "gone" },
		).catch((rejection: unknown) => rejection)

		expect(isRouteErrorResponse(error)).toBe(true)
		expect((error as { status: number }).status).toBe(404)
	})

	// A GitHub outage is not a missing item, and must not be dressed as one: the
	// writer is told to try again, not that their work has vanished.
	it("lets a failed read reject as itself", async () => {
		const failure = new Error("github exploded")

		const error = await openCollectionItem(
			drafts(async () => {
				throw failure
			}),
			{ mode: "item", slug: "hello" },
		).catch((rejection: unknown) => rejection)

		expect(error).toBe(failure)
		expect(isRouteErrorResponse(error)).toBe(false)
	})

	it("hands the Effective Content straight through when it is there", async () => {
		const opened = await openCollectionItem(
			drafts(async () => ({
				content: "Once upon a time.",
				draftId: "draft-1",
				fields: { title: "Hello" },
				ok: true,
				revision: 3,
				source: { itemSlug: "hello" },
			})),
			{ mode: "item", slug: "hello" },
		)

		expect(opened).toEqual({
			content: "Once upon a time.",
			draftId: "draft-1",
			fields: { title: "Hello" },
			revision: 3,
		})
	})
})
