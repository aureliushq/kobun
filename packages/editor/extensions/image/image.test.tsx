import { act, render, screen, waitFor } from "@testing-library/react"
import { Editor } from "@tiptap/core"
import { EditorContent } from "@tiptap/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ImageUploadAdapter } from "../../types"
import { getEditorExtensions } from ".."
import { validateImageFile } from "./extension"

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

describe("image validation", () => {
	it("accepts images within the default size and MIME limits", () => {
		expect(validateImageFile(imageFile(), adapter())).toBeNull()
	})

	it("rejects files over the configured size limit", () => {
		expect(
			validateImageFile(imageFile({ size: 11 }), adapter({ maxFileSize: 10 })),
		).toBe("Image must be 10 bytes or smaller.")
	})

	it("supports exact and wildcard MIME type limits", () => {
		const file = imageFile({ type: "image/webp" })

		expect(
			validateImageFile(file, adapter({ allowedMimeTypes: ["image/*"] })),
		).toBeNull()
		expect(
			validateImageFile(file, adapter({ allowedMimeTypes: ["image/png"] })),
		).toBe("Image type image/webp is not allowed.")
	})

	it("returns a custom validation error before built-in validation", () => {
		const validate = vi.fn().mockReturnValue("Use a landscape image.")
		const file = imageFile({ size: 11, type: "text/plain" })

		expect(
			validateImageFile(
				file,
				adapter({ validate, maxFileSize: 10, allowedMimeTypes: ["image/png"] }),
			),
		).toBe("Use a landscape image.")
		expect(validate).toHaveBeenCalledWith(file)
	})
})

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
			screen.getByRole("status", { name: "Uploading image" }),
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
