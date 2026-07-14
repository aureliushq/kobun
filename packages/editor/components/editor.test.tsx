import { act, render } from "@testing-library/react"
import type { Editor } from "@tiptap/core"
import { createRef, StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { EditorRefApi } from "../types"
import { RichTextEditor } from "./editor"

const mocks = vi.hoisted(() => ({
	useEditor: vi.fn(),
}))

vi.mock("../hooks/use-editor", () => ({ useEditor: mocks.useEditor }))
vi.mock("@tiptap/react", () => ({ EditorContent: () => null }))
vi.mock("./menus/bubble-menu/bubble-menu", () => ({
	EditorBubbleMenu: () => null,
}))
vi.mock("./menus/side-menu/side-menu", () => ({ SideMenu: () => null }))

type UpdateHandler = () => void

function createTestEditor(initialMarkdown = "") {
	let markdown = initialMarkdown
	const updateHandlers = new Set<UpdateHandler>()
	const emitUpdate = () => {
		for (const handler of updateHandlers) handler()
	}
	const setContent = vi.fn(
		(nextMarkdown: string, options?: { emitUpdate?: boolean }) => {
			markdown = nextMarkdown
			if (options?.emitUpdate !== false) emitUpdate()
		},
	)

	const editor = {
		commands: {
			clearContent: () => {
				markdown = ""
				emitUpdate()
			},
			focus: vi.fn(),
			setContent,
		},
		getHTML: () => `<p>${markdown}</p>`,
		getJSON: () => ({ type: "doc" }),
		getMarkdown: () => markdown,
		on: (_event: string, handler: UpdateHandler) => {
			updateHandlers.add(handler)
		},
		off: (_event: string, handler: UpdateHandler) => {
			updateHandlers.delete(handler)
		},
	} as unknown as Editor

	return {
		editor,
		setContent,
		update(nextMarkdown: string) {
			markdown = nextMarkdown
			emitUpdate()
		},
	}
}

describe("RichTextEditor autosave", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("wires autosave state and clean document loads into the ref API", async () => {
		const testEditor = createTestEditor("Initial")
		mocks.useEditor.mockReturnValue(testEditor.editor)
		const onAutoSave = vi.fn()
		const onAutosaveStateChange = vi.fn()
		const ref = createRef<EditorRefApi>()
		render(
			<RichTextEditor
				ref={ref}
				autosaveDelay={100}
				onAutosaveStateChange={onAutosaveStateChange}
				persistence={{ onAutoSave }}
			/>,
		)

		act(() => testEditor.update("Changed"))
		expect(ref.current?.hasUnsavedChanges()).toBe(true)
		expect(onAutosaveStateChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ isDirty: true }),
		)

		await act(async () => vi.advanceTimersByTimeAsync(100))
		expect(onAutoSave).toHaveBeenCalledWith("Changed")
		expect(ref.current?.hasUnsavedChanges()).toBe(false)

		act(() => ref.current?.setMarkdown("Loaded"))
		expect(testEditor.setContent).toHaveBeenCalledWith("Loaded", {
			contentType: "markdown",
			emitUpdate: false,
		})
		expect(ref.current?.hasUnsavedChanges()).toBe(false)
	})

	it("publishes the current markdown without changing dirty state", async () => {
		const testEditor = createTestEditor("Initial")
		mocks.useEditor.mockReturnValue(testEditor.editor)
		const onPublish = vi.fn()
		const ref = createRef<EditorRefApi>()
		render(<RichTextEditor ref={ref} persistence={{ onPublish }} />)

		act(() => testEditor.update("Current content"))
		await act(async () => ref.current?.publish())

		expect(onPublish).toHaveBeenCalledWith("Current content")
		expect(ref.current?.hasUnsavedChanges()).toBe(true)
	})

	it("saves immediately and cancels the pending debounce", async () => {
		const testEditor = createTestEditor("Initial")
		mocks.useEditor.mockReturnValue(testEditor.editor)
		const onAutoSave = vi.fn()
		const ref = createRef<EditorRefApi>()
		render(<RichTextEditor ref={ref} persistence={{ onAutoSave }} />)

		act(() => testEditor.update("Current content"))
		await act(async () => ref.current?.save())
		await act(async () => vi.advanceTimersByTimeAsync(1000))

		expect(onAutoSave).toHaveBeenCalledOnce()
		expect(onAutoSave).toHaveBeenCalledWith("Current content")
		expect(ref.current?.hasUnsavedChanges()).toBe(false)
	})

	it("keeps edits made during a manual save dirty", async () => {
		const testEditor = createTestEditor("Initial")
		mocks.useEditor.mockReturnValue(testEditor.editor)
		let finishSave: () => void = () => undefined
		const firstSave = new Promise<void>((resolve) => {
			finishSave = resolve
		})
		const onAutoSave = vi
			.fn<(markdown: string) => Promise<void>>()
			.mockReturnValueOnce(firstSave)
			.mockResolvedValueOnce()
		const ref = createRef<EditorRefApi>()
		render(
			<RichTextEditor
				ref={ref}
				autosaveDelay={100}
				persistence={{ onAutoSave }}
			/>,
		)

		act(() => testEditor.update("Saving"))
		const save = ref.current?.save()
		act(() => testEditor.update("Newer edit"))
		await act(async () => finishSave())
		await save

		expect(ref.current?.hasUnsavedChanges()).toBe(true)
		await act(async () => vi.advanceTimersByTimeAsync(100))
		expect(onAutoSave).toHaveBeenLastCalledWith("Newer edit")
	})

	it("emits each autosave state once in Strict Mode", () => {
		const testEditor = createTestEditor("Initial")
		mocks.useEditor.mockReturnValue(testEditor.editor)
		const onAutosaveStateChange = vi.fn()
		render(
			<StrictMode>
				<RichTextEditor onAutosaveStateChange={onAutosaveStateChange} />
			</StrictMode>,
		)

		expect(onAutosaveStateChange).toHaveBeenCalledOnce()
		expect(onAutosaveStateChange).toHaveBeenCalledWith({
			isDirty: false,
			isSaving: false,
			lastSavedAt: null,
		})
	})
})
