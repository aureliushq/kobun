import {
	act,
	render,
	renderHook,
	screen,
	waitFor,
} from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Collection, ResolvedField } from "@/config/types"
import {
	EditorLayoutContext,
	type EditorLayoutControls,
} from "@/core/components/layouts/editor-context"
import { PreferencesContext } from "@/core/preferences/context"
import {
	DEFAULT_USER_PREFERENCES,
	EditorFont,
	EditorWidth,
	type UserPreferenceValues,
} from "@/db/types"

import {
	CollectionItemEditor,
	type OpenedContent,
	type PropertiesPanel,
	usePropertiesPanel,
} from "./collection-item-editor"

/**
 * What a Collection Item's editor shows while its Effective Content is still
 * streaming, and once it lands (#104).
 *
 * `opened` is the whole of the split: `null` is the half the page paints before
 * GitHub answers, a document is the half that replaces it. The assertions are
 * about what a writer can see, reach and type into in each — and about what the
 * layout's header is handed, since Save and Publish live up there.
 */

const mocks = vi.hoisted(() => ({
	richTextEditor: vi.fn(),
}))

// Tiptap is not what this test is about, and mounting it would drag ProseMirror
// into a happy-dom that has no layout. The stub keeps the one behaviour the
// split turns on: mounting registers the ref the controls gate on.
vi.mock("@/editor", () => ({
	EditorWordCount: () => <div data-testid="word-count" />,
	RichTextEditor: (props: {
		initialContent?: string
		persistence?: { onCommit?: (markdown: string) => Promise<void> }
		ref?: (api: unknown) => void
	}) => {
		mocks.richTextEditor(props.initialContent)
		props.ref?.({
			focus: vi.fn(),
			getEditor: () => null,
			// The one handler a test drives, so a commit reaches the route the way
			// the real editor sends it.
			commit: () => props.persistence?.onCommit?.(props.initialContent ?? ""),
			hasUnsavedChanges: () => false,
			publish: vi.fn(),
			save: vi.fn(),
		})
		return <div data-testid="rich-text-editor">{props.initialContent}</div>
	},
}))

/** Schema literals are authored, not parsed, so the enum discriminants are cast. */
const SCHEMA = {
	slug: { from: "title", label: "Slug", type: "slug" },
	title: { label: "Title", type: "text" },
	summary: { label: "Summary", type: "text" },
	content: { format: "md", label: "Body", type: "document" },
} as unknown as Record<string, ResolvedField>

const POSTS = { label: "Posts", schema: SCHEMA } as unknown as Collection

function opened(overrides: Partial<OpenedContent> = {}): OpenedContent {
	return {
		content: "Once upon a time.",
		draftId: null,
		fields: { slug: "hello", summary: "A summary", title: "Hello world" },
		revision: null,
		dirty: false,
		...overrides,
	}
}

const panel: PropertiesPanel = {
	isMobile: false,
	isOpen: true,
	setIsOpen: vi.fn(),
	toggle: vi.fn(),
}

function editor(
	content: OpenedContent | null,
	mode: "item" | "new" = "item",
	canPublish = true,
	preferences: UserPreferenceValues = DEFAULT_USER_PREFERENCES,
) {
	const setControls = vi.fn()
	const view = render(
		<MemoryRouter>
			<PreferencesContext.Provider value={preferences}>
				<EditorLayoutContext.Provider value={{ setControls }}>
					<CollectionItemEditor
						canPublish={canPublish}
						mode={mode}
						name="site"
						opened={content}
						owner="acme"
						panel={panel}
						publishDisabledReason={null}
						schema={POSTS.schema}
					/>
				</EditorLayoutContext.Provider>
			</PreferencesContext.Provider>
		</MemoryRouter>,
	)
	return { ...view, setControls }
}

