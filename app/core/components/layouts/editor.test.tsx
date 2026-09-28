import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useMemo, useState } from "react"
import { createRoutesStub } from "react-router"
import { describe, expect, it, vi } from "vitest"
import {
	EditorActionError,
	type EditorSaveError,
} from "@/core/editor/editor-action"
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
		saveError: null,
		toggleProperties: vi.fn(),
		...overrides,
	}
}

function header({
	draftEditorPath = null,
	parentPath = PARENT_PATH,
	primaryAction = "save" as PrimaryEditorAction,
	registered = controls(),
	useRegistered,
}: {
	draftEditorPath?: string | null
	parentPath?: string
	primaryAction?: PrimaryEditorAction
	registered?: EditorLayoutControls | null
	/** For controls that change after the editor mounts, as a save's error does. */
	useRegistered?: () => EditorLayoutControls
} = {}) {
	function Child() {
		useEditorLayoutControls(useRegistered?.() ?? registered ?? controls())
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
				draftEditorPath,
				parentLabel: "Posts",
				parentPath,
				primaryAction: stored,
			}),
			path: "/editor",
			children: registered ? [{ Component: Child, index: true }] : [],
		},
		{
			Component: () => <div data-testid="collection-page" />,
			path: parentPath,
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

/** A request the server refused, as the editor hands it to the header. */
const refused = (
	message: string,
	code: EditorSaveError["code"] = null,
): EditorSaveError => ({ code, message })

const CONFLICT = refused(
	"Draft changed in another session",
	"revision-conflict",
)

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

	// An autosave nobody clicked is refused the same way a Save is, and the
	// writer is owed the same reason rather than a Draft that silently stays
	// unsaved (#159).
	it("says why an autosave was refused, rather than that it is still to come", async () => {
		header({
			registered: controls({
				autosaveState: { isDirty: true, isSaving: false, lastSavedAt: null },
				saveError: refused("Could not reach the server"),
			}),
		})

		const status = await screen.findByText("Could not reach the server")
		expect(status).toHaveClass("text-destructive")
		expect(screen.queryByText("Draft not saved yet")).not.toBeInTheDocument()
	})

	// The editor holds the refusal of every request it sends, a clicked Save's
	// included, so the header's own copy must not outlive the next save.
	it("stops saying why a Save was refused once the next save starts", async () => {
		const user = userEvent.setup()
		let setSaveError: (error: EditorSaveError | null) => void = () => undefined
		header({
			useRegistered: () => {
				const [saveError, set] = useState<EditorSaveError | null>(null)
				setSaveError = set
				return useMemo(
					() =>
						controls({
							autosaveState: {
								isDirty: true,
								isSaving: false,
								lastSavedAt: null,
							},
							save: async () => {
								set(refused("Someone else changed this draft"))
								throw new Error("Someone else changed this draft")
							},
							saveError,
						}),
					[saveError],
				)
			},
		})
		await screen.findByTestId("editor-body")

		await user.click(primary())
		expect(status()).toHaveTextContent("Someone else changed this draft")

		act(() => setSaveError(null))

		expect(status()).toHaveTextContent("Draft not saved yet")
	})
})

// A Revision Conflict is a normal outcome, not an error (CONTEXT.md), and a
// retry cannot clear it: only a reload moves the writer on (#166).
describe("a Draft another session changed first", () => {
	const dirty = { isDirty: true, isSaving: false, lastSavedAt: null }

	it("says so without dressing it as a failure", async () => {
		header({ registered: controls({ saveError: CONFLICT }) })

		const status = await screen.findByText("Draft changed in another session")
		expect(status).not.toHaveClass("text-destructive")
		expect(status).not.toHaveClass("text-muted-foreground")
	})

	it("offers a reload, the one way on", async () => {
		const user = userEvent.setup()
		const reload = vi.fn()
		const location = vi
			.spyOn(window, "location", "get")
			.mockReturnValue({ ...window.location, reload })
		try {
			header({ registered: controls({ saveError: CONFLICT }) })
			await screen.findByTestId("editor-body")

			await user.click(screen.getByRole("button", { name: "Reload" }))

			expect(reload).toHaveBeenCalledOnce()
		} finally {
			location.mockRestore()
		}
	})

	it("offers no reload for a failure a retry may clear", async () => {
		header({
			registered: controls({
				saveError: refused("Could not reach the server"),
			}),
		})

		await screen.findByTestId("editor-body")
		expect(
			screen.queryByRole("button", { name: "Reload" }),
		).not.toBeInTheDocument()
	})

	// The save would be refused the same way, so there is nothing to keep the
	// writer for: the status line has already said why.
	it("lets the writer leave without trying to keep what cannot be kept", async () => {
		const user = userEvent.setup()
		const save = vi.fn()
		header({
			registered: controls({ autosaveState: dirty, save, saveError: CONFLICT }),
		})
		await screen.findByTestId("editor-body")

		await user.click(back())

		expect(await screen.findByTestId("collection-page")).toBeInTheDocument()
		expect(save).not.toHaveBeenCalled()
	})
})

