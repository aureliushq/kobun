import { describe, expect, it } from "vitest"
import type { Collection, ResolvedField } from "@/config/types"
import { draftHeading } from "./draft-summary"

const collectionWith = (schema: Record<string, unknown>): Collection =>
	({
		format: "md",
		label: "Blog",
		schema: schema as Record<string, ResolvedField>,
	}) as Collection

/**
 * The ordinary Collection: a Slug derived from `title`, and a Body. Every
 * fixture here declares a Slug whose source Field exists, because the config
 * layer refuses a Collection that does not — a schema the Title Role has to
 * fall through to its heuristic over is one this module can never be handed.
 */
const BLOG = collectionWith({
	body: { format: "md", label: "Body", type: "document" },
	slug: { from: "title", label: "Slug", type: "slug" },
	title: { label: "Title", type: "text" },
})

/** The same Collection, headed by a Field nobody would have guessed at. */
const BY_SLUG_SOURCE = collectionWith({
	headline: { label: "Headline", type: "text" },
	slug: { from: "headline", label: "Slug", type: "slug" },
})

const draft = (metadata: unknown, markdown = "") => ({
	markdown,
	metadata: metadata === undefined ? null : JSON.stringify(metadata),
})

describe("draftHeading", () => {
	it("reads the Field the Slug Role derives from", () => {
		expect(draftHeading(draft({ headline: "Ship it" }), BY_SLUG_SOURCE)).toBe(
			"Ship it",
		)
	})

	it("keeps a long title whole — the card, not this, decides where it ends", () => {
		const long = "A".repeat(200)

		expect(draftHeading(draft({ title: long }), BLOG)).toBe(long)
	})

	it("reads a non-string Title value as text", () => {
		expect(draftHeading(draft({ title: 2026 }), BLOG)).toBe("2026")
	})

	describe("with no Title yet", () => {
		it("excerpts the body the writer has typed", () => {
			expect(draftHeading(draft({}, "The quick brown fox jumps"), BLOG)).toBe(
				"The quick brown fox jumps…",
			)
		})

		it("treats a blank Title as no Title", () => {
			expect(
				draftHeading(draft({ title: "   " }, "Something typed"), BLOG),
			).toBe("Something typed…")
		})

		it("skips blank lines and strips the marker off a heading", () => {
			expect(draftHeading(draft({}, "\n\n## On writing\n\nBody"), BLOG)).toBe(
				"On writing…",
			)
		})

		it("strips a list marker and a quote marker", () => {
			expect(draftHeading(draft({}, "- first thing"), BLOG)).toBe(
				"first thing…",
			)
			expect(draftHeading(draft({}, "> quoted"), BLOG)).toBe("quoted…")
		})

		it("strips inline emphasis and collapses whitespace", () => {
			expect(draftHeading(draft({}, "**Bold**   and\t_soft_"), BLOG)).toBe(
				"Bold and soft…",
			)
		})

		it("leaves an underscore inside a word alone", () => {
			expect(draftHeading(draft({}, "the snake_case key"), BLOG)).toBe(
				"the snake_case key…",
			)
		})

		it("takes only the first few words", () => {
			const line = "one two three four five six seven eight nine ten eleven"

			expect(draftHeading(draft({}, line), BLOG)).toBe(
				"one two three four five six seven eight nine ten…",
			)
		})

		it("says Untitled when there is no body either", () => {
			expect(draftHeading(draft({}, "   \n\n"), BLOG)).toBe("Untitled")
		})
	})

	describe("with nothing to resolve a Title against", () => {
		// The Project's Config no longer declares this Collection, so there is no
		// schema to ask which Field carries the Title Role — and guessing at the
		// Data's keys would be answering for a Role that is not there.
		it("excerpts the body when there is no Collection", () => {
			expect(draftHeading(draft({ title: "Ship it" }, "Body text"), null)).toBe(
				"Body text…",
			)
		})

		it("does not throw on metadata that is not JSON", () => {
			expect(draftHeading({ markdown: "Body text", metadata: "{" }, BLOG)).toBe(
				"Body text…",
			)
		})

		it("does not throw on metadata that is not an object", () => {
			expect(draftHeading(draft(42, "Body text"), BLOG)).toBe("Body text…")
		})
	})
})