/** What the header was last told it may do. */
function lastControls(setControls: ReturnType<typeof vi.fn>) {
	const published = setControls.mock.calls
		.map(([controls]) => controls as EditorLayoutControls | null)
		.filter((controls): controls is EditorLayoutControls => controls !== null)
	return published.at(-1)
}

const title = () => screen.getByLabelText("Title") as HTMLTextAreaElement

beforeEach(() => {
	mocks.richTextEditor.mockClear()
	vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

describe("a Collection Item whose content has not arrived", () => {
	it("paints the title and every Field the schema declares", () => {
		editor(null)

		expect(title()).toBeInTheDocument()
		expect(screen.getAllByText("Summary").length).toBeGreaterThan(0)
		expect(screen.getAllByText("Slug").length).toBeGreaterThan(0)
	})

	it("reserves the writing column rather than mounting an editor over it", () => {
		const { container } = editor(null)

		expect(screen.queryByTestId("rich-text-editor")).not.toBeInTheDocument()
		expect(
			container.querySelectorAll('[data-slot="skeleton"]').length,
		).toBeGreaterThan(0)
	})

	it("leaves nothing writable until the values land", () => {
		editor(null)

		expect(title()).toBeDisabled()
		for (const box of screen.getAllByRole("textbox")) {
			expect(box).toBeDisabled()
		}
	})

	it("holds every action back, so none can act on half a draft", () => {
		const { setControls } = editor(null)

		expect(lastControls(setControls)?.canSave).toBe(false)
		expect(lastControls(setControls)?.canCommit).toBe(false)
		expect(lastControls(setControls)?.canPublish).toBe(false)
	})

	// The panel toggle is the one control the header keeps throughout, so the
	// header does not visibly gain a button when the content arrives.
	it("still offers the properties toggle", () => {
		const { setControls } = editor(null)

		expect(lastControls(setControls)?.toggleProperties).toBe(panel.toggle)
	})

	it("does not autosave the placeholder", () => {
		vi.useFakeTimers()
		editor(null)

		vi.advanceTimersByTime(5_000)

		expect(fetch).not.toHaveBeenCalled()
	})
})

describe("a Collection Item whose content has arrived", () => {
	it("opens the editor on the Effective Content", () => {
		editor(opened())

		expect(screen.getByTestId("rich-text-editor")).toHaveTextContent(
			"Once upon a time.",
		)
		expect(mocks.richTextEditor).toHaveBeenCalledWith("Once upon a time.")
	})

	it("fills the Fields in and hands them back to the writer", () => {
		editor(opened())

		expect(title()).toHaveValue("Hello world")
		expect(title()).not.toBeDisabled()
		expect(screen.getByDisplayValue("A summary")).not.toBeDisabled()
	})

	it("hands Save, Save to GitHub and Publish back", () => {
		const { setControls } = editor(opened())

		expect(lastControls(setControls)?.canSave).toBe(true)
		expect(lastControls(setControls)?.canCommit).toBe(true)
		expect(lastControls(setControls)?.canPublish).toBe(true)
	})
})

describe("a Collection with no publish feature", () => {
	// Absent rather than disabled: there is no Publication State to declare, so
	// there is nothing Publish would do that Save to GitHub does not (ADR-0008).
	it("offers the header no Publish at all", () => {
		const { setControls } = editor(opened(), "item", false)

		expect(lastControls(setControls)?.publish).toBeUndefined()
	})

	it("still offers Save to GitHub, the only path to the repository", () => {
		const { setControls } = editor(opened(), "item", false)

		expect(lastControls(setControls)?.canCommit).toBe(true)
		expect(lastControls(setControls)?.commit).toBeTypeOf("function")
	})
})

describe("a commit that answers with what it wrote", () => {
	// A Save to GitHub leaves the writer here with the Draft already deleted, so
	// the panel has to show what landed rather than what it sent — otherwise the
	// system's own stamps read as unsaved work (ADR-0008).
	it("shows the committed Data in the properties panel", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					draftDeleted: true,
					fields: {
						slug: "hello",
						status: "published",
						summary: "The stamped summary",
						title: "Hello world",
					},
					ok: true,
				}),
			),
		)
		const { setControls } = editor(opened())

		await act(async () => {
			await lastControls(setControls)?.commit()
		})

		const [, request] = vi.mocked(fetch).mock.calls[0] ?? []
		expect(JSON.parse(String(request?.body))).toMatchObject({
			intent: "commit",
		})
		await waitFor(() => {
			expect(screen.getByDisplayValue("The stamped summary")).toBeVisible()
		})
	})

	// The commit put the bytes in the repository, so there is nothing left for
	// the header to warn a departing writer about (#107).
	it("tells the header the repository is no longer behind", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ draftDeleted: true, ok: true })),
		)
		const { setControls } = editor(opened({ dirty: true }))

		expect(lastControls(setControls)?.hasUncommittedWork).toBe(true)

		await act(async () => {
			await lastControls(setControls)?.commit()
		})

		await waitFor(() => {
			expect(lastControls(setControls)?.hasUncommittedWork).toBe(false)
		})
	})
})

