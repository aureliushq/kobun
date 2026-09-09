import { render, screen } from "@testing-library/react"
import { createRoutesStub } from "react-router"
import { describe, expect, it } from "vitest"

import SettingsLayout from "./settings"
import type { BackDestination } from "./settings-back-destination"

/**
 * The chrome around the account settings page (#134).
 *
 * The page below it is #135's; all this layout owes a writer is a way back to
 * a Project, since `/settings` has no Project in its URL to read one off.
 */

const PROJECT: BackDestination = { label: "acme/site", to: "/acme/site" }

function layout(back: BackDestination = PROJECT) {
	const Stub = createRoutesStub([
		{
			Component: SettingsLayout,
			loader: () => ({ back }),
			path: "/settings",
			children: [
				{ Component: () => <div data-testid="settings-body" />, index: true },
			],
		},
	])

	return render(<Stub initialEntries={["/settings"]} />)
}

describe("the settings layout", () => {
	it("renders the page below it", async () => {
		layout()

		expect(await screen.findByTestId("settings-body")).toBeInTheDocument()
	})

	it("names the Project the back link returns to", async () => {
		layout()

		const back = await screen.findByRole("link", { name: /acme\/site/ })
		expect(back).toHaveAttribute("href", "/acme/site")
	})

	it("offers setup to a writer with no Project to go back to", async () => {
		layout({ label: "Set up a Project", to: "/setup" })

		const back = await screen.findByRole("link", { name: /Set up a Project/ })
		expect(back).toHaveAttribute("href", "/setup")
	})
})
