import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import type { Collection, ResolvedField } from "@/config/types"

import { type CollectionItem, CollectionTable } from "./collection-table"

/**
 * What a Collection's list shows while its listing is still streaming, and once
 * it lands (#103).
 *
 * `items` is the whole of the split: `null` is the half the page paints before
 * GitHub answers, an array is the half that replaces it. The assertions are
 * about what a writer can see and reach in each — never about the table
 * instance underneath, which is TanStack's to test.
 */

/** Schema literals are authored, not parsed, so the enum discriminants are cast. */
const SCHEMA = {
	slug: { from: "title", label: "Slug", type: "slug" },
	title: { label: "Title", type: "text" },
} as unknown as Record<string, ResolvedField>

const POSTS = { label: "Posts", schema: SCHEMA } as unknown as Collection

const EDITOR_BASE = "/acme/site/collections/posts/editor"

function item(overrides: Partial<CollectionItem> = {}): CollectionItem {
	return {
		name: "hello-world.md",
		path: "content/posts/hello-world.md",
		sha: "abc123",
		data: { date: "2026-01-01", slug: "hello-world", title: "Hello world" },
		...overrides,
	}
}

function list(items: CollectionItem[] | null) {
	return render(
		<MemoryRouter>
			<CollectionTable
				collection={POSTS}
				editorBase={EDITOR_BASE}
				items={items}
			/>
		</MemoryRouter>,
	)
}

const skeletonRows = (container: HTMLElement) =>
	container.querySelectorAll('[data-slot="table-body"] [data-slot="skeleton"]')

describe("a Collection whose listing has not arrived", () => {
	it("paints the heading and the table frame before the rows", () => {
		const { container } = list(null)

		expect(screen.getByText("Posts")).toBeInTheDocument()
		expect(container.querySelector('[data-slot="table"]')).toBeInTheDocument()
		expect(skeletonRows(container).length).toBeGreaterThan(0)
	})

	// Not "No items yet." — the Collection may well have items, and saying it has
	// none is a wrong answer rather than a placeholder.
	it("does not reach the empty state", () => {
		list(null)

		expect(screen.queryByText("No items yet.")).not.toBeInTheDocument()
	})

	it("disables every control that would answer to nothing", () => {
		list(null)

		expect(screen.getByPlaceholderText("Search by title…")).toBeDisabled()
		expect(screen.getByRole("button", { name: /Title/ })).toBeDisabled()
		expect(screen.getByRole("button", { name: /Status/ })).toBeDisabled()
	})

	it("leaves the one control that needs no listing alone", () => {
		list(null)

		expect(screen.getByRole("link", { name: "New Post" })).toHaveAttribute(
			"href",
			`${EDITOR_BASE}/new`,
		)
	})
})

describe("a Collection whose listing has arrived", () => {
	it("reaches the empty state rather than an endless skeleton", () => {
		const { container } = list([])

		expect(screen.getByText("No items yet.")).toBeInTheDocument()
		expect(skeletonRows(container)).toHaveLength(0)
	})

	it("hands the controls back", () => {
		list([])

		expect(screen.getByPlaceholderText("Search by title…")).toBeEnabled()
		expect(screen.getByRole("button", { name: /Title/ })).toBeEnabled()
	})

	it("links each item to its editor, newest first", () => {
		const { container } = list([
			item({
				data: { date: "2026-01-01", slug: "older", title: "Older" },
				name: "older.md",
				path: "content/posts/older.md",
			}),
			item({
				data: { date: "2026-06-01", slug: "newer", title: "Newer" },
				name: "newer.md",
				path: "content/posts/newer.md",
			}),
		])

		expect(screen.getByRole("link", { name: "Newer" })).toHaveAttribute(
			"href",
			`${EDITOR_BASE}/item/newer`,
		)
		const rows = container.querySelectorAll(
			'[data-slot="table-body"] [data-slot="table-row"]',
		)
		expect(rows).toHaveLength(2)
		expect(
			within(rows[0] as HTMLElement).getByText("Newer"),
		).toBeInTheDocument()
	})
})

// The `createdAt` column renders nothing but still occupies a cell. A skeleton
// row one cell short of the header would size the columns differently until the
// real rows landed, so the two are pinned to each other here rather than in a
// comment.
it("stands in for exactly the columns the table declares", () => {
	const { container } = list(null)

	const header = container.querySelector(
		'[data-slot="table-header"] [data-slot="table-row"]',
	)
	const row = container.querySelector(
		'[data-slot="table-body"] [data-slot="table-row"]',
	)

	expect(row?.querySelectorAll('[data-slot="table-cell"]')).toHaveLength(
		header?.querySelectorAll('[data-slot="table-head"]').length ?? 0,
	)
})
