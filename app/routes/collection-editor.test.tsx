import { act, render, waitFor } from "@testing-library/react"
import {
	createRoutesStub,
	isRouteErrorResponse,
	Outlet,
	useLocation,
} from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ResolvedField } from "@/config/types"
import {
	EditorLayoutContext,
	type EditorLayoutControls,
} from "@/core/components/layouts/editor-context"

import CollectionEditor, {
	openCollectionItem,
	shouldRevalidate,
} from "./collection-editor"

/**
 * The error contract of the half this route streams (#104).
 *
 * Once the Source read moved behind a `Suspense` the two ways it can fail stopped
 * being interchangeable, because the wire is lossy: the turbo-stream encoder
 * preserves an `ErrorResponse` and nothing else useful — a thrown `Response`
 * arrives as an empty object, and a plain `Error` is sanitized to "Unexpected
 * Server Error" outside development. So the 404 a Slug that names nothing must
 * still answer is the one rejection whose shape is load-bearing, and this pins
 * it. `openCollectionItem` is exported for exactly this.
 */

const mocks = vi.hoisted(() => ({
	mounts: 0,
	persistence: undefined as
		| {
				onAutoSave: (markdown: string) => Promise<void>
				onCommit: (markdown: string) => Promise<void>
		  }
		| undefined,
}))

// Tiptap comes in through the view this route renders, and none of it is under
// test here. The stub counts its mounts, which is what a remount would cost the
// writer: undo history, cursor and scroll.
vi.mock("@/editor", async () => {
	const { useEffect } = await import("react")
	return {
		EditorWordCount: () => null,
		RichTextEditor: (props: {
			persistence: NonNullable<typeof mocks.persistence>
			ref?: (api: unknown) => void
		}) => {
			mocks.persistence = props.persistence
			const { ref } = props
			useEffect(() => {
				mocks.mounts += 1
				// Read at call time, as the real editor reads the latest props.
				ref?.({
					commit: () => mocks.persistence?.onCommit("Once upon a time."),
					focus: vi.fn(),
					getEditor: () => null,
					hasUnsavedChanges: () => false,
					publish: vi.fn(),
					save: () => mocks.persistence?.onAutoSave("Once upon a time."),
				})
			}, [ref])
			return <div data-testid="rich-text-editor" />
		},
	}
})

const drafts = (open: () => Promise<unknown>) => ({ open }) as never

describe("opening a Collection Item that is not there", () => {
	it("rejects as a 404 the route's error boundary can read", async () => {
		const error = await openCollectionItem(
			drafts(async () => ({ code: "not-found", ok: false })),
			{ mode: "item", slug: "gone" },
		).catch((rejection: unknown) => rejection)

		expect(isRouteErrorResponse(error)).toBe(true)
		expect((error as { status: number }).status).toBe(404)
	})

	// A GitHub outage is not a missing item, and must not be dressed as one: the
	// writer is told to try again, not that their work has vanished.
	it("lets a failed read reject as itself", async () => {
		const failure = new Error("github exploded")

		const error = await openCollectionItem(
			drafts(async () => {
				throw failure
			}),
			{ mode: "item", slug: "hello" },
		).catch((rejection: unknown) => rejection)

		expect(error).toBe(failure)
		expect(isRouteErrorResponse(error)).toBe(false)
	})

	it("hands the Effective Content straight through when it is there", async () => {
		const opened = await openCollectionItem(
			drafts(async () => ({
				content: "Once upon a time.",
				draftId: "draft-1",
				fields: { title: "Hello" },
				ok: true,
				revision: 3,
				source: { itemSlug: "hello" },
			})),
			{ mode: "item", slug: "hello" },
		)

		expect(opened).toEqual({
			content: "Once upon a time.",
			draftId: "draft-1",
			fields: { title: "Hello" },
			revision: 3,
		})
	})
})

////////////////////// THE FIRST SAVE TO GITHUB //////////////////////

/**
 * A new item's first Save to GitHub moves the URL to the item it became, and
 * nothing else (#176). The writer is still writing the same document, so the
 * editor must not unmount, reload it from GitHub, or lose its Draft identity.
 */
