import { act, render, screen, waitFor } from "@testing-library/react"
import { Editor } from "@tiptap/core"
import { EditorContent } from "@tiptap/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ImageUploadAdapter } from "../../types"
import { getEditorExtensions } from ".."

function imageFile(options?: { size?: number; type?: string }) {
	return new File([new Uint8Array(options?.size ?? 10)], "image.png", {
		type: options?.type ?? "image/png",
	})
}

function adapter(
	overrides: Partial<ImageUploadAdapter> = {},
): ImageUploadAdapter {
	return {
		upload: vi.fn().mockResolvedValue("/uploaded.png"),
		...overrides,
	}
}

describe("image upload node view", () => {
	afterEach(() => vi.unstubAllGlobals())

	it("shows upload progress and renders the uploaded image", async () => {
		let finishUpload: (src: string) => void = () => undefined
		const upload = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					finishUpload = resolve
				}),
		)
		const imageUpload = adapter({ upload })
		vi.stubGlobal("URL", {
			...URL,
			createObjectURL: vi.fn().mockReturnValue("blob:preview"),
		})
		const editor = new Editor({
			element: document.createElement("div"),
			extensions: getEditorExtensions({ imageUpload }),
		})
		render(<EditorContent editor={editor} />)

		act(() => {
			editor.commands.insertImageComponent(imageFile())
		})

		expect(
			await screen.findByRole("status", { name: "Uploading image" }),
		).toBeVisible()
		expect(screen.getByRole("img", { name: "image.png" })).toHaveAttribute(
			"src",
			"blob:preview",
		)
		expect(upload).toHaveBeenCalledOnce()

		act(() => finishUpload("assets/uploaded.png"))

		await waitFor(() =>
			expect(screen.queryByRole("status")).not.toBeInTheDocument(),
		)
		expect(screen.getByRole("img", { name: "image.png" })).toHaveAttribute(
			"src",
			"assets/uploaded.png",
		)
		expect(editor.getMarkdown().trim()).toBe(
			"![image.png](assets/uploaded.png)",
		)
		editor.destroy()
	})
})

describe("image upload failures", () => {
	afterEach(() => vi.unstubAllGlobals())

	function mountEditor(imageUpload: ImageUploadAdapter) {
		vi.stubGlobal("URL", {
			...URL,
			createObjectURL: vi.fn().mockReturnValue("blob:preview"),
		})
		const editor = new Editor({
			element: document.createElement("div"),
			extensions: getEditorExtensions({ imageUpload }),
		})
		render(<EditorContent editor={editor} />)
		return editor
	}

	it("shows why a file was refused instead of dropping it", async () => {
		const upload = vi.fn()
		const editor = mountEditor(
			adapter({ upload, validate: () => "Images can be at most 5 MB." }),
		)

		act(() => {
			editor.commands.insertImageComponent(imageFile())
		})

		expect(
			await screen.findByText("Failed to upload: Images can be at most 5 MB."),
		).toBeVisible()
		expect(upload).not.toHaveBeenCalled()
		expect(editor.getMarkdown().trim()).toBe("")
		editor.destroy()
	})

	it("shows the upload's error and keeps its preview out of the Markdown", async () => {
		const editor = mountEditor(
			adapter({ upload: vi.fn().mockRejectedValue(new Error("Too big")) }),
		)

		act(() => {
			editor.commands.insertImageComponent(imageFile())
		})

		expect(await screen.findByText("Failed to upload: Too big")).toBeVisible()
		expect(editor.getMarkdown().trim()).toBe("")
		editor.destroy()
	})

	it("keeps an image out of the Markdown until its upload finishes", () => {
		const editor = mountEditor(
			adapter({ upload: vi.fn(() => new Promise<string>(() => undefined)) }),
		)

		act(() => {
			editor.commands.insertImageComponent(imageFile())
		})

		expect(editor.getMarkdown().trim()).toBe("")
		editor.destroy()
	})
})

describe("replacing image sources", () => {
	const STAGED = "/api/staged-image/acme/blog/cat.png"

	function mountEditor() {
		const editor = new Editor({
			content: `Intro\n\n![A cat](${STAGED})\n\n![A dog](media/dog.png)`,
			contentType: "markdown",
			element: document.createElement("div"),
			extensions: getEditorExtensions({ imageUpload: adapter() }),
		})
		render(<EditorContent editor={editor} />)
		return editor
	}

	it("points each named image at its new source and leaves the rest alone", () => {
		const editor = mountEditor()

		act(() => {
			editor.commands.replaceImageSources({ [STAGED]: "media/cat.png" })
		})

		expect(editor.getMarkdown().trim()).toBe(
			"Intro\n\n![A cat](media/cat.png)\n\n![A dog](media/dog.png)",
		)
		editor.destroy()
	})

	// The old source may be gone by the time anyone undoes: a committed Staged
	// Image is no longer staged.
	it("is not something undo brings back", () => {
		const editor = mountEditor()
		act(() => {
			editor.commands.insertContent("x")
			editor.commands.replaceImageSources({ [STAGED]: "media/cat.png" })
			editor.commands.undo()
		})

		expect(editor.getMarkdown()).toContain("![A cat](media/cat.png)")
		editor.destroy()
	})
})