// A Stale Source is the same kind of outcome on GitHub's side. The writer acts
// on it by copying or discarding the Draft, which a reload would not do.
describe("a Source that changed on GitHub under the Draft", () => {
	const STALE = refused(
		"This item changed on GitHub. Copy your draft or discard it before reloading.",
		"stale-source",
	)

	it("says so without dressing it as a failure, and offers no reload", async () => {
		header({ registered: controls({ saveError: STALE }) })

		const status = await screen.findByText(STALE.message)
		expect(status).not.toHaveClass("text-destructive")
		expect(
			screen.queryByRole("button", { name: "Reload" }),
		).not.toBeInTheDocument()
	})

	it("reads a clicked Save to GitHub's refusal the same way", async () => {
		const user = userEvent.setup()
		header({
			primaryAction: "commit",
			registered: controls({
				commit: async () => {
					throw new EditorActionError(STALE.message, "stale-source")
				},
			}),
		})
		await screen.findByTestId("editor-body")

		await user.click(primary())

		const status = await screen.findByText(STALE.message)
		expect(status).not.toHaveClass("text-destructive")
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

describe("leaving with keystrokes autosave has not kept yet", () => {
	const dirty = { isDirty: true, isSaving: false, lastSavedAt: null }

	it("keeps them before the next page loads, whatever the primary", async () => {
		const user = userEvent.setup()
		let finishSave = () => {}
		const save = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finishSave = resolve
				}),
		)
		header({ registered: controls({ autosaveState: dirty, save }) })
		await screen.findByTestId("editor-body")

		await user.click(back())

		await waitFor(() => expect(save).toHaveBeenCalledOnce())
		expect(screen.queryByTestId("collection-page")).not.toBeInTheDocument()
		finishSave()
		expect(await screen.findByTestId("collection-page")).toBeInTheDocument()
	})

	it("stays, saying why, when they cannot be kept", async () => {
		const user = userEvent.setup()
		const save = vi.fn(async () => {
			throw new Error("Draft changed in another session")
		})
		header({ registered: controls({ autosaveState: dirty, save }) })
		await screen.findByTestId("editor-body")

		await user.click(back())

		await waitFor(() =>
			expect(status()).toHaveTextContent("Draft changed in another session"),
		)
		expect(screen.queryByTestId("collection-page")).not.toBeInTheDocument()
	})

	// A save that failed once will fail again — a Revision Conflict does not
	// clear by retrying — so the writer who tries again is let go.
	it("lets the writer go on a second try after they could not be kept", async () => {
		const user = userEvent.setup()
		const save = vi.fn(async () => {
			throw new Error("Draft changed in another session")
		})
		header({ registered: controls({ autosaveState: dirty, save }) })
		await screen.findByTestId("editor-body")

		await user.click(back())
		await waitFor(() =>
			expect(status()).toHaveTextContent("Draft changed in another session"),
		)
		await user.click(back())

		expect(await screen.findByTestId("collection-page")).toBeInTheDocument()
		expect(save).toHaveBeenCalledOnce()
	})

	it("keeps them when the writer leaves a repository that is behind anyway", async () => {
		const user = userEvent.setup()
		const save = vi.fn()
		header({
			primaryAction: "commit",
			registered: controls({
				autosaveState: dirty,
				hasUncommittedWork: true,
				save,
			}),
		})
		await screen.findByTestId("editor-body")

		await user.click(back())
		expect(save).not.toHaveBeenCalled()
		await user.click(
			await screen.findByRole("button", { name: "Leave anyway" }),
		)

		expect(await screen.findByTestId("collection-page")).toBeInTheDocument()
		expect(save).toHaveBeenCalledOnce()
	})
})

describe("moving between a Singleton and one of its rows", () => {
	const SINGLETON_EDITOR = "/acme/site/singletons/home/editor"

	// Both pages edit the one Draft, so nothing is left behind by moving between
	// them — the warning waits for the writer to leave the Draft itself.
	it("does not warn about a repository that is behind", async () => {
		const user = userEvent.setup()
		header({
			draftEditorPath: SINGLETON_EDITOR,
			parentPath: SINGLETON_EDITOR,
			primaryAction: "commit",
			registered: controls({ hasUncommittedWork: true }),
		})
		await screen.findByTestId("editor-body")

		await user.click(back())

		expect(await screen.findByTestId("collection-page")).toBeInTheDocument()
		expect(
			screen.queryByText("This isn't on GitHub yet"),
		).not.toBeInTheDocument()
	})

	it("still warns when the writer leaves the Singleton", async () => {
		const user = userEvent.setup()
		header({
			draftEditorPath: SINGLETON_EDITOR,
			parentPath: "/acme/site/singletons/home",
			primaryAction: "commit",
			registered: controls({ hasUncommittedWork: true }),
		})
		await screen.findByTestId("editor-body")

		await user.click(back())

		expect(
			await screen.findByText("This isn't on GitHub yet"),
		).toBeInTheDocument()
	})
})