describe("the first Save to GitHub on a new item", () => {
	const NEW_PATH = "/acme/site/collections/posts/editor/new"
	const ITEM_PATH = "/acme/site/collections/posts/editor/item/hello"
	const SCHEMA = {
		content: { format: "md", label: "Body", type: "document" },
		slug: { from: "title", label: "Slug", type: "slug" },
		title: { label: "Title", type: "text" },
	} as unknown as Record<string, ResolvedField>

	let controls: EditorLayoutControls | null = null
	let pathname = ""
	let search = ""

	function answer(body: object) {
		vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(body)))
	}

	/** What the editor sent, in order. */
	function requests() {
		return vi.mocked(fetch).mock.calls.map(([url, init]) => ({
			body: JSON.parse(String(init?.body)) as {
				draftId: string | null
				intent: string
			},
			url: String(url),
		}))
	}

	function open() {
		const loader = vi.fn(() => ({
			canPublish: false,
			mode: "new" as const,
			name: "site",
			opened: {
				content: "",
				dirty: false,
				draftId: null,
				fields: { slug: "", title: "" },
				revision: null,
			},
			owner: "acme",
			publishDisabledReason: null,
			schema: SCHEMA,
		}))
		const Stub = createRoutesStub([
			{
				children: [
					{
						Component: CollectionEditor as never,
						loader,
						path: "/:owner/:name/collections/:collection_slug/editor/:editor_mode/:collection_item_slug?",
						shouldRevalidate,
					},
				],
				Component: function Layout() {
					const location = useLocation()
					pathname = location.pathname
					search = location.search
					return (
						<EditorLayoutContext.Provider
							value={{
								setControls: (next) => {
									controls = next
								},
							}}
						>
							<Outlet />
						</EditorLayoutContext.Provider>
					)
				},
			},
		])
		render(<Stub initialEntries={[NEW_PATH]} />)
		return { loader }
	}

	/** A new item, saved to GitHub for the first time. */
	async function openAndCommit() {
		const opened = open()
		await waitFor(() => expect(controls?.canCommit).toBe(true))
		answer({
			commitSha: "abc",
			draftDeleted: true,
			fields: { slug: "hello", title: "Hello" },
			itemPath: ITEM_PATH,
		})
		await act(async () => {
			await controls?.commit()
		})
		return opened
	}

	beforeEach(() => {
		controls = null
		mocks.mounts = 0
		mocks.persistence = undefined
		vi.stubGlobal("fetch", vi.fn())
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("keeps the same editor and moves only the URL", async () => {
		const { loader } = await openAndCommit()

		expect(pathname).toBe(ITEM_PATH)
		expect(loader).toHaveBeenCalledTimes(1)
		expect(mocks.mounts).toBe(1)
	})

	// Typing on after the commit edits the item the repository now names: one
	// Draft, against the item path, and a second Save to GitHub that goes there.
	it("saves and commits again against the item it became", async () => {
		await openAndCommit()

		answer({ draftId: "draft-2", fields: null, revision: 1 })
		await act(async () => {
			await mocks.persistence?.onAutoSave("Once upon a time, again.")
		})

		answer({ commitSha: "def", draftDeleted: true })
		await act(async () => {
			await controls?.commit()
		})

		expect(requests()).toMatchObject([
			{ body: { intent: "commit" }, url: `/api/editor${NEW_PATH}` },
			{
				body: { draftId: null, intent: "save" },
				url: `/api/editor${ITEM_PATH}`,
			},
			{
				body: { draftId: "draft-2", intent: "commit" },
				url: `/api/editor${ITEM_PATH}`,
			},
		])
		// The item path names it now; a `?draft=` would only be noise.
		expect(pathname).toBe(ITEM_PATH)
		expect(search).toBe("")
		expect(mocks.mounts).toBe(1)
	})

	// An autosave the writer's last keystrokes scheduled can fire while the
	// commit is still in flight. It was queued by the editor as it was before
	// the commit, but it lands after, so it must save the item the commit made
	// rather than mint a second Draft for the new one.
	it("sends a save queued behind the commit to the item it became", async () => {
		open()
		await waitFor(() => expect(controls?.canCommit).toBe(true))

		let land: (response: Response) => void = () => undefined
		vi.mocked(fetch).mockReturnValueOnce(
			new Promise<Response>((resolve) => {
				land = resolve
			}),
		)
		answer({ draftId: "draft-2", fields: null, revision: 1 })
		let committing: Promise<void> | undefined
		let saving: Promise<void> | undefined
		act(() => {
			committing = controls?.commit()
			saving = mocks.persistence?.onAutoSave("Once upon a time.")
		})
		await act(async () => {
			land(
				new Response(
					JSON.stringify({
						commitSha: "abc",
						draftDeleted: true,
						fields: { slug: "hello", title: "Hello" },
						itemPath: ITEM_PATH,
					}),
				),
			)
			await committing
			await saving
		})

		expect(requests()).toMatchObject([
			{ body: { intent: "commit" }, url: `/api/editor${NEW_PATH}` },
			{
				body: { draftId: null, intent: "save" },
				url: `/api/editor${ITEM_PATH}`,
			},
		])
		expect(pathname).toBe(ITEM_PATH)
		expect(search).toBe("")
	})
})
