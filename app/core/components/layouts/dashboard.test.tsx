import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRoutesStub, Outlet, useLoaderData } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { PreferencesContext } from "@/core/preferences/context"
import {
	DEFAULT_USER_PREFERENCES,
	type ProjectWithGithubInstallation,
	type UserPreferenceValues,
} from "@/db/types"
import { ThemeContext } from "@/ui/hooks/use-theme"
import DashboardLayout, { shouldRevalidate } from "./dashboard"

/**
 * The chrome's one Preference: whether the sidebar is expanded (#140).
 *
 * The sidebar and the account page's switch are the same control, so a writer
 * who collapses it here finds it collapsed on the next page load. Nothing
 * renders a trigger — `Cmd+B` is the whole of it — which is what these tests
 * press.
 *
 * The stub stands in for the two loaders this depends on: a parent holding the
 * Preferences, the way `root.tsx` does, and this layout's own. Both are needed
 * to say anything true about what happens *after* the write lands.
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

function layout(preferences: UserPreferenceValues = DEFAULT_USER_PREFERENCES) {
	// The row, as the root loader would re-read it after a write.
	let stored = preferences
	const chromeLoader = vi.fn(() => ({
		activeProject: PROJECT,
		config: null,
		configProblem: null,
		projects: [PROJECT],
		releaseInfo: Promise.resolve({
			changelogUrl: "https://kobun.dev/changelog",
			hasUpdate: false,
			latestVersion: "0.1.0",
			releaseUrl: "https://kobun.dev/releases",
		}),
		user: { email: "ada@example.com", image: null, name: "Ada Lovelace" },
		versionInfo: {
			currentVersion: "0.1.0",
			homeUrl: "https://kobun.dev",
			isHosted: true,
		},
	}))

	const Stub = createRoutesStub([
		{
			children: [
				{
					Component: DashboardLayout,
					loader: chromeLoader,
					path: ":owner/:name",
					shouldRevalidate,
				},
			],
			Component: function Root() {
				const { preferences: fromLoader } = useLoaderData<{
					preferences: UserPreferenceValues
				}>()
				return (
					<PreferencesContext.Provider value={fromLoader}>
						<Outlet />
					</PreferencesContext.Provider>
				)
			},
			loader: () => ({ preferences: stored }),
			path: "/",
		},
		{
			action: async ({ request }: { request: Request }) => {
				const formData = await request.formData()
				stored = {
					...stored,
					sidebarOpen: formData.get("value") === "true",
				}
				return { submitted: Object.fromEntries(formData) }
			},
			path: "/api/set-preference",
		},
	])

	const view = render(
		<ThemeContext.Provider value={{ theme: "system" }}>
			<Stub initialEntries={["/acme/blog"]} />
		</ThemeContext.Provider>,
	)

	/** The state the sidebar is drawn in, whenever it is asked. */
	const state = () =>
		view.container
			.querySelector('[data-slot="sidebar"]')
			?.getAttribute("data-state")

	return { chromeLoader, state, stored: () => stored, ...view }
}

/** The only way to collapse the sidebar today. */
async function pressToggle() {
	await userEvent.keyboard("{Meta>}b{/Meta}")
}

async function chromeIsDrawn() {
	await screen.findByRole("button", { name: /Ada Lovelace/ })
}

describe("the sidebar's remembered state", () => {
	it("opens collapsed when that is how the writer left it", async () => {
		const { state } = layout({
			...DEFAULT_USER_PREFERENCES,
			sidebarOpen: false,
		})

		// Collapsed in the first render rather than after one — the Preference is
		// read in the root loader, so it is in the server-rendered HTML.
		await chromeIsDrawn()
		expect(state()).toBe("collapsed")
	})

	it("opens expanded when that is how the writer left it", async () => {
		const { state } = layout({ ...DEFAULT_USER_PREFERENCES, sidebarOpen: true })

		await chromeIsDrawn()
		expect(state()).toBe("expanded")
	})

	it("saves the collapse rather than forgetting it at the end of the visit", async () => {
		const { state, stored } = layout()

		await chromeIsDrawn()
		await pressToggle()

		await waitFor(() => expect(stored().sidebarOpen).toBe(false))
		// Still collapsed once the write has landed and the Preferences have been
		// re-read: the sidebar does not spring back the moment it is remembered.
		expect(state()).toBe("collapsed")
	})

	it("does not re-resolve the Project because the sidebar moved", async () => {
		const { chromeLoader, stored } = layout()

		await chromeIsDrawn()
		expect(chromeLoader).toHaveBeenCalledTimes(1)

		await pressToggle()

		await waitFor(() => expect(stored().sidebarOpen).toBe(false))
		expect(chromeLoader).toHaveBeenCalledTimes(1)
	})
})
