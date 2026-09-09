import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRoutesStub } from "react-router"
import { beforeEach, describe, expect, it } from "vitest"
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

const USER = {
	email: "ada@example.com",
	image: null,
	name: "Ada Lovelace",
}

let loggedOut: FormData | null = null

beforeEach(() => {
	loggedOut = null
})

function sidebar() {
	const Stub = createRoutesStub([
		{
			Component: () => (
				<SidebarProvider>
					<DashboardSidebar
						activeProject={PROJECT}
						config={null}
						projects={[PROJECT]}
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
