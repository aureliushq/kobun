import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRoutesStub } from "react-router"
import { describe, expect, it, vi } from "vitest"
import type { PrimaryEditorAction } from "@/core/editor/primary-action"

import EditorLayout from "./editor"
import {
	type EditorLayoutControls,
	useEditorLayoutControls,
} from "./editor-context"

/**
 * The editor's header (#107).
 *
 * One split control offering both targets, Publish beside it where the
 * Collection has a Publication State to declare, a status line that names which
 * target it is talking about, and a warning for a writer walking away from a
 * repository that is behind. The geometry is asserted structurally: happy-dom
 * has no layout engine, so the tests pin the grid that makes constant width
 * true rather than measuring a width that is always zero.
 */

const PARENT_PATH = "/acme/site/collections/posts"

function controls(
	overrides: Partial<EditorLayoutControls> = {},
): EditorLayoutControls {
	return {
		autosaveState: { isDirty: false, isSaving: false, lastSavedAt: null },
		canCommit: true,
		canPublish: true,
		canSave: true,
		commit: vi.fn(),
		hasUncommittedWork: false,
		isPropertiesOpen: true,
		publish: vi.fn(),
		save: vi.fn(),
		toggleProperties: vi.fn(),
		...overrides,
	}
}

function header({
	primaryAction = "save" as PrimaryEditorAction,
	registered = controls(),
}: {
	primaryAction?: PrimaryEditorAction
	registered?: EditorLayoutControls | null
} = {}) {
	function Child() {
		useEditorLayoutControls(registered ?? controls())
		return <div data-testid="editor-body" />
	}

	// Stands in for the writer's row: the action writes it, the loader reads it
	// back. Without that the stub's loader would answer with the old target the
	// moment the fetcher settled, and the label would flash back — which is
	// exactly the thing the optimistic value exists to prevent.
	let stored = primaryAction

	const Stub = createRoutesStub([
		{
			Component: EditorLayout,
			loader: () => ({
				parentLabel: "Posts",
				parentPath: PARENT_PATH,
				primaryAction: stored,
			}),
			path: "/editor",
			children: registered ? [{ Component: Child, index: true }] : [],
		},
		{
			Component: () => <div data-testid="collection-page" />,
			path: PARENT_PATH,
		},
		{
			action: async ({ request }: { request: Request }) => {
				stored = String(
					(await request.formData()).get("action"),
				) as PrimaryEditorAction
				return { success: true }
			},
			path: "/api/set-editor-primary-action",
		},
	])

	return render(<Stub initialEntries={["/editor"]} />)
}

const primary = () => screen.getByTestId("editor-save-primary")
const status = () => screen.getByTestId("editor-save-status")
const back = () => screen.getByRole("link")

describe("the primary the writer last chose", () => {
	it("is Save for a writer who has never chosen", async () => {
		header()

		expect(await screen.findByTestId("editor-body")).toBeInTheDocument()
		expect(primary()).toHaveAccessibleName("Save")
	})

	it("is Save to GitHub once the writer's row says so", async () => {
		header({ primaryAction: "commit" })

		await screen.findByTestId("editor-body")
		expect(primary()).toHaveAccessibleName("Save to GitHub")
	})

	// The label must not wait on the round trip that writes the row, nor
	// flash back to the old target once it lands.
	it("changes when the writer chooses, and stays changed", async () => {
		const user = userEvent.setup()
		header()
		await screen.findByTestId("editor-body")

		await user.click(
			screen.getByRole("button", { name: "Change what the save button does" }),
		)
		const [, commit] = await screen.findAllByRole("menuitemradio")
		await user.click(commit)

		await waitFor(() => {
			expect(primary()).toHaveAccessibleName("Save to GitHub")
		})
	})
})

describe("what the primary button will act on", () => {
	// The gate Save has always had. Save to GitHub never had one, and gaining
	// it through the shared button would be a behaviour nobody asked for.
	it("is dead for Save when there is nothing to keep", async () => {
		header()

		await screen.findByTestId("editor-body")
		expect(primary()).toBeDisabled()
	})

	it("is live for Save to GitHub whether or not anything changed", async () => {
		header({ primaryAction: "commit" })

		await screen.findByTestId("editor-body")
		expect(primary()).not.toBeDisabled()
	})
})

