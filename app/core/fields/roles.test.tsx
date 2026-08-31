import { describe, expect, it } from "vitest"
import type { Field } from "@/config/types"

import { findTitleEntry, resolveTitleKey } from "./roles"

/**
 * Which Field heads a container — the Title Role.
 *
 * Written as characterization tests over the two tiers as they stand before #73
 * folds them into one resolution: the heuristic as the singleton page and both
 * Containers have it, and the Slug-source tier as the collection list and the
 * editor have it. They describe what a reader sees at the top of a page or a
 * row, never how the tiers are stacked.
 */

/** Schema literals are authored, not parsed, so the enum discriminants are cast. */
function field(declaration: Record<string, unknown>): Field {
	return declaration as unknown as Field
}

function entries(declarations: Record<string, Record<string, unknown>>) {
	return Object.entries(declarations).map(
		([key, declaration]) => [key, field(declaration)] as [string, Field],
	)
}

function schema(declarations: Record<string, Record<string, unknown>>) {
	return Object.fromEntries(entries(declarations))
}

////////////////////// THE HEURISTIC TIER //////////////////////

describe("the Field a reader would take for a heading", () => {
	it("takes a title over a name", () => {
		expect(
			findTitleEntry(
				entries({
					name: { type: "text", label: "Name" },
					body: { type: "text", label: "Body" },
					title: { type: "text", label: "Title" },
				}),
			)?.key,
		).toBe("title")
	})

	it("prefers the key the schema author wrote to the label they show", () => {
		expect(
			findTitleEntry(
				entries({
					heading: { type: "text", label: "Title" },
					title: { type: "text", label: "Headline" },
				}),
			)?.key,
		).toBe("title")
	})

	it("reads labels only when no key is title-ish, and ignores case", () => {
		expect(
			findTitleEntry(
				entries({
					moniker: { type: "text", label: "NAME" },
					heading: { type: "text", label: "Title" },
				}),
			)?.key,
		).toBe("heading")
	})

	it("finds nothing when nothing reads as a heading", () => {
		expect(
			findTitleEntry(
				entries({
					body: { type: "text", label: "Body" },
					summary: { type: "text", label: "Summary" },
				}),
			),
		).toBeNull()
	})
})

////////////////////// THE SLUG-SOURCE TIER //////////////////////

describe("the title key of a schema", () => {
	it("is the Slug's source for a Collection, which always declares one", () => {
		expect(
			resolveTitleKey(
				schema({
					headline: { type: "text", label: "Headline" },
					slug: { type: "slug", label: "Slug", from: "headline" },
					body: { type: "document", label: "Content" },
				}),
			),
		).toBe("headline")
	})

	it("takes the Slug's source over a title-ish key", () => {
		expect(
			resolveTitleKey(
				schema({
					headline: { type: "text", label: "Headline" },
					slug: { type: "slug", label: "Slug", from: "headline" },
					title: { type: "text", label: "Title" },
				}),
			),
		).toBe("headline")
	})
})
