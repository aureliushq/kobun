import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRoutesStub } from "react-router"
import { describe, expect, it, vi } from "vitest"
import type { SettingsSession } from "@/core/settings/sessions"
import { DEFAULT_USER_PREFERENCES } from "@/db/types"
import Settings from "./settings"

/**
 * The account settings page (#135).
 *
 * What a writer can see and reach, not what the row ends up holding — the
 * writes are covered where they happen, in `packages/db/user-preference.test.ts`
 * and `app/core/settings/delete-account.test.ts`.
 */

const USER = {
	email: "ada@example.com",
	image: null,
	name: "Ada Lovelace",
}

const HERE: SettingsSession = {
	createdAt: new Date("2026-08-01T00:00:00Z"),
	current: true,
	expiresAt: new Date("2026-10-01T00:00:00Z"),
	id: "session-here",
	ipAddress: "203.0.113.7",
	label: "Chrome on macOS",
}

const ELSEWHERE: SettingsSession = {
	createdAt: new Date("2026-07-01T00:00:00Z"),
	current: false,
	expiresAt: new Date("2026-09-01T00:00:00Z"),
	id: "session-elsewhere",
	ipAddress: "198.51.100.4",
	label: "Safari on iOS",
}

function page({
	preferences = DEFAULT_USER_PREFERENCES,
	sessions = [HERE, ELSEWHERE],
}: {
	preferences?: typeof DEFAULT_USER_PREFERENCES
	sessions?: SettingsSession[]
} = {}) {
	const action = vi.fn(async ({ request }: { request: Request }) => {
		const formData = await request.formData()
		return { submitted: Object.fromEntries(formData) }
	})

	const Stub = createRoutesStub([
		{
			action,
			Component: Settings,
			loader: () => ({ preferences, sessions, user: USER }),
			path: "/settings",
		},
	])

	return { action, ...render(<Stub initialEntries={["/settings"]} />) }
}

/** What the action was handed, once it has been handed anything. */
async function submission(action: ReturnType<typeof page>["action"]) {
	await waitFor(() => expect(action).toHaveBeenCalled())
	const [call] = action.mock.results
	return (await call.value).submitted
}

describe("the profile section", () => {
	it("shows the writer who Kobun thinks they are, without offering to change it", async () => {
		page()

		expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument()
		expect(screen.getByText("ada@example.com")).toBeInTheDocument()
		// Read-only means no field to type in, not a field that refuses to save.
		expect(screen.queryByDisplayValue("Ada Lovelace")).not.toBeInTheDocument()
		expect(
			screen.queryByDisplayValue("ada@example.com"),
		).not.toBeInTheDocument()
	})

	it("says where the values come from", async () => {
		page()

		const github = await screen.findByRole("link", {
			name: /your GitHub profile/,
		})
		expect(github).toHaveAttribute(
			"href",
			"https://github.com/settings/profile",
		)
	})
})

describe("the preferences section", () => {
	it("saves a Preference the moment the writer changes it", async () => {
		const { action } = page()

		await userEvent.click(
			await screen.findByRole("switch", { name: "Show the word count" }),
		)

		expect(await submission(action)).toEqual({
			intent: "update-preference",
			key: "wordCountVisible",
			value: "false",
		})
	})

	it("lets the writer type a timezone over the one already chosen", async () => {
		// The combobox opens holding the current zone as its filter text, so
		// clicking and typing used to append to it and match nothing.
		const { action } = page({
			preferences: { ...DEFAULT_USER_PREFERENCES, timezone: "Europe/London" },
		})

		const timezone = await screen.findByRole("combobox", { name: "Timezone" })
		await userEvent.click(timezone)
		await userEvent.keyboard("Asia/Tokyo")

		await userEvent.click(
			await screen.findByRole("option", { name: "Asia/Tokyo" }),
		)

		expect(await submission(action)).toEqual({
			intent: "update-preference",
			key: "timezone",
			value: "Asia/Tokyo",
		})
	})

	it("shows the writer their stored choice rather than the default", async () => {
		page({
			preferences: { ...DEFAULT_USER_PREFERENCES, sidebarOpen: false },
		})

		expect(
			await screen.findByRole("switch", { name: "Open the sidebar" }),
		).not.toBeChecked()
	})
})

describe("the sessions section", () => {
	it("marks the session the writer is reading on and offers it no way out", async () => {
		page()

		expect(await screen.findByText("This device")).toBeInTheDocument()
		expect(screen.getAllByRole("button", { name: "Revoke" })).toHaveLength(1)
	})

	it("revokes another session by id, never by token", async () => {
		const { action } = page()

		await userEvent.click(await screen.findByRole("button", { name: "Revoke" }))

		expect(await submission(action)).toEqual({
			intent: "revoke-session",
			sessionId: "session-elsewhere",
		})
	})
})

describe("deleting an account", () => {
	async function openDialog() {
		await userEvent.click(
			await screen.findByRole("button", { name: "Delete my account" }),
		)
		return screen.findByRole("textbox")
	}

	it("names what it destroys and what it leaves alone", async () => {
		page()
		await openDialog()

		const dialog = within(screen.getByRole("alertdialog"))
		expect(
			dialog.getByText(/every Draft Kobun is holding for you/),
		).toBeInTheDocument()
		expect(
			dialog.getByText(/every Project you have.*connected/s),
		).toBeInTheDocument()
		// The two surprises point opposite ways, so both are asserted: the Drafts
		// that go, and the repository and App that stay.
		expect(
			dialog.getByText(
				/Files already committed to your GitHub repositories are not/,
			),
		).toBeInTheDocument()
		expect(dialog.getByText(/GitHub App stays installed/)).toBeInTheDocument()
	})

	it("will not delete until the writer types their own email", async () => {
		page()
		const confirmation = await openDialog()

		const confirm = screen
			.getAllByRole("button", { name: "Delete my account" })
			.at(-1)
		expect(confirm).toBeDisabled()

		await userEvent.type(confirmation, "ada@example.co")
		expect(confirm).toBeDisabled()

		await userEvent.type(confirmation, "m")
		expect(confirm).toBeEnabled()
	})

	it("sends the typed confirmation for the server to check again", async () => {
		const { action } = page()
		const confirmation = await openDialog()

		await userEvent.type(confirmation, "ada@example.com")
		const confirm = screen
			.getAllByRole("button", { name: "Delete my account" })
			.at(-1)
		if (!confirm) throw new Error("no confirm button")
		await userEvent.click(confirm)

		expect(await submission(action)).toEqual({
			confirmation: "ada@example.com",
			intent: "delete-account",
		})
	})
})