describe("the status line", () => {
	it("says nothing before anything has been saved", async () => {
		header()

		await screen.findByTestId("editor-body")
		expect(status()).toHaveTextContent("")
	})

	it("names the Draft as what is being written", async () => {
		header({
			registered: controls({
				autosaveState: { isDirty: true, isSaving: true, lastSavedAt: null },
			}),
		})

		expect(await screen.findByText("Saving draft…")).toBeInTheDocument()
	})

	it("says what has not been kept yet", async () => {
		header({
			registered: controls({
				autosaveState: { isDirty: true, isSaving: false, lastSavedAt: null },
				hasUncommittedWork: true,
			}),
		})

		expect(await screen.findByText("Draft not saved yet")).toBeInTheDocument()
	})

	// The misreading this exists to foreclose: a writer whose button says Save
	// to GitHub must not read a kept Draft as a commit.
	it("says a kept Draft is not on GitHub, rather than a bare Saved", async () => {
		header({
			primaryAction: "commit",
			registered: controls({
				autosaveState: {
					isDirty: false,
					isSaving: false,
					lastSavedAt: new Date(),
				},
				hasUncommittedWork: true,
			}),
		})

		expect(
			await screen.findByText("Draft saved, not on GitHub"),
		).toBeInTheDocument()
		expect(screen.queryByText("Saved")).not.toBeInTheDocument()
	})

	// A commit never touches the autosave's own `lastSavedAt`, so an item
	// committed without a keystroke first would otherwise say nothing at all.
	it("names the target after a commit that followed no typing", async () => {
		const user = userEvent.setup()
		header({ primaryAction: "commit" })
		await screen.findByTestId("editor-body")
		expect(status()).toHaveTextContent("")

		await user.click(primary())

		expect(await screen.findByText("Saved to GitHub")).toBeInTheDocument()
	})

	// An item nobody has touched must not claim a save nobody made.
	it("says nothing about an item that was only opened", async () => {
		header({ primaryAction: "commit" })

		await screen.findByTestId("editor-body")
		expect(status()).toHaveTextContent("")
	})

	it("says Saved to GitHub only once the repository holds it", async () => {
		header({
			registered: controls({
				autosaveState: {
					isDirty: false,
					isSaving: false,
					lastSavedAt: new Date(),
				},
				hasUncommittedWork: false,
			}),
		})

		expect(await screen.findByText("Saved to GitHub")).toBeInTheDocument()
	})

	// Autosave to D1 runs whatever the primary is (ADR-0008), and the wording
	// has to tell the truth about which one is running.
	it("still names the Draft while Save to GitHub is the primary", async () => {
		header({
			primaryAction: "commit",
			registered: controls({
				autosaveState: { isDirty: true, isSaving: true, lastSavedAt: null },
			}),
		})

		expect(await screen.findByText("Saving draft…")).toBeInTheDocument()
	})
})

describe("the header's geometry", () => {
	// Three tracks, the actions in the `auto` one: their left edge is then a
	// function of the controls alone, so a status message of any length — an
	// error is an arbitrary server string — cannot push them about.
	it("gives the status its own track, sized apart from the actions", async () => {
		const { container } = header()

		await screen.findByTestId("editor-body")
		expect(container.querySelector("header")).toHaveClass(
			"grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]",
		)
		expect(status()).toHaveClass("truncate")
	})

	it("keeps a status region for a screen reader even when it is empty", async () => {
		header()

		await screen.findByTestId("editor-body")
		expect(status()).toHaveAttribute("aria-live", "polite")
	})
})

describe("Publish beside the control", () => {
	it("is a sibling of the split control, not one of its halves", async () => {
		header()

		const publish = await screen.findByRole("button", { name: "Publish" })
		expect(publish.closest('[data-slot="button-group"]')).toBeNull()
	})

	// Absent, not disabled, where the Collection has no Publication State.
	it("is absent where the Collection has no publish Feature", async () => {
		header({ registered: controls({ publish: undefined }) })

		await screen.findByTestId("editor-body")
		expect(
			screen.queryByRole("button", { name: "Publish" }),
		).not.toBeInTheDocument()
	})
})

describe("walking away from a repository that is behind", () => {
	it("warns when Save to GitHub is the primary", async () => {
		const user = userEvent.setup()
		header({
			primaryAction: "commit",
			registered: controls({ hasUncommittedWork: true }),
		})
		await screen.findByTestId("editor-body")

		await user.click(back())

		expect(
			await screen.findByText("This isn't on GitHub yet"),
		).toBeInTheDocument()
		expect(screen.queryByTestId("collection-page")).not.toBeInTheDocument()
	})

	it("lets the writer go when they say so", async () => {
		const user = userEvent.setup()
		header({
			primaryAction: "commit",
			registered: controls({ hasUncommittedWork: true }),
		})
		await screen.findByTestId("editor-body")

		await user.click(back())
		await user.click(
			await screen.findByRole("button", { name: "Leave anyway" }),
		)

		expect(await screen.findByTestId("collection-page")).toBeInTheDocument()
	})

	it("keeps the writer here when they say to stay", async () => {
		const user = userEvent.setup()
		header({
			primaryAction: "commit",
			registered: controls({ hasUncommittedWork: true }),
		})
		await screen.findByTestId("editor-body")

		await user.click(back())
		await user.click(await screen.findByRole("button", { name: "Stay" }))

		await waitFor(() => {
			expect(
				screen.queryByText("This isn't on GitHub yet"),
			).not.toBeInTheDocument()
		})
		expect(screen.queryByTestId("collection-page")).not.toBeInTheDocument()
	})

	// Closing the tab is leaving too, and React Router never sees it.
	it("stops a tab close the same way it stops a link", async () => {
		header({
			primaryAction: "commit",
			registered: controls({ hasUncommittedWork: true }),
		})
		await screen.findByTestId("editor-body")

		const event = new Event("beforeunload", { cancelable: true })
		window.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
	})

	// The old behaviour, unchanged: a tab close with Save as the primary is
	// only about bytes D1 does not have, which the editor below guards.
	it("lets a tab close through when Save is the primary", async () => {
		header({ registered: controls({ hasUncommittedWork: true }) })
		await screen.findByTestId("editor-body")

		const event = new Event("beforeunload", { cancelable: true })
		window.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
	})

	// The warning is about a target the writer chose. With Save as the primary
	// they never asked for the repository to be up to date.
	it("says nothing when Save is the primary", async () => {
		const user = userEvent.setup()
		header({ registered: controls({ hasUncommittedWork: true }) })
		await screen.findByTestId("editor-body")

		await user.click(back())

		expect(await screen.findByTestId("collection-page")).toBeInTheDocument()
	})

	it("says nothing when the repository already holds the work", async () => {
		const user = userEvent.setup()
		header({ primaryAction: "commit" })
		await screen.findByTestId("editor-body")

		await user.click(back())

		expect(await screen.findByTestId("collection-page")).toBeInTheDocument()
	})
})
