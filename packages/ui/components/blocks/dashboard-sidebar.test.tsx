import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRoutesStub } from "react-router"
import { beforeEach, describe, expect, it } from "vitest"
import type { NormalizedConfig } from "@/config/types"
import type { ProjectWithGithubInstallation } from "@/db/types"
import { SidebarProvider } from "@/ui/components/base/sidebar"
import { ThemeContext } from "@/ui/hooks/use-theme"
import DashboardSidebar from "./dashboard-sidebar"

/**
 * The sidebar footer, which is the signed-in writer rather than a lone Logout
 * button (#138).
 *
 * The avatar in the header above it is the GitHub organisation the Project
 * belongs to; this is the one place in the chrome that names the person.
 */

const PROJECT = {
	githubInstallation: {
		targetAvatarUrl: "https://avatars.example/acme.png",
		targetLogin: "acme-org",
	},
	id: "project-1",
	repoName: "blog",
	repoOwnerLogin: "acme",
} as ProjectWithGithubInstallation

const OTHER_PROJECT = {
	githubInstallation: {
		targetAvatarUrl: "https://avatars.example/other.png",
		targetLogin: "other-org",
	},
	id: "project-2",
	repoName: "blog",
	repoOwnerLogin: "other",
} as ProjectWithGithubInstallation

const USER = {
	email: "ada@example.com",
	image: null,
	name: "Ada Lovelace",
}

let loggedOut: FormData | null = null

beforeEach(() => {
	loggedOut = null
})

function sidebar({
	config = null,
	parentItems,
}: {
	config?: NormalizedConfig | null
	parentItems?: Record<string, Promise<{ href: string; title: string }[]>>
} = {}) {
	const Stub = createRoutesStub([
		{
			Component: () => (
				<SidebarProvider>
					<DashboardSidebar
						activeProject={PROJECT}
						config={config}
						parentItems={parentItems}
						projects={[PROJECT, OTHER_PROJECT]}
						releaseInfo={Promise.resolve({
							changelogUrl: "https://kobun.dev/changelog",
							hasUpdate: false,
							latestVersion: "0.1.0",
							releaseUrl: "https://kobun.dev/releases",
						})}
						user={USER}
						versionInfo={{ currentVersion: "0.1.0", isHosted: true }}
					/>
				</SidebarProvider>
			),
			path: "/:owner/:name",
		},
		{
			// A static path outranks /:owner/:name, so arriving here is visible.
			Component: () => <p>the other project's dashboard</p>,
			path: "/other/blog",
		},
		{
			action: async ({ request }) => {
				loggedOut = await request.formData()
				return null
			},
			path: "/api/dashboard-actions",
		},
	])

	return render(
		<ThemeContext.Provider value={{ theme: "system" }}>
			<Stub initialEntries={["/acme/blog"]} />
		</ThemeContext.Provider>,
	)
}

async function openUserMenu() {
	await userEvent.click(
		await screen.findByRole("button", { name: /Ada Lovelace/ }),
	)
}

async function openProjectSwitcher() {
	await userEvent.click(
		await screen.findByRole("button", { name: /acme\/blog/ }),
	)
}

describe("the sidebar footer", () => {
	it("names the signed-in person rather than the GitHub organisation", async () => {
		sidebar()

		expect(
			await screen.findByRole("button", { name: /Ada Lovelace/ }),
		).toBeInTheDocument()
	})

	it("links to the Project's own settings", async () => {
		sidebar()

		const link = await screen.findByRole("link", { name: /Project Settings/ })
		expect(link).toHaveAttribute("href", "/acme/blog/settings")
	})

	it("opens account settings, saying which Project it came from", async () => {
		sidebar()
		await openUserMenu()

		const link = await screen.findByRole("menuitem", {
			name: /Account Settings/,
		})
		expect(link).toHaveAttribute("href", "/settings?from=%2Facme%2Fblog")
	})

	it("offers the theme the header used to own", async () => {
		sidebar()
		await openUserMenu()

		for (const name of ["Light", "Dark", "System"]) {
			expect(
				await screen.findByRole("menuitemradio", { name }),
			).toBeInTheDocument()
		}
	})

	it("signs the writer out", async () => {
		sidebar()
		await openUserMenu()

		await userEvent.click(
			await screen.findByRole("menuitem", { name: /Logout/ }),
		)

		await waitFor(() => expect(loggedOut?.get("intent")).toBe("logout"))
	})
})