describe("what the header is told about the repository", () => {
	it("passes on what opening the item decided", () => {
		const { setControls } = editor(opened({ dirty: true }))

		expect(lastControls(setControls)?.hasUncommittedWork).toBe(true)
	})

	// A Clean Draft has a row and is still fully in the repository, so a writer
	// who opened one and changed nothing must not be warned on the way out.
	it("reads a clean draft as nothing the repository lacks", () => {
		const { setControls } = editor(opened({ draftId: "d1" }))

		expect(lastControls(setControls)?.hasUncommittedWork).toBe(false)
	})
})

describe("a new Collection Item", () => {
	// Nothing to fetch, so nothing to wait for: the loader awaited this one.
	it("opens straight into a writable editor with no placeholder", () => {
		const { container } = editor(opened({ content: "" }), "new")

		expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument()
		expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0)
	})
})

////////////////////// PREFERENCES //////////////////////

describe("what the writer's Preferences change about the editor", () => {
	function preferences(overrides: Partial<UserPreferenceValues>) {
		return { ...DEFAULT_USER_PREFERENCES, ...overrides }
	}

	it("counts words unless the writer turned the count off", () => {
		editor(opened())
		expect(screen.getByTestId("word-count")).toBeInTheDocument()
	})

	it("shows no count at all when the writer turned it off", () => {
		editor(opened(), "item", true, preferences({ wordCountVisible: false }))
		expect(screen.queryByTestId("word-count")).not.toBeInTheDocument()
	})

	// Rendered as attributes rather than as a class, because the widths and the
	// typeface are one stylesheet's business: `editor.css` reads these and the
	// column inherits what the wrapper was told.
	it("hands the writing column its width and its typeface", () => {
		const { container } = editor(
			opened(),
			"item",
			true,
			preferences({
				editorFont: EditorFont.SERIF,
				editorWidth: EditorWidth.WIDE,
			}),
		)
		const wrapper = container.querySelector(".editor-wrapper")
		expect(wrapper).toHaveAttribute("data-editor-width", EditorWidth.WIDE)
		expect(wrapper).toHaveAttribute("data-editor-font", EditorFont.SERIF)
	})

	// A starting state, not a live one. Nothing here writes the row back, so a
	// writer who closes the panel has closed it for this visit.
	it("opens the properties panel closed when the writer asked for that", () => {
		const closed = renderHook(() => usePropertiesPanel(), {
			wrapper: ({ children }) => (
				<PreferencesContext.Provider
					value={preferences({ propertiesPanelOpen: false })}
				>
					{children}
				</PreferencesContext.Provider>
			),
		})
		expect(closed.result.current.isOpen).toBe(false)

		const open = renderHook(() => usePropertiesPanel())
		expect(open.result.current.isOpen).toBe(true)
	})
})
