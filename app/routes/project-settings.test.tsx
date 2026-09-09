import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRoutesStub } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { TEST_CONFIG } from "@/core/project-context/test-harness"
import {
	describeProjectConfig,
	type ProjectConfigView,
} from "@/core/settings/project-config"
import { ConfigStatus, type Project } from "@/db/types"
import ProjectSettings from "./project-settings"

/**
 * The Project settings page (#136).
 *
 * What a writer is shown and what they can reach — the view model's own rules
 * are pinned in `app/core/settings/project-config.test.ts`, and the refresh it
 * submits is `syncProjectConfig`'s, tested where that lives.
 */

const REPOSITORY = {
	htmlUrl: "https://github.com/acme/blog",
	name: "blog",
	owner: "acme",
}

const ROW = {
	configCheckedAt: new Date("2026-09-01T12:00:00Z"),
	configError: "",
	configPath: ".kobun.json",
	configStatus: ConfigStatus.PRESENT,
	repoHtmlUrl: REPOSITORY.htmlUrl,
} as Project

const WORKING = describeProjectConfig(ROW, TEST_CONFIG, null)

const BROKEN = describeProjectConfig(
	{
		...ROW,
		configError: JSON.stringify([
			{
				code: "parse_error",
				message: "Unexpected token }",
				path: ".kobun.json",
			},
		]),
		configStatus: ConfigStatus.ERROR,
	},
	null,
	"config-invalid",
)

/** Served, and carrying the parts of itself that did not validate (ADR-0007). */
const PARTIAL = describeProjectConfig(
	ROW,
	{
		...TEST_CONFIG,
		errors: [
			{
				code: "missing_required",
				message: "label is required",
				path: "collections.notes",
			},
		],
	},
	null,
)

function page(config: ProjectConfigView = WORKING) {
	const action = vi.fn(async ({ request }: { request: Request }) => {
		const formData = await request.formData()
		return { submitted: Object.fromEntries(formData) }
	})

	const Stub = createRoutesStub([
		{
			action,
			Component: ProjectSettings,
			loader: () => ({ config, repository: REPOSITORY }),
			path: "/:owner/:name/settings",
		},
	])

	return {
		action,
		...render(<Stub initialEntries={["/acme/blog/settings"]} />),
	}
}

describe("a Project whose Config reads", () => {
	it("lists what the Config declares", async () => {
		page()

		expect(await screen.findByText("Posts")).toBeInTheDocument()
		expect(screen.getByText("About")).toBeInTheDocument()
	})

	it("points at the file that declares it", async () => {
		page()

		const file = await screen.findByRole("link", { name: /\.kobun\.json/ })
		expect(file).toHaveAttribute(
			"href",
			"https://github.com/acme/blog/blob/HEAD/.kobun.json",
		)
	})

	it("offers no way to change anything the Config owns", async () => {
		page()
		await screen.findByText("Posts")

		// ADR-0010: this page shows the Config and never edits it, which means no
		// field to type in rather than a field that refuses to save.
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
		expect(screen.queryByRole("switch")).not.toBeInTheDocument()
		expect(screen.queryByDisplayValue("Posts")).not.toBeInTheDocument()
	})

	it("does not read as fine when parts of it did not validate", async () => {
		page(PARTIAL)

		expect(await screen.findByText("Valid, with errors")).toBeInTheDocument()
		// The Collections it did declare are still listed.
		expect(screen.getByText("Posts")).toBeInTheDocument()
	})

	it("sends the writer to GitHub to change what Kobun can see", async () => {
		page()

		const installation = await screen.findByRole("link", {
			name: /GitHub App installation/,
		})
		expect(installation).toHaveAttribute(
			"href",
			"https://github.com/settings/installations",
		)
	})
})

describe("a Project whose Config does not read", () => {
	it("still renders, and says what went wrong", async () => {
		page(BROKEN)

		expect(
			await screen.findByText("Failed to parse config"),
		).toBeInTheDocument()
		expect(screen.getByText("Invalid")).toBeInTheDocument()
	})

	it("lists nothing rather than what the Config used to declare", async () => {
		page(BROKEN)

		expect(await screen.findByText("Nothing declared")).toBeInTheDocument()
		expect(screen.queryByText("Posts")).not.toBeInTheDocument()
	})

	it("still offers the refresh that is the way out of it", async () => {
		const { action } = page(BROKEN)

		await userEvent.click(
			await screen.findByRole("button", { name: /Refresh configuration/ }),
		)

		await waitFor(() => expect(action).toHaveBeenCalled())
		const [call] = action.mock.results
		expect((await call.value).submitted).toEqual({
			intent: "refresh-configuration",
		})
	})
})
