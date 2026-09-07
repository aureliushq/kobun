import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import type { Collection, ResolvedField } from "@/config/types"
import type { CollectionDraft } from "@/core/editor/drafts"

import {
	type CollectionItem,
	type CollectionListing,
	CollectionTable,
} from "./collection-table"

/**
 * What a Collection's list shows while its listing is still streaming, once it
 * lands, and when it never does (#103) — and where the writer's own Drafts sit
 * among the committed items (#105).
 *
 * `listing` is the whole of the split: `"pending"` is the half the page paints
 * before GitHub answers, an array is the half that replaces it, `"unavailable"`
 * is what a GitHub failure leaves. The assertions are about what a writer can
 * see and reach in each — never about the table instance underneath, which is
 * TanStack's to test.
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

function draft(overrides: Partial<CollectionDraft> = {}): CollectionDraft {
	return {
		createdAt: new Date("2026-03-01").getTime(),
		data: {},
		heading: "A new thought…",
		href: `${EDITOR_BASE}/new?draft=draft-1`,
		id: "draft-1",
		committedRevision: null,
		revision: 1,
		sourcePath: null,
		...overrides,
	}
}

function list(listing: CollectionListing, drafts: CollectionDraft[] = []) {
	return render(
		<MemoryRouter>
			<CollectionTable
				collection={POSTS}
				drafts={drafts}
				editorBase={EDITOR_BASE}
				listing={listing}
			/>
		</MemoryRouter>,
	)
}

const skeletonRows = (container: HTMLElement) =>
	container.querySelectorAll('[data-slot="table-body"] [data-slot="skeleton"]')

const bodyRows = (container: HTMLElement) =>
	container.querySelectorAll(
		'[data-slot="table-body"] [data-slot="table-row"]:not(:has([data-slot="skeleton"]))',
	)

describe("a Collection whose listing has not arrived", () => {
	it("paints the heading and the table frame before the rows", () => {
		const { container } = list("pending")

		expect(screen.getByText("Posts")).toBeInTheDocument()
		expect(container.querySelector('[data-slot="table"]')).toBeInTheDocument()
		expect(skeletonRows(container).length).toBeGreaterThan(0)
	})

	// Not "No items yet." — the Collection may well have items, and saying it has
	// none is a wrong answer rather than a placeholder.
	it("does not reach the empty state", () => {
		list("pending")

		expect(screen.queryByText("No items yet.")).not.toBeInTheDocument()
	})

	it("disables every control that would answer to nothing", () => {
		list("pending")

		expect(screen.getByPlaceholderText("Search by title…")).toBeDisabled()
		expect(screen.getByRole("button", { name: /Title/ })).toBeDisabled()
		expect(screen.getByRole("button", { name: /Status/ })).toBeDisabled()
	})

	it("leaves the one control that needs no listing alone", () => {
		list("pending")

		expect(screen.getByRole("link", { name: "New Post" })).toHaveAttribute(
			"href",
			`${EDITOR_BASE}/new`,
		)
	})

	// The Drafts are awaited, so they are real on the first paint. They are the
	// reason a writer opened this page, and holding them back until GitHub
	// answers would be showing a skeleton over content already in hand.
	it("shows the writer's own Drafts while the items are still coming", () => {
		list("pending", [draft()])

		expect(
			screen.getByRole("link", { name: "A new thought…" }),
		).toBeInTheDocument()
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
		const rows = bodyRows(container)
		expect(rows).toHaveLength(2)
		expect(
			within(rows[0] as HTMLElement).getByText("Newer"),
		).toBeInTheDocument()
	})
})

describe("a Collection whose listing never arrives", () => {
	it("says so, and keeps the frame around it", () => {
		list("unavailable")

		expect(
			screen.getByText("Couldn't load this collection"),
		).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "New Post" })).toBeInTheDocument()
	})

	// The Drafts come from the database, which answered. Losing them to GitHub's
	// silence would take away the half of the page that was still true.
	it("still lists the Drafts, which needed nothing from GitHub", () => {
		list("unavailable", [draft()])

		expect(
			screen.getByRole("link", { name: "A new thought…" }),
		).toBeInTheDocument()
	})

	it("does not claim the Collection is empty", () => {
		list("unavailable")

		expect(screen.queryByText("No items yet.")).not.toBeInTheDocument()
	})
})

describe("a Draft with no Source behind it", () => {
	it("gets a row of its own, opening the editor that carries its id", () => {
		list([], [draft()])

		expect(
			screen.getByRole("link", { name: "A new thought…" }),
		).toHaveAttribute("href", `${EDITOR_BASE}/new?draft=draft-1`)
	})

	it("says it has never been published", () => {
		list([], [draft()])

		expect(screen.getByText("Unpublished")).toBeInTheDocument()
	})

	// A Draft's own Data is what it would be committed as, so the date column
	// reads it the same way it reads a committed item's — which is what lets a
	// Draft take its place in the sort rather than sit at the end of it.
	it("sorts on the date in its own Data, falling back to its own moment", () => {
		const { container } = list(
			[],
			[
				// Its Data dates it to 2020, behind the item; without that read it
				// would sort on its own 2026 moment and come first.
				draft({ data: { date: "2020-01-01" }, heading: "Dated", id: "d1" }),
				draft({ heading: "Undated", id: "d2" }),
			],
		)

		const rows = bodyRows(container)
		expect(
			within(rows[0] as HTMLElement).getByText("Undated"),
		).toBeInTheDocument()
		expect(
			within(rows[1] as HTMLElement).getByText("Dated"),
		).toBeInTheDocument()
	})
})

describe("a Draft over a Collection Item", () => {
	const OVER_HELLO = draft({
		heading: "Hello world, revised",
		href: `${EDITOR_BASE}/item/hello-world`,
		committedRevision: 1,
		revision: 2,
		sourcePath: "content/posts/hello-world.md",
	})

	it("is one row with that item rather than two", () => {
		const { container } = list([item()], [OVER_HELLO])

		expect(bodyRows(container)).toHaveLength(1)
	})

	it("says it holds changes the repository does not have", () => {
		list([item()], [OVER_HELLO])

		expect(screen.getByText("Unpublished changes")).toBeInTheDocument()
	})

	// The Draft holds the newer title, and a row should be named after what it
	// opens rather than after the version the writer has already moved past.
	it("is headed by the Draft's title and opens that item's editor", () => {
		list([item()], [OVER_HELLO])

		expect(
			screen.getByRole("link", { name: "Hello world, revised" }),
		).toHaveAttribute("href", `${EDITOR_BASE}/item/hello-world`)
		expect(screen.queryByText("Hello world")).not.toBeInTheDocument()
	})

	// Nothing has arrived to absorb it yet, so it stands alone until its item
	// turns up — which is what puts the writer's work in front of them first.
	it("stands alone until the listing arrives to absorb it", () => {
		const { container } = list("pending", [OVER_HELLO])

		expect(bodyRows(container)).toHaveLength(1)
		expect(
			screen.getByRole("link", { name: "Hello world, revised" }),
		).toBeInTheDocument()
	})

	// A Source the arrived listing does not hold has gone from the repository,
	// so its editor has nothing to open. A row leading to a 404 is worse than no
	// row; the dashboard still lists the Draft, which is where it is discarded.
	it("gets no row once the listing comes back without its Source", () => {
		list([], [OVER_HELLO])

		expect(
			screen.queryByRole("link", { name: "Hello world, revised" }),
		).not.toBeInTheDocument()
		expect(screen.getByText("No items yet.")).toBeInTheDocument()
	})

	// Its date is read off the Draft, which holds the newer copy of the very
	// field the column reads — the same reason its title wins.
	it("takes its date from the Draft when the Draft names one", () => {
		list(
			[item({ data: { date: "2026-01-01", title: "Hello world" } })],
			[{ ...OVER_HELLO, data: { date: "2020-05-05" } }],
		)

		expect(screen.getByText(/2020|years ago/)).toBeInTheDocument()
	})
})

describe("the page's controls", () => {
	const DRAFTS = [draft({ heading: "Unpublished thing" })]

	it("searches Drafts by their heading alongside the items", () => {
		const { container } = list([item()], DRAFTS)

		const search = screen.getByPlaceholderText("Search by title…")
		fireEvent.change(search, { target: { value: "unpublished" } })

		const rows = bodyRows(container)
		expect(rows).toHaveLength(1)
		expect(
			within(rows[0] as HTMLElement).getByText("Unpublished thing"),
		).toBeInTheDocument()
	})

	it("filters down to the Drafts by the state they are in", async () => {
		const user = userEvent.setup()
		const { container } = list([item()], DRAFTS)

		await user.click(screen.getByRole("combobox", { name: "Filter by status" }))
		await user.click(await screen.findByRole("option", { name: "Unpublished" }))

		const rows = bodyRows(container)
		expect(rows).toHaveLength(1)
		expect(
			within(rows[0] as HTMLElement).getByText("Unpublished thing"),
		).toBeInTheDocument()
	})
})

// The `createdAt` column renders nothing but still occupies a cell. A skeleton
// row one cell short of the header would size the columns differently until the
// real rows landed, so the two are pinned to each other here rather than in a
// comment.
it("stands in for exactly the columns the table declares", () => {
	const { container } = list("pending")

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
