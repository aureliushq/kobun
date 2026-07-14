import { act, renderHook } from "@testing-library/react"
import type { Editor } from "@tiptap/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAutosave } from "./use-autosave"

type UpdateHandler = () => void

function createDeferred() {
	let resolve: () => void = () => undefined
	const promise = new Promise<void>((promiseResolve) => {
		resolve = promiseResolve
	})
	return { promise, resolve }
}

function createTestEditor(initialMarkdown = "") {
	let markdown = initialMarkdown
	const updateHandlers = new Set<UpdateHandler>()

	const editor = {
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
		update(nextMarkdown: string) {
			markdown = nextMarkdown
			for (const handler of updateHandlers) handler()
		},
	}
}

describe("useAutosave", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("debounces saves and reports the save lifecycle", async () => {
		vi.setSystemTime(new Date("2026-07-14T12:00:00Z"))
		const testEditor = createTestEditor("Initial")
		const onAutoSave = vi.fn()
		const { result } = renderHook(() =>
			useAutosave({
				editor: testEditor.editor,
				persistence: { onAutoSave },
				delay: 500,
			}),
		)

		act(() => testEditor.update("Changed"))

		expect(result.current.isDirty).toBe(true)
		expect(onAutoSave).not.toHaveBeenCalled()

		await act(async () => {
			await vi.advanceTimersByTimeAsync(499)
		})
		expect(onAutoSave).not.toHaveBeenCalled()

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1)
		})

		expect(onAutoSave).toHaveBeenCalledOnce()
		expect(onAutoSave).toHaveBeenCalledWith("Changed")
		expect(result.current).toMatchObject({
			isDirty: false,
			isSaving: false,
			lastSavedAt: new Date("2026-07-14T12:00:00.500Z"),
		})
	})

	it("coalesces edits made while a save is in flight", async () => {
		const testEditor = createTestEditor("Initial")
		const firstSave = createDeferred()
		const onAutoSave = vi
			.fn<(markdown: string) => Promise<void>>()
			.mockReturnValueOnce(firstSave.promise)
			.mockResolvedValueOnce()
		const { result } = renderHook(() =>
			useAutosave({
				editor: testEditor.editor,
				persistence: { onAutoSave },
				delay: 100,
			}),
		)

		act(() => testEditor.update("First"))
		await act(async () => vi.advanceTimersByTimeAsync(100))
		expect(onAutoSave).toHaveBeenCalledTimes(1)
		expect(result.current.isSaving).toBe(true)

		act(() => testEditor.update("Latest"))
		await act(async () => vi.advanceTimersByTimeAsync(100))
		expect(onAutoSave).toHaveBeenCalledTimes(1)

		await act(async () => firstSave.resolve())

		expect(onAutoSave).toHaveBeenCalledTimes(2)
		expect(onAutoSave).toHaveBeenLastCalledWith("Latest")
		expect(result.current).toMatchObject({ isDirty: false, isSaving: false })
	})

	it("persists a revert made while a save is in flight", async () => {
		const testEditor = createTestEditor("Initial")
		const firstSave = createDeferred()
		const onAutoSave = vi
			.fn<(markdown: string) => Promise<void>>()
			.mockReturnValueOnce(firstSave.promise)
			.mockResolvedValueOnce()
		renderHook(() =>
			useAutosave({
				editor: testEditor.editor,
				persistence: { onAutoSave },
				delay: 100,
			}),
		)

		act(() => testEditor.update("First"))
		await act(async () => vi.advanceTimersByTimeAsync(100))
		act(() => testEditor.update("Initial"))
		await act(async () => firstSave.resolve())

		await act(async () => vi.advanceTimersByTimeAsync(100))
		expect(onAutoSave).toHaveBeenCalledTimes(2)
		expect(onAutoSave).toHaveBeenLastCalledWith("Initial")
	})

	it("tracks dirty content without an autosave adapter", () => {
		const testEditor = createTestEditor("Initial")
		const { result } = renderHook(() =>
			useAutosave({ editor: testEditor.editor }),
		)

		act(() => testEditor.update("Changed"))

		expect(result.current.isDirty).toBe(true)
		expect(result.current.hasUnsavedChanges()).toBe(true)

		act(() => testEditor.update("Initial"))

		expect(result.current.isDirty).toBe(false)
		expect(result.current.hasUnsavedChanges()).toBe(false)
	})

	it("keeps failed content dirty", async () => {
		const testEditor = createTestEditor("Initial")
		const error = new Error("save failed")
		const onAutoSave = vi.fn().mockRejectedValue(error)
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
		const { result } = renderHook(() =>
			useAutosave({
				editor: testEditor.editor,
				persistence: { onAutoSave },
				delay: 100,
			}),
		)

		act(() => testEditor.update("Changed"))
		await act(async () => vi.advanceTimersByTimeAsync(100))

		expect(consoleError).toHaveBeenCalledWith("Autosave failed:", error)
		expect(result.current).toMatchObject({
			isDirty: true,
			isSaving: false,
			lastSavedAt: null,
		})

		await act(async () => vi.advanceTimersByTimeAsync(100))
		expect(onAutoSave).toHaveBeenCalledOnce()
	})

	it("flushes dirty content on unmount", async () => {
		const testEditor = createTestEditor("Initial")
		const onAutoSave = vi.fn()
		const { unmount } = renderHook(() =>
			useAutosave({
				editor: testEditor.editor,
				persistence: { onAutoSave },
				delay: 1000,
			}),
		)

		act(() => testEditor.update("Changed"))
		unmount()
		await Promise.resolve()

		expect(onAutoSave).toHaveBeenCalledOnce()
		expect(onAutoSave).toHaveBeenCalledWith("Changed")
	})

	it("can mark the current document as a clean baseline", async () => {
		const testEditor = createTestEditor("Initial")
		const onAutoSave = vi.fn()
		const { result } = renderHook(() =>
			useAutosave({
				editor: testEditor.editor,
				persistence: { onAutoSave },
				delay: 100,
			}),
		)

		act(() => testEditor.update("Loaded document"))
		act(() => result.current.markCurrentContentClean())
		await act(async () => vi.advanceTimersByTimeAsync(100))

		expect(onAutoSave).not.toHaveBeenCalled()
		expect(result.current).toMatchObject({
			isDirty: false,
			lastSavedAt: null,
		})
	})
})