/**
 * The project switcher, whose every row is its own anchor (#148).
 *
 * A menu item wrapping a link is activated by the pointer and not by the
 * keyboard, because the keyboard activates the item and the item carries no
 * navigation. These tests pin the shape that makes both inputs agree.
 *
 * The keyboard test presses Space, not Enter. Base UI synthesises a click for
 * Space on an anchor item, and leaves Enter to the browser's own anchor
 * activation - which happy-dom does not implement. Enter is covered here only
 * by the href being on the item at all; press it in a browser to see the rest.
 */
describe("the project switcher", () => {
	it("makes every item its own link", async () => {
		sidebar()
		await openProjectSwitcher()

		expect(
			await screen.findByRole("menuitem", { name: /acme\/blog/ }),
		).toHaveAttribute("href", "/acme/blog")
		expect(
			await screen.findByRole("menuitem", { name: /other\/blog/ }),
		).toHaveAttribute("href", "/other/blog")
		expect(
			await screen.findByRole("menuitem", { name: /Create New Project/ }),
		).toHaveAttribute("href", "/setup")
	})

	it("opens a Project from the keyboard", async () => {
		sidebar()
		await openProjectSwitcher()

		const project = await screen.findByRole("menuitem", {
			name: /other\/blog/,
		})
		project.focus()
		await userEvent.keyboard("[Space]")

		expect(
			await screen.findByText("the other project's dashboard"),
		).toBeInTheDocument()
	})

	it("ticks the Project being worked on, and only that one", async () => {
		sidebar()
		await openProjectSwitcher()

		const active = await screen.findByRole("menuitem", { name: /acme\/blog/ })
		const other = await screen.findByRole("menuitem", { name: /other\/blog/ })

		expect(
			active.querySelector('[data-slot="active-project"]'),
		).toBeInTheDocument()
		expect(
			other.querySelector('[data-slot="active-project"]'),
		).not.toBeInTheDocument()
	})
})

/**
 * A Collection's Parent Items, listed under it (#183). They stream in from the
 * cached Collection listing, so the rest of the sidebar never waits on them.
 */
describe("the Parent Items under a Collection", () => {
	// Only what the sidebar reads: a Collection with Subcollections, one
	// without, and a Singleton.
	const CONFIG = {
		collections: {
			posts: { label: "Posts" },
			projects: { label: "Projects", subcollections: { notes: {} } },
		},
		singletons: { about: { label: "About" } },
	} as unknown as NormalizedConfig
	const ACME = "/acme/blog/collections/projects/items/acme/notes"

	it("lists each by title, linking to its Subcollection page", async () => {
		sidebar({
			config: CONFIG,
			parentItems: {
				projects: Promise.resolve([
					{ href: ACME, title: "Acme" },
					{
						href: "/acme/blog/collections/projects/items/globex/notes",
						title: "Globex",
					},
				]),
			},
		})

		expect(await screen.findByRole("link", { name: "Acme" })).toHaveAttribute(
			"href",
			ACME,
		)
		expect(screen.getByRole("link", { name: "Globex" })).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
			"href",
			"/acme/blog/collections/projects",
		)
		// Only Projects declares Subcollections, so Posts has no list under it.
		expect(screen.getAllByRole("link", { name: /Acme|Globex/ })).toHaveLength(2)
		expect(
			screen.getByRole("link", { name: "Posts" }).closest("li"),
		).not.toContainElement(screen.getByRole("link", { name: "Acme" }))
	})

	it("leaves the rest of the sidebar when the listing fails", async () => {
		const failed = Promise.reject(new Error("GitHub is unreachable"))
		failed.catch(() => {})
		sidebar({
			config: CONFIG,
			parentItems: { projects: failed },
		})

		expect(
			await screen.findByRole("link", { name: "Projects" }),
		).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "Posts" })).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument()
		expect(
			screen.getByRole("button", { name: /Ada Lovelace/ }),
		).toBeInTheDocument()
	})
})
