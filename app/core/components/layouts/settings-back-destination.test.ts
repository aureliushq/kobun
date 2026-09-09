import { describe, expect, it } from "vitest"

import { chooseBackDestination } from "./settings-back-destination"

/**
 * Where the account settings page sends a writer who wants out (#134).
 *
 * `/settings` is the one authenticated page with no Project in its URL, so the
 * way back cannot be read off params. These are the three answers, in order.
 */

const acme = { repoName: "site", repoOwnerLogin: "acme" }
const other = { repoName: "notes", repoOwnerLogin: "acme" }

describe("chooseBackDestination", () => {
	it("follows a `from` naming one of the writer's own Projects", () => {
		expect(
			chooseBackDestination({ from: "/acme/notes", projects: [acme, other] }),
		).toEqual({ label: "acme/notes", to: "/acme/notes" })
	})

	it("falls back to the first Project when there is no `from`", () => {
		expect(
			chooseBackDestination({ from: null, projects: [acme, other] }),
		).toEqual({ label: "acme/site", to: "/acme/site" })
	})

	// A `from` is a URL the writer controls, so it is a destination only where it
	// names a Project they already have. Anything else is someone else's page, or
	// nobody's.
	it("ignores a `from` naming a Project the writer does not have", () => {
		expect(
			chooseBackDestination({ from: "/evil/repo", projects: [acme] }),
		).toEqual({ label: "acme/site", to: "/acme/site" })
	})

	it("ignores a `from` that is not a Project path at all", () => {
		expect(
			chooseBackDestination({
				from: "https://evil.example/acme/site",
				projects: [acme],
			}),
		).toEqual({ label: "acme/site", to: "/acme/site" })
	})

	it("sends a writer with no Projects to setup", () => {
		expect(chooseBackDestination({ from: null, projects: [] })).toEqual({
			label: "Set up a Project",
			to: "/setup",
		})
	})
})
