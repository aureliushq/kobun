import { render, screen } from "@testing-library/react"
import { createRoutesStub } from "react-router"
import { describe, expect, it } from "vitest"
import type { CollectionItem } from "@/core/editor/collection-table"
import {
	catchResponse,
	TEST_SUBCOLLECTION_CONFIG,
} from "@/core/project-context/test-harness"
import Subcollection, { requireParentItem } from "./subcollection"

/**
 * A Parent Item's Subcollection page (#181): a tab per Subcollection the
 * Collection declares, and a table of that Parent Item's items of the open one.
 */

const PROJECTS = TEST_SUBCOLLECTION_CONFIG.collections.projects
const UPDATES = PROJECTS.subcollections?.updates

function item(name: string, title: string): CollectionItem {
	return {
		data: { title },
		name,
		path: `content/projects/acme/updates/${name}`,
		sha: `sha-${name}`,
	}
}

function page(items: CollectionItem[]) {
	const Stub = createRoutesStub([
		{
			// A plain array rather than a promise, so `Await` renders at once and
			// there is no pending phase to wait out (ADR-0006).
			Component: Subcollection,
			loader: () => ({
				drafts: [],
				items,
				parentTitle: "Acme",
				project: { repoName: "blog", repoOwnerLogin: "acme" },
				subcollection: UPDATES,
				tableSlug: "projects/items/acme/updates",
				tabs: [
					{
						href: "/acme/blog/collections/projects/items/acme/notes",
						label: "Notes",
					},
					{
						href: "/acme/blog/collections/projects/items/acme/updates",
						label: "Updates",
					},
				],
			}),
			path: "/:owner/:name/collections/:collection_slug/items/:parent_item/:subcollection_key",
		},
	])
	return render(
		<Stub
			initialEntries={["/acme/blog/collections/projects/items/acme/updates"]}
		/>,
	)
}

describe("a Parent Item's Subcollection page", () => {
	it("is headed by the Parent Item", async () => {
		page([])

		expect(
			await screen.findByRole("heading", { name: "Acme" }),
		).toBeInTheDocument()
	})

	it("offers a tab per Subcollection, marking the open one", async () => {
		page([])

		const notes = await screen.findByRole("link", { name: "Notes" })
		const updates = screen.getByRole("link", { name: "Updates" })
		expect(notes).toHaveAttribute(
			"href",
			"/acme/blog/collections/projects/items/acme/notes",
		)
		expect(notes).not.toHaveAttribute("aria-current")
		expect(updates).toHaveAttribute("aria-current", "page")
	})

	it("lists the Parent Item's items of the open Subcollection", async () => {
		page([item("launch.md", "Launch"), item("beta.md", "Beta")])

		expect(await screen.findByRole("link", { name: "Launch" })).toBeVisible()
		expect(screen.getByRole("link", { name: "Beta" })).toBeVisible()
	})

	it("shows an empty Subcollection as empty, not as an error", async () => {
		page([])

		expect(await screen.findByText("No items yet.")).toBeInTheDocument()
		expect(
			screen.queryByText("Couldn't load this collection"),
		).not.toBeInTheDocument()
	})
})

describe("the Parent Item a URL names", () => {
	const PARENTS = [
		{ data: {}, name: "acme.md", path: "content/projects/acme.md", sha: "1" },
		{
			data: {},
			name: "globex.mdx",
			path: "content/projects/globex.mdx",
			sha: "2",
		},
	]

	it("is found by its filename stem, md or mdx", () => {
		expect(requireParentItem(PARENTS, "acme")).toBe(PARENTS[0])
		expect(requireParentItem(PARENTS, "globex")).toBe(PARENTS[1])
	})

	// The listing holds Sources only, so a Parent Item that exists only as a
	// Draft — or no longer exists — is not in it.
	it("is a 404 when it has no Source", () => {
		expect(
			catchResponse(() => requireParentItem(PARENTS, "initech")).status,
		).toBe(404)
	})
})
