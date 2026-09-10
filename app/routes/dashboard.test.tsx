import { render, screen } from "@testing-library/react"
import { createRoutesStub } from "react-router"
import { describe, expect, it } from "vitest"
import type { NormalizedConfig } from "@/config/types"
import {
	DASHBOARD_DRAFT_LIMIT,
	type DashboardDraft,
} from "@/core/editor/drafts"
import { TEST_CONFIG } from "@/core/project-context/test-harness"
import type { Project } from "@/db/types"
import Dashboard from "./dashboard"

/**
 * The dashboard's Drafts section (#142).
 *
 * What a writer is shown and what they can reach. The query's own rules — the
 * limit, the tally, the cleanup delete — are pinned in
 * `app/core/editor/drafts/dashboard-drafts.test.ts`.
 */

const PROJECT = {
	configError: null,
	id: "project-1",
	repoName: "blog",
	repoOwnerLogin: "acme",
} as Project

function draft(index: number): DashboardDraft {
	return {
		collectionLabel: "Posts",
		collectionSlug: "posts",
		committedRevision: null,
		heading: `Draft ${index}`,
		id: `draft-${index}`,
		itemSlug: null,
		project: { repoName: "blog", repoOwnerLogin: "acme" },
		revision: 1,
		sourcePath: null,
		updatedAt: new Date("2026-09-01T12:00:00Z"),
	}
}

function page({
	config = TEST_CONFIG as NormalizedConfig | null,
	entry = "/acme/blog",
	total = 0,
}: {
	config?: NormalizedConfig | null
	entry?: string
	total?: number
} = {}) {
	const Stub = createRoutesStub([
		{
			children: [
				{
					// The loader hands `Await` a plain object rather than a promise, so
					// the section renders synchronously and there is no pending phase to
					// wait out (ADR-0006).
					Component: Dashboard,
					loader: ({ request }: { request: Request }) => {
						const all =
							new URL(request.url).searchParams.get("drafts") === "all"
						const shown = all ? total : Math.min(total, DASHBOARD_DRAFT_LIMIT)
						return {
							drafts: {
								drafts: Array.from({ length: shown }, (_, index) =>
									draft(index),
								),
								showingAll: all,
								total,
							},
						}
					},
					path: ":owner/:name",
				},
			],
			id: "core/components/layouts/dashboard",
			loader: () => ({
				activeProject: PROJECT,
				config,
				configProblem: null,
				user: { email: "ada@example.com", image: null, name: "Ada Lovelace" },
			}),
			path: "/",
		},
	])

	return render(<Stub initialEntries={[entry]} />)
}

/** Every Draft card on the page, by the heading each is led with. */
function headings() {
	return screen
		.queryAllByRole("link", { name: /^Draft \d+$/ })
		.map((link) => link.textContent)
}

describe("a writer with no Drafts", () => {
	it("is told so rather than shown nothing", async () => {
		page()

		expect(await screen.findByText("No drafts")).toBeInTheDocument()
	})

	it("is pointed at a Collection to start one in", async () => {
		page()

		expect(
			await screen.findByRole("link", { name: "Open Posts" }),
		).toHaveAttribute("href", "/acme/blog/collections/posts")
	})

	it("is still told so when there is no Config to point into", async () => {
		page({ config: null })

		expect(await screen.findByText("No drafts")).toBeInTheDocument()
		expect(
			screen.queryByRole("link", { name: /^Open / }),
		).not.toBeInTheDocument()
	})
})

describe("a writer with more Drafts than the dashboard shows", () => {
	it("sees the bounded list and how much of it is missing", async () => {
		page({ total: 8 })

		expect(await screen.findByText("Draft 0")).toBeInTheDocument()
		expect(headings()).toHaveLength(DASHBOARD_DRAFT_LIMIT)
		expect(screen.getByText(/3 more drafts/)).toBeInTheDocument()
	})

	it("counts one hidden Draft as one", async () => {
		page({ total: DASHBOARD_DRAFT_LIMIT + 1 })

		expect(await screen.findByText(/1 more draft ·/)).toBeInTheDocument()
	})

	it("offers the rest without leaving the page", async () => {
		page({ total: 8 })

		expect(
			await screen.findByRole("link", { name: "Show all 8" }),
		).toHaveAttribute("href", "/acme/blog?drafts=all")
	})
})

describe("a writer with fewer Drafts than the dashboard shows", () => {
	it("is offered no rest to see", async () => {
		page({ total: 2 })

		expect(await screen.findByText("Draft 0")).toBeInTheDocument()
		expect(headings()).toHaveLength(2)
		expect(screen.queryByText(/more drafts/)).not.toBeInTheDocument()
	})
})

describe("a writer who asked for all of them", () => {
	it("gets every Draft, and a way back to the short list", async () => {
		page({ entry: "/acme/blog?drafts=all", total: 8 })

		expect(await screen.findByText("Draft 7")).toBeInTheDocument()
		expect(headings()).toHaveLength(8)
		expect(screen.getByRole("link", { name: "Show fewer" })).toHaveAttribute(
			"href",
			"/acme/blog",
		)
	})

	it("is told nothing when the cap never bit", async () => {
		// Asking for all of three is the bounded list, so there is no way back to
		// offer and nothing being hidden to report.
		page({ entry: "/acme/blog?drafts=all", total: 3 })

		expect(await screen.findByText("Draft 0")).toBeInTheDocument()
		expect(screen.queryByRole("link", { name: "Show fewer" })).toBeNull()
		expect(screen.queryByText(/more draft/)).toBeNull()
	})
})
