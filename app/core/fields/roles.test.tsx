import { describe, expect, it } from "vitest"
import type { Field } from "@/config/types"

import { findTitleEntries, resolveTitle, resolveTitleKey } from "./roles"

/**
 * Which Field heads a container — the Title Role.
 *
 * Written as characterization tests over the two tiers before they were folded
 * into one resolution: the heuristic as the singleton page and both Containers
 * had it, and the Slug's source Field as the collection list and the editor had
 * it. They describe what a reader sees at the top of a page or a row, never how
 * the tiers are stacked.
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

function keysOf(found: { key: string }[]) {
	return found.map((title) => title.key)
}

////////////////////// THE HEURISTIC TIER //////////////////////

describe("the Fields a reader would take for a heading", () => {
	it("takes a title over a name, and hands back both", () => {
		expect(
			keysOf(
				findTitleEntries(
					entries({
						name: { type: "text", label: "Name" },
						body: { type: "text", label: "Body" },
						title: { type: "text", label: "Title" },
					}),
				),
			),
		).toEqual(["title", "name"])
	})

	it("prefers the key the schema author wrote to the label they show", () => {
		expect(
			keysOf(
				findTitleEntries(
					entries({
						heading: { type: "text", label: "Title" },
						title: { type: "text", label: "Headline" },
					}),
				),
			),
		).toEqual(["title"])
	})

	it("reads labels only when no key is title-ish, and ignores case", () => {
		expect(
			keysOf(
				findTitleEntries(
					entries({
						moniker: { type: "text", label: "NAME" },
						heading: { type: "text", label: "Title" },
					}),
				),
			),
		).toEqual(["heading", "moniker"])
	})

	it("finds nothing when nothing reads as a heading", () => {
		expect(
			findTitleEntries(
				entries({
					body: { type: "text", label: "Body" },
					summary: { type: "text", label: "Summary" },
				}),
			),
		).toEqual([])
	})
})

////////////////////// THE ROLE //////////////////////

describe("the Field that heads a container", () => {
	it("takes the Slug's source over a title-ish key", () => {
		const found = resolveTitle(
			entries({
				headline: { type: "text", label: "Headline" },
				slug: { type: "slug", label: "Slug", from: "headline" },
				title: { type: "text", label: "Title" },
			}),
		)
		expect(found?.key).toBe("headline")
		expect(found?.field.label).toBe("Headline")
	})

	it("falls back to the heuristic when nothing carries the Slug Role", () => {
		expect(
			resolveTitle(
				entries({
					body: { type: "text", label: "Body" },
					title: { type: "text", label: "Title" },
				}),
			)?.key,
		).toBe("title")
	})

	// A composite array row addresses its Fields by item label, so a Slug's
	// `from` — a key in the top-level schema — can point outside the entries
	// being resolved. A tier that cannot answer hands over to the next.
	it("falls back to the heuristic when the Slug's source is not one of these Fields", () => {
		expect(
			resolveTitle(
				entries({
					Slug: { type: "slug", label: "Slug", from: "headline" },
					Title: { type: "text", label: "Title" },
				}),
			)?.key,
		).toBe("Title")
	})

	it("answers nothing when neither tier does", () => {
		expect(
			resolveTitle(entries({ body: { type: "text", label: "Body" } })),
		).toBeNull()
	})
})

////////////////////// THE ROLE, OVER A SCHEMA //////////////////////

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

	it("is the title-ish Field for a Singleton, which may declare no Slug", () => {
		expect(
			resolveTitleKey(
				schema({
					body: { type: "document", label: "Content" },
					name: { type: "text", label: "Name" },
				}),
			),
		).toBe("name")
	})

	it("is nothing when the schema has neither", () => {
		expect(
			resolveTitleKey(schema({ body: { type: "document", label: "Content" } })),
		).toBeNull()
	})
})
