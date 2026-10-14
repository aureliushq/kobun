import { act, render, renderHook, waitFor } from "@testing-library/react"
import { Editor } from "@tiptap/core"
import { EditorContent } from "@tiptap/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getEditorExtensions } from "../extensions"
import type { ImageUploadAdapter } from "../types"
import { useImageUploads } from "./use-image-uploads"

function mountEditor(upload: ImageUploadAdapter["upload"]) {
	vi.stubGlobal("URL", {
		...URL,
		createObjectURL: vi.fn().mockReturnValue("blob:preview"),
	})
	const editor = new Editor({
		element: document.createElement("div"),
		extensions: getEditorExtensions({ imageUpload: { upload } }),
	})
	render(<EditorContent editor={editor} />)
	return editor
}

function insertImage(editor: Editor) {
	act(() => {
		editor.commands.insertImageComponent(
			new File([new Uint8Array(10)], "cat.png", { type: "image/png" }),
		)
	})
}

describe("useImageUploads", () => {
	afterEach(() => vi.unstubAllGlobals())

	it("reports nothing without an editor", () => {
		const { result } = renderHook(() => useImageUploads(null))
		expect(result.current).toEqual({ failed: [], uploading: 0 })
	})

	it("counts an image while it uploads and lets go once it lands", async () => {
		let finishUpload: (src: string) => void = () => undefined
		const upload = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					finishUpload = resolve
				}),
		)
		const editor = mountEditor(upload)
		const { result } = renderHook(() => useImageUploads(editor))

		insertImage(editor)
		expect(result.current).toEqual({ failed: [], uploading: 1 })

		// The node view starts the upload once it mounts.
		await waitFor(() => expect(upload).toHaveBeenCalledOnce())
		act(() => finishUpload("assets/cat.png"))
		await waitFor(() =>
			expect(result.current).toEqual({ failed: [], uploading: 0 }),
		)
		editor.destroy()
	})

	it("names an image whose upload failed", async () => {
		const editor = mountEditor(vi.fn().mockRejectedValue(new Error("Too big")))
		const { result } = renderHook(() => useImageUploads(editor))

		insertImage(editor)
		await waitFor(() =>
			expect(result.current).toEqual({ failed: ["cat.png"], uploading: 0 }),
		)
		editor.destroy()
	})
})
